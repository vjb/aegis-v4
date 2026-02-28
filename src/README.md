# 📦 Aegis V5 — Smart Contracts & Off-Chain Logic

This directory contains the core implementation of the Aegis V5 protocol.

## Smart Contracts (`src/*.sol`)

### `AegisModule.sol` ← The Core
An **ERC-7579 Type-2 Executor Module** that installs onto any ERC-7579-compatible Smart Account (e.g., Safe, Kernel).

**Key properties:**
- Holds **zero funds** — all capital stays in the Smart Account
- Gated by `keystoneForwarder` — only Chainlink can grant clearance
- Clearance is **single-use** (CEI pattern — prevents replay attacks)
- Per-agent budget enforcement — smart contract mathematically caps spend
- Fully tested with 18 Forge TDD tests

**Functions:**

| Function | Caller | Purpose |
|---|---|---|
| `depositETH()` | Owner | Deposits ETH into the module treasury |
| `subscribeAgent(address, uint256)` | Owner | Grants agent a budget-capped trading allowance |
| `revokeAgent(address)` | Owner | Kill switch — zeros the agent's budget |
| `killSwitch()` | Owner | Emergency — zeros ALL agent budgets |
| `setFirewallConfig(string)` | Owner | Sets AI firewall policy applied to every audit |
| `requestAudit(address token)` | Agent / Owner | Emits `AuditRequested`, starts oracle pipeline |
| `onReport(bytes, bytes)` | KeystoneForwarder | CRE callback — grants or denies clearance |
| `onReportDirect(uint256, uint256)` | Forwarder / Owner | Demo relay — simplified oracle callback |
| `triggerSwap(address, uint256, uint256)` | Agent / Owner | JIT execution — requires clearance + budget |
| `withdrawETH(uint256)` | Owner | Withdraws ETH from treasury |
| `withdrawERC20(address, uint256)` | Owner | Withdraws ERC-20 tokens from treasury |
| `onInstall(bytes)` / `onUninstall(bytes)` | Smart Account | ERC-7579 lifecycle hooks |

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
Agent Wallet  →  holds GAS only (ERC-7715 session key)
Smart Account →  holds trading capital
Session Key   →  scoped to requestAudit + triggerSwap ONLY
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
# Expected: 18 passed, 0 failed

# Jest (TypeScript)
pnpm exec jest
# Expected: 83 passed, 1 skipped (7 suites)
```

## Test Coverage

| Test File | Tests | What's Covered |
|---|---|---|
| `test/AegisModule.t.sol` | 18 | requestAudit, onReport clearance/denial, keystoneForwarder guard, triggerSwap CEI, budget enforcement, tradeId increment, subscribeAgent, revokeAgent, killSwitch |
| `test/oracle.spec.ts` | 12 | ABI encoding, riskScore bits, oracle config, AI JSON parsing |
| `test/bot.spec.ts` | 6 | Config validation, calldata encoding, BYOA capital separation, risk bit decoding |
| `test/bot_v5.spec.ts` | 9 | V5 call builders, module targeting, zero-value, selectors, triggerSwap 3-param |
| `test/safe_setup.spec.ts` | 7 | Safe config, module config, EntryPoint constant, integration gate |
| `test/session_key.spec.ts` | 14 | SmartSessionValidator, selectors, buildAgentSession, SmartSessionMode |
| `test/live_e2e.spec.ts` | 5 | Live Base Sepolia: requestAudit → onReportDirect → triggerSwap → revert |
| `test/frontend.spec.ts` | 26 | Wallet, session key rendering, oracle feed SSE parsing |
