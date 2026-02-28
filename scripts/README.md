# 🧪 Aegis V5 — Scripts

Operational scripts for the Aegis V5 Account Abstraction stack on Base Sepolia.

## Scripts Overview

| Script | Purpose |
|---|---|
| `demo_v5_setup.ps1` | Act 0: Infrastructure boot (Docker, WASM, connectivity) |
| `demo_v5_master.ps1` | Acts 1–5: Full live E2E demo (bank → keys → audit → CRE → swap/revert) |
| `demo_v5_cre.ps1` | Standalone CRE WASM showcase for Chainlink judges |
| `v5_setup_safe.ts` | Deploy Safe Smart Account + install AegisModule via Pimlico |
| `v5_e2e_mock.ts` | Full 5-phase E2E test (Base Sepolia, mocked oracle callback) |
| `v5_bot_config.ts` | ABI calldata builders for `requestAudit` and `triggerSwap` |
| `v5_safe_config.ts` | Safe Smart Account configuration constants |
| `v5_session_config.ts` | ERC-7715 session key scope configuration |

---

## Demo Scripts (Cinematic Presentation)

All three cinematic scripts accept `-Interactive` for paused narration (for Loom recording):

```powershell
# Act 0 — Infrastructure Boot
.\scripts\demo_v5_setup.ps1 -Interactive

# Acts 1-5 — Full E2E: Bank → Keys → Audit → LIVE CRE → Swap/Revert
.\scripts\demo_v5_master.ps1 -Interactive

# Standalone CRE — Raw WASM execution for Chainlink judges
.\scripts\demo_v5_cre.ps1 -Interactive
# Or pass a specific tx hash:
.\scripts\demo_v5_cre.ps1 -TxHash 0xabc123...
```

---

## `v5_setup_safe.ts` — Safe Account Deployment

Deploys a Safe Smart Account on Base Sepolia with AegisModule installed as ERC-7579 Executor.

```bash
pnpm ts-node --transpile-only scripts/v5_setup_safe.ts
```

**What it does:**
1. Creates Safe Smart Account via Pimlico's `toSafeSmartAccount`
2. Installs `AegisModule` as an ERC-7579 Executor module
3. Subscribes an agent with a budget cap
4. Prints the Safe address and module installation status

---

## `v5_e2e_mock.ts` — Full E2E Test

Proves the full module lifecycle on Base Sepolia with mocked oracle callback.

```bash
pnpm ts-node --transpile-only scripts/v5_e2e_mock.ts
```

**5 Phases:**
1. Deploy Safe + install module
2. Fund treasury + subscribe agent
3. `requestAudit(MockBRETT)` via UserOp
4. Mock oracle callback (`onReportDirect`)
5. `triggerSwap(MockBRETT)` via UserOp → swap success

---

## Environment Setup

```bash
cp .env.example .env

# Required
PRIVATE_KEY=...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
PIMLICO_API_KEY=...
AEGIS_MODULE_ADDRESS=...
TARGET_TOKEN_ADDRESS=...      # MockBRETT on Base Sepolia
MOCK_HONEYPOT_ADDRESS=...     # MockHoneypot on Base Sepolia

# AI APIs (for CRE oracle)
OPENAI_API_KEY=...
GROQ_API_KEY=...
BASESCAN_API_KEY=...
GOPLUS_APP_KEY=...     # optional
GOPLUS_APP_SECRET=...  # optional
```
