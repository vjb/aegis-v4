[🏠 Back to Main README](../../README.md)

# Heimdall Decompiler Microservice

> Local Docker container that decompiles raw EVM bytecode into readable Solidity using [heimdall-rs](https://github.com/Jon-Becker/heimdall-rs).

## Quick Start

```bash
# Build & start (from project root)
docker compose up decompiler -d

# Health check
curl http://localhost:8080/health
# → { "status": "ok", "heimdall": "0.9.2" }

# Decompile bytecode
curl -X POST http://localhost:8080/decompile \
  -H "Content-Type: application/json" \
  -d '{"bytecode": "0x608060..."}'
```

## API

| Endpoint | Method | Description |
|---|---|---|
| `/health` | GET | Returns Heimdall version and status |
| `/decompile` | POST | Decompiles `{ "bytecode": "0x..." }` → `{ "decompiled": "...", "success": true }` |

## Architecture

> **Note:** This diagram shows the intended integration path. Currently, Heimdall runs as a standalone experimental demo — it is not wired into the live CRE oracle.

```
┌─────────────────────────────────────┐
│  Aegis CRE Oracle (future)          │
│  ┌───────────────────────────────┐  │
│  │ BaseScan: verified source?    │  │
│  │   YES → read Solidity → AI   │  │
│  │   NO  → eth_getCode ─────────┼──┼──► POST /decompile
│  └───────────────────────────────┘  │      │
└─────────────────────────────────────┘      ▼
                                      ┌──────────────┐
                                      │ Heimdall-rs  │
                                      │ Symbolic Exe │
                                      │ → pseudocode │
                                      └──────┬───────┘
                                             ▼
                                        GPT-4o
                                        AI risk analysis
```

## Docker Details

- **Base:** `rust:1.85-bookworm` (builder) → `debian:trixie-slim` (runtime)
- **Binary:** heimdall-rs v0.9.2 via bifrost
- **Runtime:** Node.js 20 + Express
- **Port:** 8080
- **Memory limit:** 512MB
- **Timeout:** 120s per decompilation
