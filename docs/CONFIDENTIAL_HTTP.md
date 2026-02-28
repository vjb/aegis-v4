# 🔐 Confidential HTTP — Privacy-Preserving Oracle Design

Aegis Protocol uses Chainlink's `ConfidentialHTTPClient` throughout the CRE oracle pipeline. This document explains what that means, why it matters, and where it applies.

---

## The Problem with Plain HTTP in Oracle Networks

Traditional oracle networks expose API calls in clear text. The request URL, headers, and body are visible to every node operator — meaning **API keys, query parameters, and token addresses** are leaked to the network.

For Aegis, this creates two problems:

1. **Credential exposure** — AI and security API keys (OpenAI, Groq, BaseScan, GoPlus) must remain secret
2. **Front-running risk** — a token address sent in clear text to GoPlus before a trade is visible to node operators who could act on it

---

## The Solution: ConfidentialHTTPClient

Chainlink's `ConfidentialHTTPClient` executes HTTP requests inside the DON's secure enclave. The request is constructed inside a WASM sandbox and transmitted through an encrypted channel. **No node operator — not even the one executing the request — can read the API key or the response body.**

```typescript
// Every external API call in Aegis uses this pattern
const res = confidentialClient.sendRequest(nodeRuntime, {
    vaultDonSecrets: [{ key: "AEGIS_OPENAI_SECRET", namespace: "aegis" }],
    request: {
        url: "https://api.openai.com/v1/chat/completions",
        method: "POST",
        multiHeaders: { "Authorization": { values: ["Bearer <secret injected here>"] } },
        bodyString: JSON.stringify({ model: "gpt-4o", messages: [...] })
    }
}).result();
```

The secret value is **never in the TypeScript source**. It is referenced by ID (`AEGIS_OPENAI_SECRET`) and injected by the DON at runtime — inside the WASM sandbox, after the workflow has been verified.

---

## Where Aegis Uses ConfidentialHTTPClient

Every external API call in `aegis-oracle.ts` goes through `ConfidentialHTTPClient`. There is no plain `HTTPClient` anywhere in the oracle pipeline.

| API Call | Secret ID | What is Protected |
|---|---|---|
| GoPlus JWT auth | `AEGIS_GOPLUS_KEY`, `AEGIS_GOPLUS_SECRET` | App credentials for authenticated tier |
| GoPlus token_security | *(no auth header — still confidential channel)* | Token address queried before trade |
| BaseScan source fetch | `AEGIS_BASESCAN_SECRET` | API key + contract address being audited |
| OpenAI GPT-4o | `AEGIS_OPENAI_SECRET` | API key + full Solidity source code of target token |
| Groq Llama-3 | `AEGIS_GROQ_SECRET` | API key + full Solidity source code of target token |

> **Note:** Even the unauthenticated GoPlus call (when no keys are registered) uses `ConfidentialHTTPClient` with an empty `vaultDonSecrets` array. The token address being audited never leaves the secure enclave in plain text.

---

## The Solidity Source Privacy Guarantee

When the oracle fetches a contract's Solidity source from BaseScan, it immediately forwards that source — potentially thousands of lines of code — to GPT-4o and Llama-3 via `ConfidentialHTTPClient`.

This means:

- The **full contract source** of a token being audited is sent to AI models without leaking to node operators
- A malicious token contract could contain **sensitive business logic, embedded keys, or proprietary algorithms** — none of this is visible to the network
- The AI model's **reasoning and verdict** are also returned through the confidential channel before being committed on-chain

---

## Secret Registration

Secrets are registered once with the CRE CLI and stored in the DON's secure vault. They are never in source code, `.env` files committed to git, or any plaintext store accessible to node operators.

```bash
cre workflow secrets set --id AEGIS_BASESCAN_SECRET  --value <key>
cre workflow secrets set --id AEGIS_OPENAI_SECRET    --value <key>
cre workflow secrets set --id AEGIS_GROQ_SECRET      --value <key>
cre workflow secrets set --id AEGIS_GOPLUS_KEY       --value <key>
cre workflow secrets set --id AEGIS_GOPLUS_SECRET    --value <key>
```

Once registered, the secrets are referenced only by ID in the workflow source. The mapping from ID to value exists only inside the DON.

---

## Verification

The log output of a successful oracle run explicitly confirms the confidential channel for each API call:

```
[GoPlus]  Fetching token_security via ConfidentialHTTPClient
[BaseScan] AEGIS_BASESCAN_SECRET stays inside the Decentralized Oracle Network
[BaseScan] HTTP 200 — key never left DON
[AI] → GPT-4o via ConfidentialHTTPClient | AEGIS_OPENAI_SECRET stays in DON
[AI] → Llama-3 via Groq ConfidentialHTTPClient | AEGIS_GROQ_SECRET stays in DON
```

These log lines are emitted by `nodeRuntime.log()` from inside the WASM sandbox — they appear in the CRE simulation output and confirm the secure channel is active.

See: [`sample_output/demo_v5_master_run1.txt`](sample_output/demo_v5_master_run1.txt) for a full run with all five API calls confirmed.

---

## Comparison: Plain HTTP vs ConfidentialHTTPClient

| Property | Plain `HTTPClient` | `ConfidentialHTTPClient` |
|---|---|---|
| API key visibility | Visible to node operators | Never leaves WASM enclave |
| Request URL | Logged in node telemetry | Encrypted in transit |
| Response body | Readable by node operator | Decrypted only inside sandbox |
| Token address leakage | Visible before trade | Protected in enclave |
| Secret management | Must be in env/config | Stored in DON vault by ID |

**Aegis uses `ConfidentialHTTPClient` exclusively** — there is no code path in the production oracle that uses plain HTTP for any external call.
