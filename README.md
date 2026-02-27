# 🛡️ Aegis Protocol V4: The Institutional AI Firewall

> **ERC-7579 Executor Module · Chainlink CRE Oracle · Account Abstraction (ERC-4337)**
>
> *Aegis is a zero-custody AI security firewall that installs onto your Smart Account and mathematically constrains what an autonomous AI agent can do with your capital.*

[![Forge Tests](https://img.shields.io/badge/forge%20tests-7%20passing-brightgreen)](test/AegisModule.t.sol)
[![Jest Tests](https://img.shields.io/badge/jest%20tests-12%20passing-brightgreen)](test/)
[![CRE Live](https://img.shields.io/badge/chainlink%20CRE-live%20simulation%20passing-blue)](cre-node/)
[![ERC-7579](https://img.shields.io/badge/ERC--7579-executor-orange)](src/AegisModule.sol)

---

## 🚨 The Problem: The Briefcase of Cash

Giving an autonomous AI trading agent your private key is like handing a robot a briefcase full of cash and hoping it doesn't get robbed or manipulated. Every Eliza agent, every sniper bot operating today does exactly this.

**Aegis V4 takes a completely different approach.**

---

## 🏦 The Solution: The Corporate Bank Account

Think of your wallet as a **Corporate Bank Account**. The AI agent is issued a restricted **Corporate Credit Card** (an ERC-7715 Session Key). The Aegis Protocol is the **Compliance Department** that sits between every trade intent and execution.

```
AI Agent (Session Key / UserOp)
         │
         ▼
   Smart Account  ──── ERC-4337 EntryPoint
         │
         ▼
   AegisModule (ERC-7579 Executor)
         │
    requestAudit(token) ──── emits AuditRequested
         │
         ▼
   Chainlink CRE DON
   [GoPlus + GPT-4o + Llama-3]
         │
    onReport(tradeId, riskScore=0)
         │
         ▼
   triggerSwap() ──── executeFromExecutor()
         │
         ▼
   Smart Account executes Uniswap swap
   (Zero capital ever touches the module)
```

**Security invariant:** The module holds **zero funds**. All capital stays in the Smart Account. The agent cannot move money without Chainlink CRE clearance.

---

## 🔬 Live Integration Status

| Component | Status | Evidence |
|---|---|---|
| `AegisModule.sol` (ERC-7579) | ✅ **Deployed** | `0xE5D4716ba20DefCc50C863952474A0edc3574A2B` on Base VNet |
| Forge Tests | ✅ **7/7 passing** | `forge test --match-contract AegisModuleTest` |
| Jest Tests | ✅ **12/12 passing** | `pnpm exec jest` |
| Chainlink CRE Live Simulate | ✅ **Passing** | `AuditRequested → GoPlus → riskScore=1 → onReport delivered` |
| E2E Mock Simulation | ✅ **Passing** | `npx ts-node scripts/e2e_mock_simulation.ts` |

---

## 🗂️ Repository Structure

```
aegis-v4/
├── src/
│   ├── AegisModule.sol          # ← The core ERC-7579 executor module
│   ├── oracle/
│   │   └── aegis-oracle.ts      # ← Chainlink CRE DON oracle workflow
│   └── agent/
│       └── bot.ts               # ← BYOA agent (ERC-4337 UserOp builder)
│
├── test/
│   ├── AegisModule.t.sol        # ← 7 Forge TDD tests (run before implementation)
│   ├── oracle.spec.ts           # ← 6 Jest tests (ABI encoding, risk matrix)
│   └── bot.spec.ts              # ← 6 Jest tests (calldata, BYOA safety)
│
├── cre-node/                    # ← Chainlink CRE oracle node configuration
│   ├── aegis-oracle.ts          # ← Oracle workflow entry point
│   ├── workflow.yaml            # ← CRE workflow config (--target tenderly-fork)
│   ├── project.yaml             # ← CRE project config (chain + RPC)
│   ├── config.json              # ← Runtime config (AegisModule address)
│   └── secrets.yaml             # ← Maps secret IDs to .env vars
│
├── scripts/
│   ├── new_tenderly_testnet.ps1 # ← One-command VNet provisioner (V4)
│   ├── start_oracle.ps1         # ← Starts Chainlink CRE Docker node
│   ├── e2e_mock_simulation.ts   # ← E2E test with mocked oracle
│   └── live_e2e.ts              # ← E2E test with real CRE node
│
├── docs/
│   ├── ERC7579_ROADMAP.md       # ← Architecture deep-dive
│   └── lessons_learned.md       # ← Engineering ledger (bugs + fixes)
│
└── docker-compose.yaml          # ← CRE oracle Docker environment
```

---

## ⚡ Quickstart

### Prerequisites
- [Foundry](https://book.getfoundry.sh/) (`forge`, `cast`)
- [pnpm](https://pnpm.io/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- Tenderly account + API key (for VNet)

### 1. Install dependencies
```bash
pnpm install
```

### 2. Run smart contract tests
```bash
forge test --match-contract AegisModuleTest -vv
# Expected: 7 passed, 0 failed
```

### 3. Run TypeScript tests
```bash
pnpm exec jest
# Expected: 12 passed, 0 failed
```

### 4. Provision a fresh Tenderly VNet & deploy AegisModule
```powershell
cp .env.example .env   # Fill in your keys
.\scripts\new_tenderly_testnet.ps1
```

### 5. Start the Chainlink CRE oracle node
```powershell
.\scripts\start_oracle.ps1
# Then from inside Docker: bun x cre-setup (first time only)
```

### 6. Run the live integration
```bash
# Trigger an audit (emits AuditRequested on-chain)
cast send --rpc-url $TENDERLY_RPC_URL --private-key $PRIVATE_KEY \
  $AEGIS_MODULE_ADDRESS "requestAudit(address)" 0x000000000000000000000000000000000000000a

# In the Docker container, simulate the oracle:
docker exec aegis-oracle-node bash -c \
  "cd /app && cre workflow simulate /app \
   --evm-tx-hash <YOUR_TX_HASH> \
   --evm-event-index 0 \
   --non-interactive --trigger-index 0 \
   -R /app -T tenderly-fork"
```

---

## 🔐 The 3-Step Security Loop

### Step 1 — Agent Submits Trade Intent
The AI agent (holding only gas ETH) sends a UserOp calling `AegisModule.requestAudit(token)`. This emits `AuditRequested` on-chain. **No capital moves yet.**

### Step 2 — Chainlink CRE Renders Verdict
The Chainlink CRE DON catches the event and runs a multi-phase audit:
- **GoPlus** — static on-chain analysis (honeypot, sell restriction, proxy)
- **BaseScan** — source code retrieval (via Confidential HTTP)
- **GPT-4o + Llama-3** — dual-model AI consensus (obfuscated tax, logic bombs)

The result is an **8-bit risk matrix** delivered to `AegisModule.onReport(tradeId, riskScore)` through the Chainlink KeystoneForwarder. **Only the KeystoneForwarder can call this function.**

### Step 3 — JIT Swap (or Hard Block)
- `riskScore == 0` → `triggerSwap()` is unblocked. The module calls `executeFromExecutor()` on the Smart Account. Capital moves.
- `riskScore > 0` → `ClearanceDenied` emitted. Trade blocked. **Zero capital at risk.**

---

## 🏗️ Architecture

See [docs/ERC7579_ROADMAP.md](docs/ERC7579_ROADMAP.md) for the full architecture deep-dive.

| Layer | Technology | Role |
|---|---|---|
| Smart Account | ERC-4337 (Safe) | Holds all capital |
| Session Key | ERC-7715 | Agent signing authority (gas only) |
| Security Module | ERC-7579 Executor | This repo — `AegisModule.sol` |
| Oracle | Chainlink CRE DON | Off-chain AI audit + on-chain callback |
| Bundler | Pimlico | ERC-4337 UserOp relay |

---

## 📊 The 8-Bit Risk Matrix

| Bit | Flag | Source |
|---|---|---|
| 0 | Unverified source code | GoPlus |
| 1 | Sell restriction | GoPlus |
| 2 | Honeypot | GoPlus |
| 3 | Proxy contract | GoPlus |
| 4 | Obfuscated tax | AI (GPT-4o + Llama-3) |
| 5 | Privilege escalation | AI |
| 6 | External call risk | AI |
| 7 | Logic bomb | AI |

---

## 🔗 Links

- [Architecture Roadmap](docs/ERC7579_ROADMAP.md)
- [Engineering Ledger](docs/lessons_learned.md)
- [Smart Contract](src/AegisModule.sol)
- [CRE Oracle](src/oracle/aegis-oracle.ts)
- [BYOA Agent](src/agent/bot.ts)
- [Chainlink CRE Docs](https://docs.chain.link/cre)
- [Rhinestone ModuleKit](https://docs.rhinestone.wtf)
- [ERC-7579 Standard](https://eips.ethereum.org/EIPS/eip-7579)
