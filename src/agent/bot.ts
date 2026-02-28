/**
 * ═══════════════════════════════════════════════════════════════
 * 🤖 AEGIS PROTOCOL V5 — BYOA TRADING AGENT (bot.ts)
 * ═══════════════════════════════════════════════════════════════
 *
 * V5 Architecture (from V4):
 *   - V4: Agent called AegisModule directly via walletClient.sendTransaction()
 *           (EOA → Module) — described as UserOps but never wired as such
 *   - V5: Agent submits real ERC-4337 UserOperations via Safe Smart Account
 *           (Session Key → Bundler → Safe → Module)
 *
 * Capital Model (unchanged):
 *   - Agent wallet holds GAS ETH only — NEVER trading capital
 *   - All trading capital lives in the Safe Smart Account (ERC-4337)
 *   - AegisModule treasury = Safe treasury
 *   - AegisModule commands the Safe via executeFromExecutor()
 *
 * ERC-7715 Session Key:
 *   - Owner pre-enables a session via SmartSessionsValidator
 *   - Agent signs UserOps with their EOA (session key)
 *   - Signature format: SmartSessionMode.USE + permissionId + agentSig
 *   - AegisModule sees msg.sender = Safe (which is subscribed as owner)
 *
 * UserOp Flow:
 *   Agent EOA (session key)
 *     → buildV5RequestAuditCall(token)
 *     → sendUserOperation({ calls: [{ to: module, data }] })
 *       [permissionless wraps in Safe.execute()]
 *       [Bundler submits to EntryPoint]
 *       [SmartSessionsValidator validates session]
 *       [Safe.execute() calls AegisModule.requestAudit(token)]
 *     → AuditRequested event emitted
 *     → Poll for ClearanceUpdated
 *     → buildV5TriggerSwapCall(token, amount, minOut)
 *     → sendUserOperation (same flow)
 *     → AegisModule executes Uniswap V3 swap from treasury
 *
 * Usage:
 *   pnpm ts-node src/agent/bot.ts
 */

import {
    createPublicClient,
    http,
    parseEther,
    getAddress,
    defineChain,
    type Hex,
    type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { entryPoint07Address } from "viem/account-abstraction";
import * as dotenv from "dotenv";

import { buildV5RequestAuditCall, buildV5TriggerSwapCall, AEGIS_MODULE_ABI } from "../../scripts/v5_bot_config";

// Re-export ABI for backward compatibility (used by cre-node event parsing)
export { AEGIS_MODULE_ABI };

dotenv.config();

// ─── Environment ──────────────────────────────────────────────────────────────
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY as Hex;
const TENDERLY_RPC_URL = process.env.TENDERLY_RPC_URL!;
const AEGIS_MODULE_ADDRESS = getAddress(
    process.env.AEGIS_MODULE_ADDRESS || "0x0000000000000000000000000000000000000000"
) as Address;
const TARGET_TOKEN_ADDRESS = getAddress(
    process.env.TARGET_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000001"
) as Address;
const SAFE_ADDRESS = (process.env.SAFE_ADDRESS || "") as Address;
const BUNDLER_RPC_URL = process.env.BUNDLER_RPC_URL || "http://localhost:4337";

// ─── Custom Chain (Tenderly Base Fork) ────────────────────────────────────────
const aegisTenderly = defineChain({
    id: 73578453,
    name: "Aegis Tenderly VNet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [TENDERLY_RPC_URL || "http://localhost:8545"] } },
    testnet: true,
});

// ─── Clearance Poller (unchanged from V4) ────────────────────────────────────
export async function pollForClearanceV5(
    publicClient: ReturnType<typeof createPublicClient>,
    moduleAddress: Address,
    tokenAddress: Address,
    startBlock: bigint,
    maxAttempts = 120
): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const approvedLogs = await publicClient.getLogs({
                address: moduleAddress,
                event: {
                    type: "event",
                    name: "ClearanceUpdated",
                    inputs: [
                        { name: "token", type: "address", indexed: true },
                        { name: "approved", type: "bool", indexed: false },
                    ],
                },
                args: { token: tokenAddress },
                fromBlock: startBlock,
                toBlock: "latest",
            });
            if (approvedLogs.length > 0) return true;

            const deniedLogs = await publicClient.getLogs({
                address: moduleAddress,
                event: {
                    type: "event",
                    name: "ClearanceDenied",
                    inputs: [
                        { name: "token", type: "address", indexed: true },
                        { name: "riskScore", type: "uint256", indexed: false },
                    ],
                },
                args: { token: tokenAddress },
                fromBlock: startBlock,
                toBlock: "latest",
            });
            if (deniedLogs.length > 0) return false;
        } catch {
            // Ignore RPC errors — retry
        }
        await new Promise((r) => setTimeout(r, 1000));
    }
    return false;
}

// ─── Main Agent Loop ──────────────────────────────────────────────────────────
async function main() {
    if (!AGENT_PRIVATE_KEY || !TENDERLY_RPC_URL) {
        console.error("[AEGIS AGENT V5] ❌ Missing AGENT_PRIVATE_KEY or TENDERLY_RPC_URL");
        process.exit(1);
    }

    if (!SAFE_ADDRESS || SAFE_ADDRESS === "0x0000000000000000000000000000000000000000") {
        console.error("[AEGIS AGENT V5] ❌ SAFE_ADDRESS not configured — run scripts/v5_setup_safe.ts first");
        process.exit(1);
    }

    const agentAccount = privateKeyToAccount(AGENT_PRIVATE_KEY);

    const publicClient = createPublicClient({
        chain: aegisTenderly,
        transport: http(TENDERLY_RPC_URL),
    });

    // ── Create Safe Smart Account ────────────────────────────────────────────
    // The agent's private key acts as the session key (ERC-7715).
    // The Safe was deployed by the owner and has SmartSessionsValidator installed.
    // This does NOT redeploy — toSafeSmartAccount at an existing address is a no-op.
    const safeAccount = await toSafeSmartAccount({
        client: publicClient as any,
        owners: [agentAccount],
        version: "1.4.1",
        entryPoint: { address: entryPoint07Address as Address, version: "0.7" },
        address: SAFE_ADDRESS, // Use pre-deployed Safe — no counterfactual
    });

    // ── Create Smart Account Client (via local alto bundler) ─────────────────
    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: aegisTenderly,
        bundlerTransport: http(BUNDLER_RPC_URL),
    }) as any; // `any` due to viem CJS generic type narrowing

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🤖 AEGIS V5 BYOA AGENT — ERC-4337 UserOp Mode");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Agent (session key): ${agentAccount.address}`);
    console.log(`  Safe Smart Account:  ${SAFE_ADDRESS}`);
    console.log(`  AegisModule:         ${AEGIS_MODULE_ADDRESS}`);
    console.log(`  Target Token:        ${TARGET_TOKEN_ADDRESS}`);
    console.log(`  Bundler:             ${BUNDLER_RPC_URL}`);
    console.log("");

    // ── Step 1: Submit requestAudit via UserOp ───────────────────────────────
    console.log("[AGENT V5] 📡 STEP 1: Submitting requestAudit UserOperation...");
    const auditCall = buildV5RequestAuditCall(AEGIS_MODULE_ADDRESS, TARGET_TOKEN_ADDRESS);

    const auditUserOpHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: auditCall.to, data: auditCall.data, value: auditCall.value }],
    });
    console.log(`[AGENT V5] ✅ UserOp submitted: ${auditUserOpHash}`);

    const auditReceipt = await smartAccountClient.waitForUserOperationReceipt({
        hash: auditUserOpHash,
    });
    const auditBlock = auditReceipt.receipt.blockNumber;
    console.log(`[AGENT V5] ⛏  Confirmed in block ${auditBlock}`);

    // ── Step 2: Wait for CRE oracle clearance ────────────────────────────────
    console.log("[AGENT V5] 👁  STEP 2: Awaiting Chainlink CRE clearance...");
    const approved = await pollForClearanceV5(
        publicClient,
        AEGIS_MODULE_ADDRESS,
        TARGET_TOKEN_ADDRESS,
        auditBlock
    );

    // ── Step 3: Execute triggerSwap via UserOp ───────────────────────────────
    if (approved) {
        console.log("[AGENT V5] 🟢 STEP 3: CLEARED — Executing JIT swap via UserOp...");
        const swapCall = buildV5TriggerSwapCall(
            AEGIS_MODULE_ADDRESS,
            TARGET_TOKEN_ADDRESS,
            parseEther("0.01"), // 0.01 ETH from treasury
            BigInt(1)           // min output (slippage = max for demo)
        );

        const swapUserOpHash = await smartAccountClient.sendUserOperation({
            calls: [{ to: swapCall.to, data: swapCall.data, value: swapCall.value }],
        });
        console.log(`[AGENT V5] ✅ Swap UserOp: ${swapUserOpHash}`);
        const swapReceipt = await smartAccountClient.waitForUserOperationReceipt({
            hash: swapUserOpHash,
        });
        console.log(`[AGENT V5] 🎉 Swap confirmed in block ${swapReceipt.receipt.blockNumber}`);
        console.log(`[AGENT V5] 🔗 Tx: ${swapReceipt.receipt.transactionHash}`);
    } else {
        console.log("[AGENT V5] 🔴 BLOCKED by Aegis Firewall. Zero capital at risk. Standing down.");
    }

    process.exit(0);
}

main().catch((err) => {
    console.error("[AGENT V5] 💥 Fatal error:", err);
    process.exit(1);
});
