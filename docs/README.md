# 📚 Aegis V4 — Documentation

| Document | What It Is |
|---|---|
| [ERC7579_ROADMAP.md](ERC7579_ROADMAP.md) | Deep-dive architecture blueprint — the V3→V4 migration from standalone vault to ERC-7579 module, including execution lifecycle, Mermaid diagrams, and production roadmap |
| [lessons_learned.md](lessons_learned.md) | Engineering ledger — every bug, root cause, and fix encountered across all 6 phases of V4 development. Critical reference before debugging. |

## Key Engineering Notes (TL;DR)

### CRE CLI `--target` Format
The `--target` flag maps to the **top-level YAML key**, not a `targets:` section:
```yaml
tenderly-fork:        # ← This IS the target name
  user-workflow:
    workflow-name: "aegis-oracle-v4"
```

### First-time Docker Setup
After `docker compose up`, run inside container:
```bash
bun x cre-setup   # Compiles the Javy WASM plugin — required once
```

### viem Type Issues in ts-node
Add `// @ts-nocheck` to simulation scripts — viem's strict TypeScript generics conflict with ts-node resolution. This is fine for runtime scripts (not library code).

See [lessons_learned.md](lessons_learned.md) for the full engineering ledger.
