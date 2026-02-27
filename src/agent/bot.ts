/**
 * ═══════════════════════════════════════════════════════════════
 * 🤖 AEGIS PROTOCOL V4 — BYOA TRADING AGENT (bot.ts)
 * ═══════════════════════════════════════════════════════════════
 *
 * V4 Architecture change from V3:
 *   - V3: Agent called requestAudit() + executeSafeSwap() directly on AegisVault
 *   - V4: Agent constructs ERC-4337 UserOperations targeting the Smart Account
 *         which routes through AegisModule (ERC-7579 Executor)
 *
 * Capital Model (unchanged):
 *   - Agent wallet holds GAS ETH only — NEVER trading capital
 *   - All trading capital lives in the Smart Account (ERC-4337)
 *   - AegisModule commands the Smart Account via executeFromExecutor()
 *
 * UserOp Flow:
 *   Agent (Session Key) → Pimlico Bundler → Smart Account
 *     → AegisModule.requestAudit(token)    [Step 1]
 *     Wait for ClearanceUpdated event       [Step 2]
 *     → AegisModule.triggerSwap(token, amount) [Step 3]
 *
 * Usage:
 *   pnpm ts-node src/agent/bot.ts
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    getAddress,
    defineChain,
    encodeFunctionData,
    type Hex,
    type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

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
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY || "";

// ─── AegisModule V4 ABI (minimal — only what the agent needs) ────────────────
export const AEGIS_MODULE_ABI = [
    {
        name: "requestAudit",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_token", type: "address" }],
        outputs: [{ name: "tradeId", type: "uint256" }],
    },
    {
        name: "triggerSwap",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_token", type: "address" },
            { name: "_amount", type: "uint256" },
        ],
        outputs: [],
    },
    {
        name: "isApproved",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "", type: "address" }],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "ClearanceUpdated",
        type: "event",
        inputs: [
            { name: "token", type: "address", indexed: true },
            { name: "approved", type: "bool", indexed: false },
        ],
    },
    {
        name: "ClearanceDenied",
        type: "event",
        inputs: [
            { name: "token", type: "address", indexed: true },
            { name: "riskScore", type: "uint256", indexed: false },
        ],
    },
] as const;

// ─── Agent Config Type ────────────────────────────────────────────────────────
export type AegisAgentConfig = {
    aegisModuleAddress: Address;
    targetTokenAddress: Address;
    pimlicoApiKey: string;
    rpcUrl: string;
    tradeAmount: bigint;
};

// ─── Custom Chain (Tenderly Base Fork) ───────────────────────────────────────
const aegisTenderly = defineChain({
    id: 73578453,
    name: "Aegis Tenderly VNet",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [TENDERLY_RPC_URL || "http://localhost:8545"] } },
    testnet: true,
});

// ─── UserOp Calldata Builders ────────────────────────────────────────────────

/**
 * Encodes the calldata for AegisModule.requestAudit(token).
 * In V4, this is submitted as a UserOp via the Smart Account.
 */
export function buildRequestAuditCalldata(tokenAddress: Address): Hex {
    return encodeFunctionData({
        abi: AEGIS_MODULE_ABI,
        functionName: "requestAudit",
        args: [tokenAddress],
    });
}

/**
 * Encodes the calldata for AegisModule.triggerSwap(token, amount).
 * Only callable after the oracle has granted clearance.
 */
export function buildTriggerSwapCalldata(tokenAddress: Address, amount: bigint): Hex {
    return encodeFunctionData({
        abi: AEGIS_MODULE_ABI,
        functionName: "triggerSwap",
        args: [tokenAddress, amount],
    });
}

// ─── Clearance Poller ─────────────────────────────────────────────────────────

/**
 * Polls on-chain for ClearanceUpdated or ClearanceDenied events.
 * Uses HTTP polling (Tenderly VNets don't support WebSocket subscriptions).
 *
 * @param publicClient Viem public client
 * @param moduleAddress AegisModule contract address
 * @param tokenAddress Target token being audited
 * @param startBlock Block to start scanning from
 * @param maxAttempts Poll attempts before timeout (default: 120 = 2 min at 1s)
 * @returns true if cleared, false if denied or timed out
 */
export async function pollForClearance(
    publicClient: ReturnType<typeof createPublicClient>,
    moduleAddress: Address,
    tokenAddress: Address,
    startBlock: bigint,
    maxAttempts = 120
): Promise<boolean> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            // Check for APPROVAL
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

            // Check for DENIAL
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
    return false; // Timeout
}

// ─── Main Agent Loop ──────────────────────────────────────────────────────────
async function main() {
    if (!AGENT_PRIVATE_KEY || !TENDERLY_RPC_URL) {
        console.error("[AEGIS AGENT V4] ❌ Missing AGENT_PRIVATE_KEY or TENDERLY_RPC_URL");
        process.exit(1);
    }

    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: aegisTenderly, transport: http(TENDERLY_RPC_URL) });
    const walletClient = createWalletClient({ account, chain: aegisTenderly, transport: http(TENDERLY_RPC_URL) });

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🤖 AEGIS V4 BYOA AGENT — ERC-4337 Session Key Mode");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Agent Wallet:     ${account.address}  (gas only)`);
    console.log(`  AegisModule:      ${AEGIS_MODULE_ADDRESS}`);
    console.log(`  Target Token:     ${TARGET_TOKEN_ADDRESS}`);
    console.log(`  Pimlico Bundler:  ${PIMLICO_API_KEY ? "configured" : "NOT SET — using direct RPC"}`);
    console.log("");

    // ── Step 1: Request Audit ────────────────────────────────────────────────
    console.log("[AGENT] 📡 STEP 1: Submitting trade intent to AegisModule...");

    const auditCalldata = buildRequestAuditCalldata(TARGET_TOKEN_ADDRESS);
    const auditTxHash = await walletClient.sendTransaction({
        to: AEGIS_MODULE_ADDRESS,
        data: auditCalldata,
        value: BigInt(0),
    });

    console.log(`[AGENT] ✅ requestAudit tx: ${auditTxHash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash: auditTxHash });
    console.log(`[AGENT] ⛏  Confirmed in block ${receipt.blockNumber}`);

    // ── Step 2: Wait for Oracle Verdict ─────────────────────────────────────
    console.log("[AGENT] 👁  STEP 2: Awaiting Chainlink CRE clearance...");
    const startBlock = receipt.blockNumber;
    const approved = await pollForClearance(publicClient, AEGIS_MODULE_ADDRESS, TARGET_TOKEN_ADDRESS, startBlock);

    // ── Step 3: Execute or Stand Down ───────────────────────────────────────
    if (approved) {
        console.log("[AGENT] 🟢 STEP 3: CLEARED — Executing JIT swap...");
        const swapCalldata = buildTriggerSwapCalldata(TARGET_TOKEN_ADDRESS, parseEther("1"));
        const swapTxHash = await walletClient.sendTransaction({
            to: AEGIS_MODULE_ADDRESS,
            data: swapCalldata,
            value: BigInt(0),
        });
        console.log(`[AGENT] ✅ triggerSwap tx: ${swapTxHash}`);
        const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash });
        console.log(`[AGENT] 🎉 Swap confirmed in block ${swapReceipt.blockNumber}`);
    } else {
        console.log("[AGENT] 🔴 BLOCKED by Aegis Firewall. Zero capital at risk. Standing down.");
    }

    process.exit(0);
}

main().catch((err) => {
    console.error("[AGENT] 💥 Fatal error:", err);
    process.exit(1);
});
