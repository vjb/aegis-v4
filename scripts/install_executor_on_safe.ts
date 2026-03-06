/**
 * Deploy a NEW Safe with AegisModule pre-installed as an ERC-7579 Executor.
 * 
 * Uses the same Safe7579 launchpad pattern as v5_install_session_validator.ts
 * but adds AegisModule to the executors array during Safe creation.
 * 
 * This is INDEPENDENT of the existing Safe at 0xC006...
 * 
 * Usage: pnpm ts-node --transpile-only scripts/install_executor_on_safe.ts
 */
// @ts-nocheck
import {
    createPublicClient,
    createWalletClient,
    http,
    getAddress,
    type Address,
    type Hex,
} from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { erc7579Actions } from "permissionless/actions/erc7579";
import { entryPoint07Address } from "viem/account-abstraction";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";

dotenv.config();

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const PIMLICO_API_KEY = process.env.PIMLICO_API_KEY!;
const PIMLICO_URL = `https://api.pimlico.io/v2/84532/rpc?apikey=${PIMLICO_API_KEY}`;
const ENTRYPOINT_V07 = entryPoint07Address as Address;

// Safe 7579 adapter addresses (canonical, deployed on all EVM chains)
const SAFE_4337_MODULE = "0x7579EE8307284F293B1927136486880611F20002" as Address;
const ERC7579_LAUNCHPAD = "0x7579011aB74c46090561ea277Ba79D510c6C00ff" as Address;
const RHINESTONE_ATTESTER = "0x000000333034E9f539ce08819E12c1b8Cb29084d" as Address;

async function main() {
    const ownerPk = process.env.PRIVATE_KEY as Hex;
    if (!ownerPk) { console.error("❌ Missing PRIVATE_KEY"); process.exit(1); }
    if (!PIMLICO_API_KEY) { console.error("❌ Missing PIMLICO_API_KEY"); process.exit(1); }

    // Read new module address
    const addrFile = path.join(__dirname, "../NEW_MODULE_ADDRESS.txt");
    const addrContent = fs.readFileSync(addrFile, "utf-8");
    const match = addrContent.match(/NEW_AEGIS_MODULE=(0x[a-fA-F0-9]+)/);
    if (!match) { console.error("❌ Could not find NEW_AEGIS_MODULE in NEW_MODULE_ADDRESS.txt"); process.exit(1); }
    const newModuleAddress = getAddress(match[1]) as Address;

    const owner = privateKeyToAccount(ownerPk);

    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  🛡️  Install AegisModule as ERC-7579 Executor on NEW Safe");
    console.log("  (via toSafeSmartAccount executors array — initializeAccount)");
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  Owner:      ${owner.address}`);
    console.log(`  New Module: ${newModuleAddress}`);
    console.log(`  Attester:   ${RHINESTONE_ATTESTER}`);
    console.log("");

    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });

    const pimlicoClient = createPimlicoClient({
        chain: baseSepolia,
        transport: http(PIMLICO_URL),
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
    });

    // ── Phase 1: Create Safe with AegisModule pre-installed as executor ──
    const salt = BigInt(Date.now());
    console.log(`[1/3] Creating Safe with AegisModule as executor (salt: ${salt})...`);

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [owner],
        version: "1.4.1",
        entryPoint: { address: ENTRYPOINT_V07, version: "0.7" },
        safe4337ModuleAddress: SAFE_4337_MODULE,
        erc7579LaunchpadAddress: ERC7579_LAUNCHPAD,
        // Disable attestation check — allows custom (non-Rhinestone) modules
        // In production, you'd submit the module for Rhinestone attestation
        attesters: [],
        attestersThreshold: 0,
        saltNonce: salt,
        // Pre-install AegisModule as an executor during Safe creation
        executors: [
            {
                address: newModuleAddress,
                context: "0x" as Hex,  // initData passed to onInstall
            },
        ],
    });

    console.log(`  Safe (counterfactual): ${safeAccount.address}`);

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: baseSepolia,
        bundlerTransport: http(PIMLICO_URL),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    }).extend(erc7579Actions());

    // ── Phase 2: Deploy Safe (first UserOp) ──────────────────────────────
    console.log(`[2/3] Deploying Safe via UserOp...`);

    const deployHash = await smartAccountClient.sendUserOperation({
        calls: [{ to: safeAccount.address, data: "0x" as Hex, value: 0n }],
    });

    console.log(`  UserOp: ${deployHash}`);
    const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: deployHash });
    console.log(`  ✅ Safe deployed in block ${receipt.receipt.blockNumber}`);
    console.log(`  Tx: ${receipt.receipt.transactionHash}`);

    // Wait for RPC sync
    await new Promise(r => setTimeout(r, 3000));

    // ── Phase 3: Verify Module Installation ──────────────────────────────
    console.log(`[3/3] Verifying module installation...`);

    const isExecutorInstalled = await smartAccountClient.isModuleInstalled({
        type: "executor",
        address: newModuleAddress,
        context: "0x" as Hex,
    });

    console.log(`  AegisModule is installed as executor: ${isExecutorInstalled ? "✅ YES" : "❌ NO"}`);

    // Check if onInstall set the owner to the Safe
    const moduleOwner = await publicClient.readContract({
        address: newModuleAddress,
        abi: [{ name: "owner", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }],
        functionName: "owner",
    });
    console.log(`  AegisModule.owner() = ${moduleOwner}`);
    console.log(`  Safe address         = ${safeAccount.address}`);
    const ownerIsSafe = (moduleOwner as string).toLowerCase() === safeAccount.address.toLowerCase();
    console.log(`  Owner matches Safe:    ${ownerIsSafe ? "✅ YES" : "❌ NO"}`);

    // ── Results ──────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    if (isExecutorInstalled && ownerIsSafe) {
        console.log("  🎉 SUCCESS — AegisModule INSTALLED as ERC-7579 Executor");
        console.log("  The Safe recognizes AegisModule as an installed executor.");
        console.log("  AegisModule.owner() is the Safe address.");
    } else if (isExecutorInstalled) {
        console.log("  ⚠️  PARTIAL — Module installed but owner didn't transfer");
    } else {
        console.log("  ❌ FAILED — Module is NOT installed on the Safe");
    }
    console.log("═══════════════════════════════════════════════════════════════");
    console.log(`  NEW_SAFE=${safeAccount.address}`);
    console.log(`  NEW_MODULE=${newModuleAddress}`);
    console.log(`  EXECUTOR_INSTALLED=${isExecutorInstalled}`);
    console.log(`  OWNER_IS_SAFE=${ownerIsSafe}`);

    // Save results
    const resultFile = path.join(__dirname, "../NEW_SAFE_ADDRESS.txt");
    fs.writeFileSync(resultFile, `NEW_SAFE=${safeAccount.address}\nNEW_MODULE=${newModuleAddress}\nEXECUTOR_INSTALLED=${isExecutorInstalled}\nOWNER_IS_SAFE=${ownerIsSafe}\n`);
    console.log(`  Results saved to: NEW_SAFE_ADDRESS.txt\n`);
}

main().catch(err => { console.error("💥", err.message || err); process.exit(1); });
