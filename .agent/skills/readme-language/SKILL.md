---
name: readme-language-guidelines
description: Language and tone guidelines for README files and documentation. Ensures professional, inclusive, emotionally intelligent writing that avoids religious, political, or exclusionary language.
---

# README Language Guidelines

## When to Use

- When writing or editing README files, documentation, demo scripts, or any user-facing text
- When naming files, functions, or variables that appear in documentation
- When writing commit messages, PR descriptions, or presentation materials

## Words and Phrases to AVOID

| Avoid | Why | Use Instead |
|---|---|---|
| "God Mode" | Religious connotation | "End-to-End Showcase", "Full Lifecycle Demo" |
| "master" (for primary) | Exclusionary historical connotation | "primary", "main", "principal" |
| "master/slave" | Exclusionary | "primary/replica", "leader/follower", "controller/worker" |
| "blacklist/whitelist" | Racially charged | "blocklist/allowlist", "denylist/permitlist" |
| "sanity check" | Ableist | "validation check", "smoke test", "confidence check" |
| "crippled" | Ableist | "degraded", "limited", "restricted" |
| "dummy" | Dismissive | "placeholder", "mock", "stub" |
| "kill" (as casual verb) | Violent | "stop", "terminate", "revoke", "end" |
| "nuke" | Violent | "clear", "reset", "remove" |
| "crusade" | Religious/political | "initiative", "campaign", "effort" |
| "guru" | Appropriative | "expert", "specialist", "lead" |

> **Note:** "Kill switch" is an accepted industry-standard term in security contexts (e.g., circuit breakers, emergency revocation). It is acceptable to use when describing an actual emergency stop mechanism. Use your best judgment.

## Tone Guidelines

### DO

- **Be confident but not arrogant.** State what the system does clearly without overselling.
- **Be precise.** Use exact numbers, real contract addresses, verifiable claims.
- **Be honest about limitations.** If something is simulated, say so. Transparency builds trust.
- **Be inclusive.** Write as if your audience is global and diverse.
- **Be professional.** This is a technical submission, not a blog post.
- **Use active voice.** "The module enforces budgets" not "Budgets are enforced by the module."

### DON'T

- **Don't use superlatives without evidence.** Avoid "the best", "unbreakable", "perfect."
- **Don't mention prize amounts.** It looks presumptuous. Reference track names only.
- **Don't use slang or memes.** "WAGMI", "LFG", "to the moon" — none of these belong in a technical submission.
- **Don't be self-deprecating.** Don't undersell your work either.
- **Don't assume the reader's background.** Explain acronyms on first use.

## File and Variable Naming

| Avoid | Use Instead |
|---|---|
| `master_demo.ps1` | `demo_v5_main.ps1` or keep as-is if renaming breaks references |
| `whitelist` mapping | `allowlist` mapping |
| `blacklisted` flag | `blocked` or `denied` flag |
| `MASTER_KEY` | `PRIMARY_KEY` or `OWNER_KEY` |

## Prize Track References

When referencing hackathon tracks in documentation:

```markdown
# ✅ Good
**Tracks:** CRE & AI · Privacy · DeFi & Tokenization

# ❌ Bad
**Prize tracks:** CRE & AI ($17K) · Privacy ($16K)
```

Never mention specific dollar amounts. It is presumptuous and unprofessional.

## Commit Message Style

- Keep commit messages under 72 characters
- Use imperative mood: "Add session config" not "Added session config"
- Prefix with category: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`
