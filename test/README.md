# 🧪 Aegis V4 — Test Suite

Full TDD test suite for the Aegis V4 protocol. All tests were written **before** the implementation code (per Global Directive).

## Running Tests

```bash
# Solidity (Forge)
forge test --match-contract AegisModuleTest -vv

# TypeScript (Jest)
pnpm exec jest --config jest.config.json
```

## Test Files

### Solidity (Forge)

| Test | What It Tests |
|---|---|
| `AegisModule.t.sol` | Full module lifecycle — 7 tests |
| `ExecutorTemplate.t.sol` | Template scaffold (reference) |
| `ValidatorTemplate.t.sol` | Template scaffold (reference) |
| `HookTemplate.t.sol` | Template scaffold (reference) |

**`AegisModule.t.sol` test breakdown:**
1. `test_requestAudit_emitsEvent` — AuditRequested event emitted with correct tradeId
2. `test_onReport_clearance` — riskScore=0 sets `isApproved[token]=true`
3. `test_onReport_denial` — riskScore>0 emits ClearanceDenied
4. `test_onReport_keystoneGuard` — non-forwarder caller reverts with `NotKeystoneForwarder`
5. `test_triggerSwap_requiresClearance` — swap with no clearance reverts `TokenNotCleared`
6. `test_triggerSwap_consumesClearance` — clearance is consumed (anti-replay CEI pattern)
7. `test_tradeId_increment` — sequential tradeIds (1, 2, 3...)

### TypeScript (Jest)

| Test | What It Tests |
|---|---|
| `oracle.spec.ts` | ABI encoding, riskScore bit decoding, oracle config shape — 6 tests |
| `bot.spec.ts` | Agent calldata encoding, BYOA capital separation, polling timeout — 6 tests |

## Current Status

```
forge test --match-contract AegisModuleTest
  ✅ 7 passed, 0 failed

pnpm exec jest
  ✅ 12 passed, 0 failed
```
