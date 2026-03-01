// @ts-nocheck — Integration test: skipped without env vars; permissionless lib type mismatch
/**
 * ═══════════════════════════════════════════════════════════════
 * SmartSessionValidator Integration Tests (Base Sepolia)
 * ═══════════════════════════════════════════════════════════════
 *
 * TDD RED phase — these tests are written BEFORE implementation.
 * They should FAIL until `v5_install_session_validator.ts` is run.
 *
 * This test requires:
 *   - Base Sepolia RPC access
 *   - Funded deployer wallet
 *   - Pimlico API key
 *   - Deployed AegisModule on Base Sepolia
 *   - AGENT_PRIVATE_KEY in .env (separate from owner)
 *   - SAFE_ADDRESS in .env (Safe with AegisModule + SmartSessionValidator installed)
 *
 * Run with: pnpm jest test/session_install.spec.ts --testTimeout=120000
 */

import {
    createPublicClient,
    createWalletClient,
    http,
    parseEther,
    getAddress,
    encodeFunctionData,
    nonceManager,
    type Address,
    type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import * as dotenv from "dotenv";
dotenv.config();

import {
    SMART_SESSIONS_VALIDATOR_ADDRESS,
    SELECTOR_REQUEST_AUDIT,
    SELECTOR_TRIGGER_SWAP,
    buildAgentSession,
    getSmartSessionValidatorModule,
} from "../scripts/v5_session_config";

// ── ABI (subset needed for tests) ─────────────────────────────────────
const AEGIS_MODULE_ABI = [
    { name: "requestAudit", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_token", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
    { name: "onReportDirect", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tradeId", type: "uint256" }, { name: "riskScore", type: "uint256" }], outputs: [] },
    { name: "triggerSwap", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_token", type: "address" }, { name: "_amountIn", type: "uint256" }, { name: "_amountOutMinimum", type: "uint256" }], outputs: [] },
    { name: "isApproved", type: "function", stateMutability: "view", inputs: [{ name: "", type: "address" }], outputs: [{ name: "", type: "bool" }] },
    { name: "subscribeAgent", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_agent", type: "address" }, { name: "_budget", type: "uint256" }], outputs: [] },
    { name: "revokeAgent", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_agent", type: "address" }], outputs: [] },
    { name: "withdrawETH", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_amount", type: "uint256" }], outputs: [] },
    { name: "depositETH", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
    { name: "agentAllowances", type: "function", stateMutability: "view", inputs: [{ name: "agent", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
    { type: "event", name: "AuditRequested", inputs: [{ name: "tradeId", type: "uint256", indexed: true }, { name: "user", type: "address", indexed: true }, { name: "targetToken", type: "address", indexed: true }, { name: "firewallConfig", type: "string", indexed: false }] },
] as any[];

// Safe module management ABI (ERC-7579)
const SAFE_MODULE_ABI = [
    { name: "isModuleInstalled", type: "function", stateMutability: "view", inputs: [{ name: "moduleTypeId", type: "uint256" }, { name: "module", type: "address" }, { name: "additionalContext", type: "bytes" }], outputs: [{ name: "", type: "bool" }] },
] as any[];

// ── Config ────────────────────────────────────────────────────────────
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_KEY}`;
const MODULE = process.env.AEGIS_MODULE_ADDRESS as Address;
const MOCK_BRETT = process.env.TARGET_TOKEN_ADDRESS as Address;
const SAFE_ADDR = process.env.SAFE_ADDRESS as Address;

describe("SmartSessionValidator Integration (Base Sepolia)", () => {
    // Skip if required env vars not set
    const skip = !PIMLICO_KEY || !MODULE || !MOCK_BRETT || !SAFE_ADDR || !process.env.AGENT_PRIVATE_KEY;

    let publicClient: any;
    let ownerWallet: any;
    let agentWallet: any;
    let pimlicoClient: any;
    let ownerAccount: any;
    let agentAccount: any;

    beforeAll(async () => {
        if (skip) return;

        const ownerPk = process.env.PRIVATE_KEY as Hex;
        ownerAccount = privateKeyToAccount(ownerPk);
        ownerAccount.nonceManager = nonceManager;

        const agentPk = process.env.AGENT_PRIVATE_KEY as Hex;
        agentAccount = privateKeyToAccount(agentPk);
        agentAccount.nonceManager = nonceManager;

        publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
        ownerWallet = createWalletClient({ account: ownerAccount, chain: baseSepolia, transport: http(RPC_URL) });
        agentWallet = createWalletClient({ account: agentAccount, chain: baseSepolia, transport: http(RPC_URL) });

        pimlicoClient = createPimlicoClient({
            transport: http(PIMLICO_URL),
            entryPoint: { address: entryPoint07Address, version: "0.7" },
        });
    }, 30_000);

    // ── Test 1: SmartSessionValidator is installed on Safe ──────────────
    it("SmartSessionValidator is installed on Safe as validator module", async () => {
        if (skip) return;

        const isInstalled = await publicClient.readContract({
            address: SAFE_ADDR,
            abi: SAFE_MODULE_ABI,
            functionName: "isModuleInstalled",
            args: [
                1n, // moduleTypeId = 1 = VALIDATOR
                SMART_SESSIONS_VALIDATOR_ADDRESS,
                "0x", // no additional context
            ],
        });
        expect(isInstalled).toBe(true);
    }, 30_000);

    // ── Test 2: AegisModule is still installed after validator install ──
    it("AegisModule is still installed as executor module", async () => {
        if (skip) return;

        const isInstalled = await publicClient.readContract({
            address: SAFE_ADDR,
            abi: SAFE_MODULE_ABI,
            functionName: "isModuleInstalled",
            args: [
                2n, // moduleTypeId = 2 = EXECUTOR
                MODULE,
                "0x",
            ],
        });
        expect(isInstalled).toBe(true);
    }, 30_000);

    // ── Test 3: Agent is subscribed with a budget ──────────────────────
    it("Agent wallet is subscribed with non-zero budget", async () => {
        if (skip) return;

        const allowance = await publicClient.readContract({
            address: MODULE,
            abi: AEGIS_MODULE_ABI,
            functionName: "agentAllowances",
            args: [agentAccount.address],
        });
        expect(allowance).toBeGreaterThan(0n);
    }, 30_000);

    // ── Test 4: Agent can requestAudit via session-signed UserOp ───────
    it("Agent can requestAudit via UserOp (session key scoped)", async () => {
        if (skip) return;

        // Build Safe account from existing deployment
        const safeAccount = await toSafeSmartAccount({
            client: publicClient as any,
            owners: [agentAccount],
            version: "1.4.1",
            entryPoint: { address: entryPoint07Address, version: "0.7" },
            address: SAFE_ADDR,
        });

        const agentSmartClient = createSmartAccountClient({
            account: safeAccount,
            chain: baseSepolia,
            bundlerTransport: http(PIMLICO_URL),
            paymaster: pimlicoClient,
            userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
        });

        const auditData = encodeFunctionData({
            abi: AEGIS_MODULE_ABI,
            functionName: "requestAudit",
            args: [MOCK_BRETT],
        });

        const hash = await agentSmartClient.sendUserOperation({
            calls: [{ to: MODULE, data: auditData, value: 0n }],
        });
        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash });
        expect(receipt.success).toBe(true);
    }, 60_000);

    // ── Test 5: Agent can triggerSwap via session-signed UserOp ────────
    it("Agent can triggerSwap via UserOp after clearance", async () => {
        if (skip) return;

        // Owner grants clearance first
        const auditHash = await ownerWallet.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "requestAudit", args: [MOCK_BRETT],
        });
        const auditReceipt = await publicClient.waitForTransactionReceipt({ hash: auditHash });
        const auditLog = auditReceipt.logs.find(
            (l: any) => l.address.toLowerCase() === MODULE.toLowerCase()
        );
        const tradeId = BigInt(auditLog!.topics[1]!);

        await ownerWallet.writeContract({
            address: MODULE, abi: AEGIS_MODULE_ABI,
            functionName: "onReportDirect", args: [tradeId, 0n],
        });

        // Wait for state propagation
        let approved = false;
        for (let i = 0; i < 10; i++) {
            approved = await publicClient.readContract({
                address: MODULE, abi: AEGIS_MODULE_ABI,
                functionName: "isApproved", args: [MOCK_BRETT],
            }) as boolean;
            if (approved) break;
            await new Promise(r => setTimeout(r, 2000));
        }
        expect(approved).toBe(true);

        // Agent triggers swap via UserOp
        const safeAccount = await toSafeSmartAccount({
            client: publicClient as any,
            owners: [agentAccount],
            version: "1.4.1",
            entryPoint: { address: entryPoint07Address, version: "0.7" },
            address: SAFE_ADDR,
        });

        const agentSmartClient = createSmartAccountClient({
            account: safeAccount,
            chain: baseSepolia,
            bundlerTransport: http(PIMLICO_URL),
            paymaster: pimlicoClient,
            userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
        });

        const swapData = encodeFunctionData({
            abi: AEGIS_MODULE_ABI,
            functionName: "triggerSwap",
            args: [MOCK_BRETT, parseEther("0.001"), 1n],
        });

        const hash = await agentSmartClient.sendUserOperation({
            calls: [{ to: MODULE, data: swapData, value: 0n }],
        });
        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash });
        expect(receipt.success).toBe(true);
    }, 120_000);

    // ── Test 6: Agent CANNOT call withdrawETH ─────────────────────────
    it("Agent cannot call withdrawETH (not in session scope)", async () => {
        if (skip) return;

        const safeAccount = await toSafeSmartAccount({
            client: publicClient as any,
            owners: [agentAccount],
            version: "1.4.1",
            entryPoint: { address: entryPoint07Address, version: "0.7" },
            address: SAFE_ADDR,
        });

        const agentSmartClient = createSmartAccountClient({
            account: safeAccount,
            chain: baseSepolia,
            bundlerTransport: http(PIMLICO_URL),
            paymaster: pimlicoClient,
            userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
        });

        const withdrawData = encodeFunctionData({
            abi: AEGIS_MODULE_ABI,
            functionName: "withdrawETH",
            args: [parseEther("0.001")],
        });

        await expect(
            agentSmartClient.sendUserOperation({
                calls: [{ to: MODULE, data: withdrawData, value: 0n }],
            })
        ).rejects.toThrow();
    }, 60_000);

    // ── Test 7: Agent CANNOT call revokeAgent ─────────────────────────
    it("Agent cannot call revokeAgent (not in session scope)", async () => {
        if (skip) return;

        const safeAccount = await toSafeSmartAccount({
            client: publicClient as any,
            owners: [agentAccount],
            version: "1.4.1",
            entryPoint: { address: entryPoint07Address, version: "0.7" },
            address: SAFE_ADDR,
        });

        const agentSmartClient = createSmartAccountClient({
            account: safeAccount,
            chain: baseSepolia,
            bundlerTransport: http(PIMLICO_URL),
            paymaster: pimlicoClient,
            userOperation: { estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast },
        });

        const revokeData = encodeFunctionData({
            abi: AEGIS_MODULE_ABI,
            functionName: "revokeAgent",
            args: [agentAccount.address],
        });

        await expect(
            agentSmartClient.sendUserOperation({
                calls: [{ to: MODULE, data: revokeData, value: 0n }],
            })
        ).rejects.toThrow();
    }, 60_000);

    // ── Test 8: Session config has correct selectors ──────────────────
    it("buildAgentSession produces valid session for agent", async () => {
        if (skip) return;

        const session = buildAgentSession(
            agentAccount.address,
            MODULE,
            parseEther("0.05"),
        );

        // Verify session structure
        expect(session.sessionValidator.toLowerCase()).toBe(
            SMART_SESSIONS_VALIDATOR_ADDRESS.toLowerCase()
        );
        expect(session.actions).toHaveLength(2);
        expect(session.actions[0].actionTargetSelector).toBe(SELECTOR_REQUEST_AUDIT);
        expect(session.actions[1].actionTargetSelector).toBe(SELECTOR_TRIGGER_SWAP);
        expect(session.actions[0].actionTarget.toLowerCase()).toBe(MODULE.toLowerCase());
    });
});
