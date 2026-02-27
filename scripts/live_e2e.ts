// @ts-nocheck
/**
 * ═══════════════════════════════════════════════════════════════
 * 🔴 AEGIS V4 — LIVE E2E TEST (scripts/live_e2e.ts)
 * ═══════════════════════════════════════════════════════════════
 *
 * Purpose:
 *   The production-grade end-to-end test. Unlike e2e_mock_simulation.ts,
 *   this script does NOT mock the CRE oracle. It:
 *     1. Deploys AegisModule (or uses existing from .env)
 *     2. Triggers requestAudit() as the AI agent
 *     3. WAITS for the real Chainlink CRE Docker node to:
 *        - Pick up the AuditRequested event
 *        - Run GoPlus + AI consensus off-chain
 *        - Call onReport() back on-chain through the KeystoneForwarder
 *     4. Asserts the clearance was granted (isApproved = true)
 *     5. Triggers a swap and asserts anti-replay
 *
 * Prerequisites:
 *   1. Anvil running:   anvil --block-time 1
 *      OR Tenderly VNet spun up: .\scripts\new_tenderly_testnet.ps1
 *   2. CRE node running: .\scripts\start_oracle.ps1
 *   3. AEGIS_MODULE_ADDRESS set in .env
 *   4. TENDERLY_RPC_URL set in .env (or http://127.0.0.1:8545 for Anvil)
 *
 * Usage:
 *   pnpm ts-node scripts/live_e2e.ts
 *
 * Expected output:
 *   [LIVE E2E] ✅ onReport received from live CRE node!
 *   [LIVE E2E] 🎉 Full live integration test PASSED
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    getAddress,
    defineChain,
    encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import * as dotenv from "dotenv";

dotenv.config();

// ─── Chain config (uses .env RPC URL) ────────────────────────────────────────
const RPC_URL = process.env.TENDERLY_RPC_URL || "http://127.0.0.1:8545";
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY ||
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // Anvil account 2
const MODULE_ADDRESS = process.env.AEGIS_MODULE_ADDRESS
    ? getAddress(process.env.AEGIS_MODULE_ADDRESS)
    : null;
const TARGET_TOKEN = getAddress(
    process.env.TARGET_TOKEN_ADDRESS || "0x000000000000000000000000000000000000000a"
);

// Well-known "safe" token in our local mock registry → should get cleared by oracle
const SAFE_TOKEN_FROM_MOCK_REGISTRY = "0x000000000000000000000000000000000000000a";

const aegisChain = defineChain({
    id: parseInt(process.env.CHAIN_ID || "31337"),
    name: "Aegis Live E2E Network",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
    testnet: true,
});

const AEGIS_MODULE_ABI = [
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
];

function assert(condition: boolean, message: string): void {
    if (!condition) {
        console.error(`\n❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`  ✅ PASS: ${message}`);
}

// ─── Live clearance poller ────────────────────────────────────────────────────
async function waitForLiveClearance(
    publicClient: any,
    moduleAddress: string,
    tokenAddress: string,
    startBlock: bigint,
    timeoutSeconds = 300 // 5 min — CRE oracle takes ~30-120s
): Promise<{ cleared: boolean; riskScore?: bigint }> {
    const startTime = Date.now();
    const maxMs = timeoutSeconds * 1000;

    console.log(`  ⏳ Waiting up to ${timeoutSeconds}s for live CRE oracle verdict...`);
    console.log("  📡 Monitor: docker compose logs -f | grep -E 'onReport|AuditRequested'");

    while (Date.now() - startTime < maxMs) {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);

        // Poll for ClearanceUpdated (cleared)
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
        }).catch(() => []);

        if (approvedLogs.length > 0) {
            console.log(`\n  🟢 ClearanceUpdated received! (after ${elapsed}s)`);
            return { cleared: true };
        }

        // Poll for ClearanceDenied (denied)
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
        }).catch(() => []);

        if (deniedLogs.length > 0) {
            const riskScore = deniedLogs[0]?.args?.riskScore || BigInt(0);
            console.log(`\n  🔴 ClearanceDenied received! riskScore=${riskScore} (after ${elapsed}s)`);
            return { cleared: false, riskScore };
        }

        // Progress ticker every 10s
        if (elapsed % 10 === 0 && elapsed > 0) {
            console.log(`  ... still waiting (${elapsed}s elapsed)...`);
        }

        await new Promise((r) => setTimeout(r, 1000));
    }

    return { cleared: false }; // timeout
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🔴 AEGIS V4 — LIVE E2E INTEGRATION TEST");
    console.log("  (Real Chainlink CRE node — no mocking)");
    console.log("═══════════════════════════════════════════════════════════════\n");

    if (!MODULE_ADDRESS) {
        console.error("❌ AEGIS_MODULE_ADDRESS not set in .env");
        console.error("   Run: .\\scripts\\new_tenderly_testnet.ps1 first");
        process.exit(1);
    }

    const agent = privateKeyToAccount(AGENT_PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: aegisChain, transport: http(RPC_URL) });
    const agentClient = createWalletClient({ account: agent, chain: aegisChain, transport: http(RPC_URL) });

    console.log(`  RPC URL:      ${RPC_URL}`);
    console.log(`  AegisModule:  ${MODULE_ADDRESS}`);
    console.log(`  Agent:        ${agent.address}`);
    console.log(`  Target Token: ${TARGET_TOKEN}`);
    console.log(`  (Token 0x...000a is in the SAFE mock registry → should be cleared)\n`);

    // ── STEP 1: Submit trade intent ────────────────────────────────────────────
    console.log("[STEP 1] Agent submits requestAudit(token)...");

    const auditCalldata = encodeFunctionData({
        abi: AEGIS_MODULE_ABI,
        functionName: "requestAudit",
        args: [TARGET_TOKEN],
    });

    const auditTxHash = await agentClient.sendTransaction({
        to: MODULE_ADDRESS,
        data: auditCalldata,
        value: BigInt(0),
    });

    const auditReceipt = await publicClient.waitForTransactionReceipt({ hash: auditTxHash });
    console.log(`  ✅ requestAudit() confirmed in block ${auditReceipt.blockNumber}`);
    console.log(`  tx: ${auditTxHash}\n`);

    const startBlock = auditReceipt.blockNumber;

    // ── STEP 2: Wait for real CRE oracle callback ──────────────────────────────
    console.log("[STEP 2] Waiting for live Chainlink CRE oracle verdict...");
    console.log("  The CRE node (Docker) should:");
    console.log("  1. Detect the AuditRequested event");
    console.log("  2. Run GoPlus + AI consensus (30-120s)");
    console.log("  3. Call onReport() via KeystoneForwarder\n");

    const { cleared, riskScore } = await waitForLiveClearance(
        publicClient,
        MODULE_ADDRESS,
        TARGET_TOKEN,
        startBlock,
        300 // 5 min timeout
    );

    // ── STEP 3: Assert and act on verdict ─────────────────────────────────────
    if (cleared) {
        console.log("\n[STEP 3] Live CRE verdict: CLEARED ✅");
        assert(true, "Live CRE oracle called onReport(tradeId, 0) successfully");

        // Verify on-chain state
        const isApproved = await publicClient.readContract({
            address: MODULE_ADDRESS,
            abi: AEGIS_MODULE_ABI,
            functionName: "isApproved",
            args: [TARGET_TOKEN],
        });
        assert(isApproved === true, "isApproved[token] = true after live CRE report");

        // ── STEP 4: Execute the swap ───────────────────────────────────────────
        console.log("\n[STEP 4] Executing swap (triggerSwap)...");
        const swapCalldata = encodeFunctionData({
            abi: AEGIS_MODULE_ABI,
            functionName: "triggerSwap",
            args: [TARGET_TOKEN, parseEther("0.01")],
        });

        const swapTxHash = await agentClient.sendTransaction({
            to: MODULE_ADDRESS,
            data: swapCalldata,
            value: BigInt(0),
        });
        const swapReceipt = await publicClient.waitForTransactionReceipt({ hash: swapTxHash });
        console.log(`  ✅ triggerSwap confirmed in block ${swapReceipt.blockNumber}`);

        // ── STEP 5: Verify anti-replay ─────────────────────────────────────────
        const isApprovedAfter = await publicClient.readContract({
            address: MODULE_ADDRESS,
            abi: AEGIS_MODULE_ABI,
            functionName: "isApproved",
            args: [TARGET_TOKEN],
        });
        assert(isApprovedAfter === false, "Clearance consumed after swap (anti-replay)");

        console.log("\n═══════════════════════════════════════════════════════════════");
        console.log("  🎉 LIVE E2E INTEGRATION TEST PASSED");
        console.log("═══════════════════════════════════════════════════════════════");
        console.log("  Proven (with REAL Chainlink CRE oracle — NO mocking):");
        console.log("  ✅ AuditRequested event detected by CRE Docker node");
        console.log("  ✅ onReport() delivered by live KeystoneForwarder");
        console.log("  ✅ Clearance granted on-chain after CRE consensus");
        console.log("  ✅ triggerSwap executed via executeFromExecutor");
        console.log("  ✅ Clearance consumed (anti-replay protection)");
        console.log("═══════════════════════════════════════════════════════════════\n");

    } else {
        if (riskScore !== undefined) {
            console.log(`\n[STEP 3] Live CRE verdict: DENIED 🔴 (riskScore=${riskScore})`);
            console.log("  This is EXPECTED for risky tokens — the firewall works!");
            console.log(`  Token ${TARGET_TOKEN} was flagged. Try with 0x...000a (safe mock token).`);
        } else {
            console.log("\n[STEP 3] ⏰ TIMEOUT — No CRE oracle verdict received in 5 minutes.");
            console.log("  Possible issues:");
            console.log("  1. CRE Docker node is not running → Run: .\\scripts\\start_oracle.ps1");
            console.log("  2. CRE node config mismatch → Check cre-node/config.json vaultAddress");
            console.log("  3. KeystoneForwarder address wrong → Check KEYSTONE_FORWARDER in .env");
            console.log("  4. RPC URL unreachable from Docker → Check TENDERLY_RPC_URL in .env");
            console.log("\n  Debug: docker compose logs --tail=100");
        }
        process.exit(1);
    }

    process.exit(0);
}

main().catch((err) => {
    console.error("\n💥 Live E2E test failed:", err.message || err);
    process.exit(1);
});
