# 📚 Aegis V5 — Documentation

| Document | What It Is |
|---|---|
| [DEMO_GUIDE.md](DEMO_GUIDE.md) | **Start here.** How to run the V5 demo scripts on Base Sepolia |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture — 12 Mermaid diagrams (ERC-7579 → CRE → ERC-4337) |
| [CONFIDENTIAL_HTTP.md](CONFIDENTIAL_HTTP.md) | Privacy track — how `ConfidentialHTTPClient` protects all API keys and source code |
| [BUNDLER_STRATEGY_DECISION.md](BUNDLER_STRATEGY_DECISION.md) | Why Pimlico Cloud Bundler was selected over direct `handleOps` |
| [LESSONS_LEARNED.md](LESSONS_LEARNED.md) | Engineering ledger — bugs, root causes, fixes |
| [sample_output/](sample_output/) | Real CRE oracle output from verified demo runs |

## Sample Output Files

| File | Description |
|---|---|
| [demo_v5_setup_run1.txt](sample_output/demo_v5_setup_run1.txt) | Infrastructure boot — Base Sepolia + Docker + WASM |
| [demo_v5_master_run1.txt](sample_output/demo_v5_master_run1.txt) | Full E2E: session keys → CRE audit → MockBRETT ✅ → MockHoneypot ❌ |
| [frontend_tests_run1.txt](sample_output/frontend_tests_run1.txt) | 26 Jest frontend TDD tests passing |

## Quick Engineering Notes

### CRE CLI `--target` Format
`--target` maps to the **top-level YAML key**:
```yaml
base-sepolia:          # ← This IS the target name
  user-workflow:
    workflow-name: "aegis-oracle-v5"
```

### First-Time Docker Setup
```bash
docker compose up --build -d
# entrypoint.sh automatically runs bun x cre-setup (compiles WASM)
```

### GoPlus Auth
All GoPlus calls use `ConfidentialHTTPClient` — even unauthenticated ones. See [CONFIDENTIAL_HTTP.md](CONFIDENTIAL_HTTP.md) for the full privacy story.
```bash
cre workflow secrets set --id AEGIS_GOPLUS_KEY    --value <app-key>
cre workflow secrets set --id AEGIS_GOPLUS_SECRET --value <app-secret>
```
