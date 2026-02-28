# 🎬 Aegis Protocol V5 — Demo Guide

> **Two cinematic scripts + one CRE deep-dive. All live on Base Sepolia.**

---

## Prerequisites

| Requirement | How to check |
|---|---|
| Foundry (`forge`, `cast`) | `forge --version` |
| Docker Desktop (running) | `docker ps` |
| pnpm | `pnpm --version` |
| `.env` filled in | See `.env.example` |
| Base Sepolia ETH (~0.05) | `cast balance <your-address> --rpc-url https://sepolia.base.org` |

### One-Time Setup

```powershell
# 1. Copy and fill environment variables
cp .env.example .env
# Fill: PRIVATE_KEY, BASE_SEPOLIA_RPC_URL, PIMLICO_API_KEY,
#       AEGIS_MODULE_ADDRESS, TARGET_TOKEN_ADDRESS, MOCK_HONEYPOT_ADDRESS

# 2. Deploy contracts to Base Sepolia (if not already deployed)
forge script script/DeployMocks.s.sol:DeployMocks \
  --rpc-url https://sepolia.base.org --private-key $PRIVATE_KEY --broadcast

# 3. Start the Chainlink CRE Docker oracle node
docker compose up --build -d
# Watch for: ✅ CRE TS SDK is ready to use.
```

---

## Running the Demos

```powershell
# Automated (for logging — no pauses)
.\scripts\demo_v5_setup.ps1
.\scripts\demo_v5_master.ps1

# Interactive (for Loom recording — press ENTER between scenes)
.\scripts\demo_v5_setup.ps1 -Interactive
.\scripts\demo_v5_master.ps1 -Interactive

# CRE-only showcase for Chainlink judges
.\scripts\demo_v5_cre.ps1 -Interactive
```

---

## Demo 1 — Infrastructure Boot (`demo_v5_setup.ps1`)

**Time:** ~2 minutes
**Prize tracks:** CRE & AI · Tenderly VNets

### What It Proves

The decentralized bedrock is live. Base Sepolia is reachable, the dev wallet is funded, the Docker oracle container builds cleanly, and the WASM plugin compiles.

| Scene | What you see |
|---|---|
| 1 — Network | Chain ID 84532 confirmed, dev wallet balance shown |
| 2 — Docker | Container torn down and rebuilt from scratch |
| 3 — WASM | Javy compiles TypeScript oracle to `aegis-oracle.wasm` |

---

## Demo 2 — The God Mode Demo (`demo_v5_master.ps1`)

**Time:** ~5 minutes
**Prize tracks:** CRE & AI ($17K) · Privacy ($16K) · DeFi & Tokenization ($20K) · Autonomous Agents ($5K)

### What It Proves

The complete V5 lifecycle on Base Sepolia: zero-custody treasury, scoped session keys, live CRE AI consensus, and on-chain enforcement (swap success + revert).

| Act | On-chain action | What you see |
|---|---|---|
| 1 — The Bank | `cast balance` module | AegisModule holds 0 ETH (zero-custody) |
| 2 — The Keys | `cast sig` selectors | ERC-7715 session key scoped to 2 selectors |
| 3 — The Intents | `requestAudit()` × 2 | Both audits submitted live, tx hashes printed |
| 4 — The Oracle | `docker exec cre simulate` | **LIVE CRE** — GoPlus → BaseScan → GPT-4o + Llama-3 |
| 5 — The Execution | `triggerSwap()` × 2 | MockBRETT ✅ SUCCESS, MockHoneypot ❌ REVERT |

### CRE Pipeline (Act 4)

```
Phase 1 — GoPlus (ConfidentialHTTPClient)
  [GoPlus] MOCK registry hit: MockHoneypot
  [GoPlus] unverified=0 sellRestriction=0 honeypot=1

Phase 2 — BaseScan (ConfidentialHTTPClient)
  [BaseScan] Using MOCK source for MockHoneypot (917 chars)

Phase 3 — AI Consensus (ConfidentialHTTPClient)
  [GPT-4o]  privilegeEscalation=true
  [GPT-4o]  Reasoning: The contract restricts transfers to an owner-controlled allowlist...
  [Llama-3] privilegeEscalation=true
  [Llama-3] Reasoning: MockHoneypot restricts transfers to owner-controlled allowlist...

⚖️ Final Risk Code: 36
```

### What Judges Should See

- Both AI models produce **independent** reasoning — not a consensus shortcut
- `ConfidentialHTTPClient` used for all API calls — keys never leave DON
- MockBRETT gets Risk Code 0 → swap succeeds
- MockHoneypot gets Risk Code 36 → swap **reverts** with `TokenNotCleared()`

**Sample output:** [`sample_output/demo_v5_master_run1.txt`](sample_output/demo_v5_master_run1.txt)

---

## Demo 3 — CRE Deep Dive (`demo_v5_cre.ps1`)

**Time:** ~3 minutes
**Prize tracks:** CRE & AI ($17K) · Privacy ($16K)

### What It Proves

The raw, unadulterated Chainlink CRE WASM execution. No frontend, no abstraction — just the oracle analyzing a known honeypot contract in real-time with full color-coded log streaming.

- Generates a live `requestAudit` transaction on Base Sepolia
- Runs `docker exec cre workflow simulate` with the real tx hash
- Streams raw WASM output: GoPlus (Yellow), GPT-4o (Cyan), Llama-3 (Magenta)
- Shows Confidential HTTP connections with animated spinners

---

## The Confidential HTTP Story (Privacy Track)

All external API calls go through `ConfidentialHTTPClient` — the DON's encrypted HTTP channel:

| API | Secret ID | What stays in the DON |
|---|---|---|
| GoPlus (auth) | `AEGIS_GOPLUS_KEY` | App key + secret (JWT exchange) |
| BaseScan | `AEGIS_BASESCAN_SECRET` | API key for source code fetch |
| OpenAI (GPT-4o) | `AEGIS_OPENAI_SECRET` | API key + full contract source |
| Groq (Llama-3) | `AEGIS_GROQ_SECRET` | API key + full contract source |

See [CONFIDENTIAL_HTTP.md](CONFIDENTIAL_HTTP.md) for the full privacy architecture deep-dive.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Docker not running | Start Docker Desktop, then `docker compose up --build -d` |
| `secret not found` | Register secrets with `cre workflow secrets set` |
| CRE returns `riskCode=0` for everything | Check oracle: `docker logs aegis-oracle-node` |
| Tx reverts on Base Sepolia | Check wallet balance: `cast balance <addr> --rpc-url https://sepolia.base.org` |
| WASM compilation fails | Run `docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"` |
