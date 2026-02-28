# Aegis Protocol V5: Account Abstraction (AA) Migration Plan
**Role:** Lead Web3 Account Abstraction Engineer
**Objective:** Upgrade the V4 EOA-based execution to a full ERC-4337 / ERC-7579 / ERC-7715 stack.

---

## ✅ Completed Phases

### Phase 1: Environment & AA Dependencies
- [x] Installed `permissionless`, `viem`, `@rhinestone/module-sdk`
- [x] Added `PIMLICO_API_KEY`, `SAFE_ADDRESS` to `.env`

### Phase 2: Safe Account & Module Provisioning
- [x] `test/safe_setup.spec.ts` — 6 unit + 1 integration test
- [x] `scripts/v5_safe_config.ts` — pure Rhinestone module builders
- [x] `scripts/v5_setup_safe.ts` — full Safe deploy + module install flow

### Phase 3: Session Key Validator
- [x] `scripts/v5_session_config.ts` — `buildAgentSession`, selectors
- [x] `test/session_key.spec.ts` — 14/14 passing

### Phase 4: Bot Refactor (UserOperations)
- [x] `scripts/v5_bot_config.ts` — pure call builders (`requestAudit`, `triggerSwap`)
- [x] `test/bot_v5.spec.ts` — all passing
- [x] `src/agent/bot.ts` — rewrote to `sendUserOperation` format

### Phase 5a: Tenderly + Local Bundler (ABANDONED)
- [x] Alto bundler → failed (`debug_traceCall` unsupported on Tenderly)
- [x] Direct Bundler Mock → failed (EP 0.7 PackedUserOp encoding too complex)
- [x] Documented in `docs/BUNDLER_STRATEGY_DECISION.md`

### Phase 5b: Base Sepolia + Pimlico Pivot ✅
- [x] Reverted `bot.ts` → `smartAccountClient.sendUserOperation` via Pimlico
- [x] Rewrite `v5_setup_safe.ts` + `v5_e2e_mock.ts` for Pimlico
- [x] Created `script/DeployMocks.s.sol` (MockBRETT + MockHoneypot + AegisModule)
- [x] Mocked Uniswap swap in `AegisModule.sol`
- [x] Deployed all contracts to Base Sepolia
- [x] **Full E2E test PASSED — all 5 phases on Base Sepolia** ✅
- [x] [CHECKPOINT 5b] commit + push `a4f469b`

---

## 🔄 Active Phases

### Phase 5.5: Core TDD Verification ✅
- [x] 5.5.1 Smart Contract Tests (`test/AegisModule.t.sol`): **18/18 pass**
      a) `triggerSwap` reverts `TokenNotCleared` if not audited ✅
      b) `triggerSwap` succeeds (mock SwapExecuted) if oracle approved ✅
      c) Access control: subscribeAgent onlyOwner, triggerSwap budget guard ✅
- [x] 5.5.2 Session Key Constraints (`test/bot_v5.spec.ts`): **6 new tests pass**
      ERC-7715 session scoped to AegisModule + 2 selectors only ✅
- [x] 5.5.3 Oracle Formatting Test (`test/oracle.spec.ts`): **4 new tests pass**
      AI JSON `{"risk": 5}` → correct hex for `onReportDirect` ✅

### Phase 6: Live CRE Integration (Base Sepolia)
- [ ] 6.1 Update CRE node config to point at Base Sepolia
- [ ] 6.2 Oracle Mock Mapping: `MOCK_REGISTRY` maps `MockHoneypot` to malicious string
- [ ] 6.3 Live E2E Test (`test/live_e2e.spec.ts`): UserOp → CRE → oracle → swap/revert
- [ ] 6.4 [CHECKPOINT] commit + push

### Phase 7: Cinematic Hackathon Demo Scripts
Two highly stylized PowerShell scripts for the final Loom video.
- Colors: Cyan=banners, Yellow=scene headers, Green=success, Red=reverts, Magenta=AI logs, DarkGray=narrative
- Both accept `-Interactive` flag with `Pause-Demo` (`Read-Host`)

- [ ] 7.1 `scripts/demo_v5_setup.ps1` (Act 0: Infrastructure Boot):
      - Banner: "⚙️ AEGIS PROTOCOL V5 · ACT 0: INFRASTRUCTURE BOOT"
      - Scene 1 (Sandbox): `docker compose up --build -d` with scrolling build logs
      - Scene 2 (Compilation): `docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"` — WASM compilation
      - Scene 3 (Network): `cast chain-id --rpc-url https://sepolia.base.org` — prove Base Sepolia connectivity
      - Outro: "✅ INFRASTRUCTURE LIVE ON BASE SEPOLIA"

- [ ] 7.2 `scripts/demo_v5_master.ps1` (Act 1: The God Mode Demo):
      - Banner: "🚀 AEGIS PROTOCOL V5 · THE INSTITUTIONAL AI FIREWALL"
      - Scene 1 (Bank): `cast balance` Safe + AegisModule — zero-custody treasury proof
      - Scene 2 (Keys): Simulate ERC-7715 session key provisioning, print hex selectors
      - Scene 3 (Intents): `bot.ts audit <MockBRETT>` + `bot.ts audit <MockHoneypot>` via Pimlico — print UserOp hashes
      - Scene 4 (AI Oracle — Climax): CRE `workflow simulate`, color-coded output:
        Confidential HTTP, LLM prompts, malicious Solidity, "Risk Code: 5" in Magenta.
        `cast send` `onReportDirect` verdict to chain
      - Scene 5 (Execution): MockBRETT swap success ✅, MockHoneypot swap revert `TokenNotCleared` ❌
      - Outro: "✅ DEMO COMPLETE: 100% ON-CHAIN AI FIREWALL ENFORCEMENT"

### Phase 8: Frontend Integration TDD
- [ ] 8.1 UI Component Tests (Safe address + session key rendering)
- [ ] 8.2 Oracle Feed Tests (UserOp audit requests + risk scores)
- [ ] 8.3 Implement UI to pass tests
- [ ] 8.4 [FINAL CHECKPOINT] commit + push

---

## Architecture (Post-Pivot)

```
┌─────────────┐    UserOp     ┌──────────────┐   handleOps   ┌────────────┐
│  AI Agent   │──────────────▶│   Pimlico    │──────────────▶│ EntryPoint │
│  (bot.ts)   │  via SDK      │  Cloud       │  on-chain     │   0.7      │
│  Session Key│               │  Bundler     │               │            │
└─────────────┘               └──────────────┘               └─────┬──────┘
                                                                   │
                                                          ┌────────▼───────┐
                                                          │  Safe Proxy    │
                                                          │  (Smart Acct)  │
                                                          │  + 4337 Module │
                                                          └────────┬───────┘
                                                                   │
                                                          ┌────────▼───────┐
                                                          │ AegisModule    │
                                                          │ (ERC-7579)     │
                                                          │ requestAudit() │
                                                          │ triggerSwap()  │
                                                          └────────────────┘
```