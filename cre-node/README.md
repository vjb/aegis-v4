# 🔗 Aegis V4 — Chainlink CRE Oracle Node

This directory contains the **Chainlink Runtime Environment (CRE)** oracle workflow that powers Aegis V4's off-chain AI security audit pipeline.

## What It Does

When `AegisModule.requestAudit(token)` is called on-chain, the CRE node:

1. **Detects** the `AuditRequested` event via EVM log trigger
2. **Runs** GoPlus static analysis (honeypot, sell restriction, proxy detection)
3. **Fetches** contract source from BaseScan via Confidential HTTP
4. **Audits** with dual AI consensus (GPT-4o + Llama-3) for obfuscated risks
5. **Delivers** `onReport(tradeId, riskScore)` to `AegisModule` via KeystoneForwarder

## Files

| File | Purpose |
|---|---|
| `aegis-oracle.ts` | Main CRE workflow — implements the 3-phase audit pipeline |
| `workflow.yaml` | CRE workflow config — links oracle to AegisModule address |
| `project.yaml` | CRE project config — chains, RPC URLs |
| `config.json` | Runtime config — `vaultAddress` = AegisModule, `chainSelectorName` |
| `secrets.yaml` | Maps CRE secret IDs → `.env` variable names |
| `Dockerfile` | Ubuntu 24.04 + Node 20 + Bun + Foundry + CRE CLI + Javy |

## Running the Oracle

### First time only
```bash
docker compose up --build -d
docker exec aegis-oracle-node bash -c "cd /app && bun x cre-setup"
```

### Simulate (trigger from a tx hash)
```bash
docker exec aegis-oracle-node bash -c "
  cd /app && cre workflow simulate /app \
    --evm-tx-hash <TX_HASH> \
    --evm-event-index 0 \
    --non-interactive --trigger-index 0 \
    -R /app -T tenderly-fork
"
```

### Using the launcher script
```powershell
.\scripts\start_oracle.ps1
```
This reads `.env`, updates `config.json`, and tails Docker logs.

## CRE YAML Schema — Learnt the Hard Way

The `--target` flag maps to the **top-level key** of `workflow.yaml` and `project.yaml`:

```yaml
# ✅ Correct — "tenderly-fork" IS the target name
tenderly-fork:
  user-workflow:
    workflow-name: "aegis-oracle-v4"
  ...
```

NOT a `targets:` section, NOT a `settings/` sub-directory.

## 8-Bit Risk Matrix

```
Bit 0  — Unverified source code  (GoPlus)
Bit 1  — Sell restriction        (GoPlus)
Bit 2  — Honeypot                (GoPlus)
Bit 3  — Proxy contract          (GoPlus)
Bit 4  — Obfuscated tax          (AI consensus)
Bit 5  — Privilege escalation    (AI consensus)
Bit 6  — External call risk      (AI consensus)
Bit 7  — Logic bomb              (AI consensus)
```

`riskScore == 0` → CLEARED → `isApproved[token] = true`
`riskScore  > 0` → DENIED  → `ClearanceDenied` event emitted

## Mock Token Registry

For local/Tenderly testing, the oracle has a built-in mock registry:

| Address | Token | Expected Result |
|---|---|---|
| `0x...000a` | UnverifiedDoge | riskScore=1 (unverified code) |
| `0x...000b` | HoneypotCoin | riskScore=5 (unverified + honeypot) |
| `0x...000c` | TaxToken | riskScore=3 (sell restriction) |
| `0x...000e` | ObfuscatedTax | riskScore=16 (AI flagged) |
| `0x...000f` | FlashLoanTarget | riskScore=64 (external call risk) |
| `0x...0010` | TimeBombToken | riskScore=128 (logic bomb) |

## Environment Variables Required

```bash
OPENAI_API_KEY=...       # GPT-4o audit
GROQ_API_KEY=...         # Llama-3 audit
BASESCAN_API_KEY=...     # Source code fetch
CRE_ETH_PRIVATE_KEY=...  # Oracle signing key
```
