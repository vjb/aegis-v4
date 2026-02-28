# 📦 Aegis V4 — Smart Contracts & Off-Chain Logic

This directory contains the core implementation of the Aegis V4 protocol.

## Smart Contracts (`src/*.sol`)

### `AegisModule.sol` ← The Core
An **ERC-7579 Type-2 Executor Module** that installs onto any ERC-7579-compatible Smart Account (e.g., Safe, Kernel).

**Key properties:**
- Holds **zero funds** — all capital stays in the Smart Account
- Gated by `keystoneForwarder` — only Chainlink can grant clearance
- Clearance is **single-use** (CEI pattern — prevents replay attacks)
- Fully tested with 7 Forge TDD tests

**Functions:**

| Function | Caller | Purpose |
|---|---|---|
| `requestAudit(address token)` | Agent / Smart Account | Emits `AuditRequested`, starts oracle pipeline |
| `onReport(uint256 tradeId, uint256 riskScore)` | KeystoneForwarder ONLY | Grants or denies clearance |
| `triggerSwap(address token, uint256 amount)` | Agent / Smart Account | Executes swap if cleared |
| `onInstall(bytes)` / `onUninstall(bytes)` | Smart Account | ERC-7579 lifecycle hooks |

**Deployed:** `0xE5D4716ba20DefCc50C863952474A0edc3574A2B` (Base Sepolia)

---

### `ExecutorTemplate.sol`, `ValidatorTemplate.sol`, `HookTemplate.sol`
Rhinestone module-template scaffolding. Not used in production — reference only.

---

## Oracle (`src/oracle/aegis-oracle.ts`)

The **Chainlink CRE workflow** that runs the 3-phase audit off-chain:

1. **GoPlus** — node-mode BFT median consensus on static token analysis
2. **BaseScan + Confidential HTTP** — source code retrieval (API key never leaves the DON)
3. **GPT-4o + Llama-3** — dual-model AI consensus (union-of-fears logic)

Delivers `onReport(tradeId, riskScore)` to `AegisModule` via KeystoneForwarder.

See [cre-node/README.md](../cre-node/README.md) for oracle setup.

---

## Agent (`src/agent/bot.ts`)

The **BYOA (Bring Your Own Agent)** trading bot. Implements the capital separation guarantee:

```
Agent Wallet  →  holds GAS only
Smart Account →  holds trading capital
```

**Exported functions:**
- `buildRequestAuditCalldata(token)` — encodes `requestAudit()` calldata
- `buildTriggerSwapCalldata(token, amount)` — encodes `triggerSwap()` calldata
- `pollForClearance(publicClient, moduleAddress, token, fromBlock)` — polls for oracle verdict

---

## Running Tests

```bash
# Forge (Solidity)
forge test --match-contract AegisModuleTest -vv
# Expected: 7 passed, 0 failed

# Jest (TypeScript)
pnpm exec jest
# Expected: 12 passed, 0 failed
```

## Test Coverage

| Test File | Tests | What's Covered |
|---|---|---|
| `test/AegisModule.t.sol` | 7 | requestAudit event, onReport clearance/denial, keystoneForwarder guard, triggerSwap CEI, tradeId increment, executeFromExecutor |
| `test/oracle.spec.ts` | 6 | ABI encoding (uint256,uint256), riskScore bits, oracle config shape |
| `test/bot.spec.ts` | 6 | Config validation, calldata encoding, BYOA capital separation, risk bit decoding, polling timeout |
