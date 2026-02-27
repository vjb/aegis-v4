# 🧪 Aegis V4 — Scripts

Operational scripts for provisioning, testing, and running the Aegis V4 protocol.

## Scripts

### `new_tenderly_testnet.ps1` — One-Command VNet Provisioner
Creates a fresh Tenderly Virtual Testnet (Base mainnet fork), deploys `AegisModule`, funds test wallets, and updates all config files.

```powershell
.\scripts\new_tenderly_testnet.ps1
```

**What it does:**
1. Creates a new Tenderly VNet via API
2. Updates `.env` with new `TENDERLY_RPC_URL`
3. Funds deployer (100 ETH) + agent (10 ETH) via `tenderly_setBalance`
4. Deploys `AegisModule` with your `PRIVATE_KEY`
5. Updates `AEGIS_MODULE_ADDRESS` in `.env`
6. Updates `cre-node/config.json` with new module address

**Requires in `.env`:** `TENDERLY_KEY`, `DEV_WALLET_ADDRESS`, `PRIVATE_KEY`

---

### `start_oracle.ps1` — CRE Oracle Docker Launcher
Updates the CRE node config and starts the Chainlink CRE Docker environment.

```powershell
.\scripts\start_oracle.ps1
```

**What it does:**
1. Reads `TENDERLY_RPC_URL` and `AEGIS_MODULE_ADDRESS` from `.env`
2. Updates `cre-node/config.json` with current module address
3. Starts `docker compose up --build -d`
4. Tails container logs

---

### `e2e_mock_simulation.ts` — E2E Test (Mocked Oracle)
Proves the full module lifecycle end-to-end using Anvil impersonation to mock the oracle callback.

```bash
pnpm ts-node scripts/e2e_mock_simulation.ts
```

**Flow:**
1. Agent calls `requestAudit(token)` on-chain
2. **MOCKS** the CRE callback: impersonates `keystoneForwarder`, calls `onReport(tradeId, 0)`
3. Agent calls `triggerSwap(token, amount)`
4. Asserts clearance was consumed (anti-replay) ✅

> **Validation Mode:** If `AEGIS_MODULE_ADDRESS` is not set, runs assertion logic only (no RPC needed).

---

### `live_e2e.ts` — E2E Test (Real CRE Oracle)
The production-grade integration test. Does NOT mock anything — waits for the real Chainlink CRE node to call `onReport`.

```bash
pnpm ts-node scripts/live_e2e.ts
```

**Prerequisites:**
1. Anvil running (`anvil --block-time 1`) OR Tenderly VNet
2. CRE Docker node running (`.\scripts\start_oracle.ps1`)
3. `AEGIS_MODULE_ADDRESS` set in `.env`

**Timeout:** 5 minutes. Polls every 1 second for `ClearanceUpdated` or `ClearanceDenied` events.

---

## Environment Setup

Copy `.env.example` to `.env` and fill in:

```bash
# Tenderly VNet
TENDERLY_KEY=...
TENDERLY_RPC_URL=...
DEV_WALLET_ADDRESS=...
PRIVATE_KEY=...

# V4 Module (set by new_tenderly_testnet.ps1)
AEGIS_MODULE_ADDRESS=...

# AI APIs (for CRE oracle)
OPENAI_API_KEY=...
GROQ_API_KEY=...
BASESCAN_API_KEY=...

# Account Abstraction
PIMLICO_API_KEY=...
```
