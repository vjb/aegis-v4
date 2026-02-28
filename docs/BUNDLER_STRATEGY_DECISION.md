# Bundler Strategy Decision: Pimlico Cloud vs. Direct `handleOps`

## Context

Aegis V5 migrates the Smart Treasury from raw `sendTransaction` calls to ERC-4337 Account Abstraction. This requires a **bundler** — a service that receives `UserOperation` structs, validates them, and submits them to the `EntryPoint.handleOps()` contract.

During development, we evaluated three bundler strategies. This document records the decision-making process and the final outcome.

> **V5 Outcome:** Option A (Pimlico Cloud Bundler on Base Sepolia) was selected for the final hackathon demo. Direct `handleOps` (Option C) was used as a stepping stone during Tenderly development.

---

## The Problem

Alto bundler requires `debug_traceCall` with a custom JavaScript tracer to enforce ERC-4337's off-chain simulation rules (opcode banning, storage access restrictions). Tenderly VNets do not expose `debug_traceCall`, returning `"not supported"`. This makes Alto fundamentally incompatible with Tenderly as a backing node.


---

## Options Evaluated

### Option A: Deploy on Base Sepolia with Pimlico's Hosted Bundler ✅ (Selected for V5)

| Aspect | Detail |
|---|---|
| **How it works** | Use Pimlico's public bundler API (`api.pimlico.io`) targeting the live Base Sepolia testnet |
| **Pros** | Full ERC-4337 compliance (on-chain + off-chain). All Safe infrastructure pre-deployed. Production-grade gas estimation. Real public testnet — judges can verify. |
| **Cons** | Requires a Pimlico API key. Requires Base Sepolia ETH. Every tx is a real L2 transaction. |
| **Verdict** | **Selected for final V5 demo.** Full public testnet with real ERC-4337 compliance. |

---

### Option B: Use Anvil (Local Foundry Node) Instead of Tenderly

| Aspect | Detail |
|---|---|
| **How it works** | Run `anvil --fork-url <base_sepolia_rpc>` locally. Anvil supports `debug_traceCall`. |
| **Pros** | Full `debug_traceCall` support. Alto bundler works natively. Fast local iteration. Free. |
| **Cons** | Loses Tenderly's persistent state, dashboard UI, and shared team access. Must restart anvil between demo runs (no persistent VNet). Fork state diverges from Tenderly's Base fork. Have to redeploy all contracts on each restart. |
| **Verdict** | Viable but adds operational complexity. Good for CI/CD testing, less ideal for live demos. |

---

### Option C: Direct `handleOps()` Submission (Used during Tenderly development)

| Aspect | Detail |
|---|---|
| **How it works** | Build the `PackedUserOperation` struct locally, sign it with the owner's ECDSA key, and submit `EntryPoint.handleOps([packedOp], beneficiary)` as a standard Ethereum transaction from the owner wallet. |
| **Pros** | Full on-chain ERC-4337 compliance. Works on any RPC. No external dependencies. Fastest iteration speed. |
| **Cons** | No off-chain mempool simulation. Owner wallet acts as centralized bundler. |
| **Verdict** | Used as a stepping stone during Tenderly development. Superseded by Option A for the final demo. |

---

## Key Insight: On-Chain vs. Off-Chain Compliance

The ERC-4337 spec defines two layers:

1. **On-chain protocol** — `EntryPoint.handleOps()`, `validateUserOp()`, gas accounting, nonce management, signature verification. This is the **architecture**.
2. **Off-chain mempool rules** — Opcode banning (`SELFDESTRUCT`, `GASPRICE`), storage access restrictions, `debug_traceCall` simulation. This is **bundler infrastructure**.

When we submit `handleOps()` directly, we preserve the entire on-chain protocol. The transaction trace is indistinguishable from one submitted by a real bundler. What we skip is the off-chain simulation — which is equivalent to running a private/centralized bundler, something that Alchemy, Biconomy, and Pimlico themselves do in production.

---

## Implementation

The `v5_setup_safe.ts` script:
1. Builds the `UserOperation` struct using `permissionless.js` (`toSafeSmartAccount`)
2. Signs it with the owner's private key via Safe's EIP-712 typed data
3. Packs it into the `PackedUserOperation` format (0.7 EntryPoint)
4. Calls `EntryPoint.handleOps([packedOp], owner)` as a standard transaction
5. Verifies the Safe deployed and module installed via `isModuleInstalled()`
