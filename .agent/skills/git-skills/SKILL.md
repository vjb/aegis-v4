---
name: git-skills
description: Git commit and push workflow. Trigger when committing code, pushing to remote, or creating branches. Enforces short commit messages to avoid shell timeouts.
---

# Git Commit & Push

Follow these rules strictly when committing and pushing code.

## Commit Messages

1. **Keep commit messages SHORT** — max 72 characters for the subject line
2. **Never use multi-line commit messages** with `-m` flag — long messages cause shell timeouts on Windows
3. Use conventional commit format: `type: short description`
4. Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`

### ✅ Good Examples
```
feat: add IReceiver interface to AegisVault
fix: resolve CRE broadcast silent failure
docs: add BYOA test suite to README
refactor: rename whitelist to allowlist
chore: update demo script with E2E tests
```

### ❌ Bad Examples
```
feat: implement IReceiver interface on AegisVault for native CRE broadcast delivery including ERC165 supportsInterface and onReport bytes bytes signature with onReportDirect for mock relay path
```

## Commit Workflow

// turbo-all

1. Stage all changes:
```powershell
git add -A
```

2. Check what's staged:
```powershell
git status
```

3. Commit with a SHORT message (max 72 chars):
```powershell
git commit -m "type: short description"
```

4. Push to remote:
```powershell
git push origin <branch-name>
```

## Rules

- **NEVER** write commit messages longer than 72 characters
- **NEVER** use multi-line `-m` flags (no `\n` or multiple `-m` args)
- If you need to explain more, put details in the PR description, not the commit message
- Always check `git status` before committing
- Always specify the branch name when pushing
- Branch names use `feat/`, `fix/`, `docs/`, `chore/` prefixes (e.g. `feat/byoa-standalone-agent`)
- Check `.gitignore` before staging — never commit `.env`, `node_modules/`, or build artifacts
