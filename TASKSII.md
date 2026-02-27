# Aegis Protocol V5: Account Abstraction (AA) Migration Plan
**Role:** Lead Web3 Account Abstraction Engineer
**Objective:** Upgrade the V4 EOA-based execution to a full ERC-4337 / ERC-7579 / ERC-7715 stack. 
**CRITICAL INVARIANT:** `AegisModule.sol` and the CRE Oracle (`cre-node/`) are PERFECT. DO NOT TOUCH THEM. We are strictly rewriting the client-side Agent and the test provisioning scripts.

## 🛑 Global Directives (NON-NEGOTIABLE)
1. **Strict TDD:** You MUST write the test file *before* writing the implementation code.
2. **Conditional Debugging:** If a test fails, you enter a "Debug Loop." You are forbidden from moving to the next task until the current test passes (max 3 attempts before asking for human help).
3. **The Ledger:** Document every `permissionless.js` or `viem` API realization in `docs/lessons_learned.md`.
4. **The Checkpoint Check-in:** Whenever you see `[CHECKPOINT]`, summarize your work, commit to Git, and proceed immediately.
5. **Read the Docs:** If you hit typing errors with Account Abstraction SDKs, use your browser tool to read `docs.pimlico.io` or `docs.rhinestone.wtf`.

---

## Phase 1: Environment & AA Dependencies
- [ ] 1.1 **Install AA SDKs:** Run `pnpm add permissionless viem @rhinestone/module-sdk`.
- [ ] 1.2 **Update Environment:** Ensure `.env.example` and `.env` have placeholders for `PIMLICO_API_KEY`.
- [ ] **[CHECKPOINT 1]** Execute `git add .` and `git commit -m "chore: install AA and Rhinestone dependencies for V5"`. Proceed to next phase.

---

## Phase 2: Safe Account & Module Provisioning
*Context: We need a script to deploy a Safe Smart Account and install our `AegisModule` onto it as an ERC-7579 Executor.*

- [ ] 2.1 **Write the Test (`test/safe_setup.spec.ts`):** Write a test using a local Anvil client that deploys a Safe using `@rhinestone/module-sdk` and asserts that `isModuleInstalled` returns true for `AegisModule`.
- [ ] 2.2 **Write Implementation (`scripts/v5_setup_safe.ts`):** - Create a script that initializes a `SafeSmartAccountClient`.
  - Use Rhinestone's `installModule` to attach `AegisModule` (Type 2: Executor).
  - Print the deployed Safe address to the console.
- [ ] 2.3 **The Debug Loop:** Run the script against local Anvil. Resolve any bundler or deployment RPC errors.
- [ ] **[CHECKPOINT 2]** Execute `git commit -m "feat(aa): implement Safe deployment and module installation script"`. Proceed to next phase.

---

## Phase 3: The Bot Refactor (UserOperations)
*Context: `bot.ts` must no longer use `walletClient.sendTransaction`. It must use `smartAccountClient.sendUserOperation`.*

- [ ] 3.1 **Write the Test (`test/bot_v5.spec.ts`):** Mock a `smartAccountClient`. Write a test asserting that `requestAudit` and `triggerSwap` are formatted as `UserOperations` targeting the Safe's `execute` function, NOT directly targeting the module.
- [ ] 3.2 **Refactor `src/agent/bot.ts`:**
  - Initialize `createSmartAccountClient` from `permissionless`.
  - Pass the AI Agent's private key as the `signer` (acting as the session key).
  - Update `buildRequestAuditCalldata` to wrap the call in an ERC-4337 UserOp format.
  - The `to` address of the UserOp is the *Safe Account*, and the `data` routes to the `AegisModule`.
- [ ] 3.3 **The Debug Loop:** Run tests. Ensure viem types align with permissionless types. Log fixes in `lessons_learned.md`.
- [ ] **[CHECKPOINT 3]** Execute `git commit -m "feat(agent): refactor bot to submit ERC-4337 UserOperations"`. Proceed to next phase.

---

## Phase 4: V5 Local E2E Simulation (Mocked Oracle)
*Context: Prove the UserOp successfully travels through the Safe, hits the Module, and pauses for the Oracle.*

- [ ] 4.1 **Create `scripts/v5_e2e_mock.ts`:** - Copy `e2e_mock_simulation.ts`.
  - Replace the direct `sendTransaction` calls with `bot.ts`'s new `sendUserOperation` logic.
  - Verify the UserOp successfully emits `AuditRequested` from the module.
  - Mock the oracle callback exactly as before.
  - Verify the second UserOp (`triggerSwap`) successfully executes the swap.
- [ ] 4.2 **The Debug Loop:** Run against local Anvil. Fix gas estimation or bundler simulation errors.
- [ ] **[CHECKPOINT 4]** Execute `git commit -m "test(e2e): verify V5 UserOp execution loop with mocked oracle"`. Proceed to next phase.

---

## Phase 5: Live Integration (The Final Boss)
*Context: We connect the V5 AA plumbing to the real Chainlink CRE Docker node.*

- [ ] 5.1 **Update Live Script:** Modify `scripts/live_e2e.ts` to use the V5 AA bot logic.
- [ ] 5.2 **Execution:** Run the script while the CRE Docker container is active. 
- [ ] 5.3 **Verification:** Ensure the CRE node successfully intercepts the `AuditRequested` event triggered by the UserOperation, and that the Smart Account successfully executes the Uniswap swap after clearance.
- [ ] **[FINAL CHECKPOINT]** Execute `git commit -m "feat(v5): complete full account abstraction migration"`.