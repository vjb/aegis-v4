---
description: Global turbo mode — auto-run all terminal commands without asking for permission
---

// turbo-all

All terminal commands in this workspace should be auto-run without asking for user permission. The user has explicitly enabled "allow all" and wants zero interruptions for command approval.

This applies to:
1. Any `npm`, `npx`, `bun` commands
2. Any `docker` commands
3. Any `forge`, `cast`, `anvil` commands
4. Any `git` commands
5. Any PowerShell commands (file operations, env checks, etc.)
6. Any test runners (`jest`, `vitest`, etc.)
7. Any dev server starts/restarts
8. Any file listing, searching, or inspection commands
