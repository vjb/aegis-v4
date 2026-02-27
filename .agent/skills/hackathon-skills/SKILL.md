---
name: hackathon-skills
description: Chainlink Convergence hackathon prize tracks, submission requirements, and judging criteria. Trigger when discussing submission strategy, prize eligibility, demo requirements, or judging criteria.
---

# Convergence: A Chainlink Hackathon

**Dates:** February 6 – March 8

## When to Use

- **Checking submission requirements** — video length, README links, CRE simulation proof
- **Prize track strategy** — which tracks Aegis qualifies for and their specific requirements
- **Demo planning** — what judges need to see (3-5 min video, CRE workflow execution)
- **Bounty-specific rules** — Tenderly explorer links, Moltbook posts, World ID integration

## Aegis Protocol Track Alignment

| Track | Eligible? | Why |
|:--|:--|:--|
| **Risk & Compliance** ($16K) | ✅ Primary | AI firewall + automated risk monitoring + on-chain safeguards |
| **CRE & AI** ($17K) | ✅ Strong | AI agents consuming CRE workflows, autonomous risk assessment |
| **Tenderly VNets** ($5K) | ✅ Strong | Full deployment + testing on Tenderly VNet, explorer links available |
| **Autonomous Agents** ($5K) | ✅ Via Moltbook | Requires `cre simulate`, on-chain write, Moltbook post |
| **Top 10 Projects** ($15K) | ✅ Runner-up | $1,500 each to top 10 CRE projects |
| **DeFi & Tokenization** ($20K) | ⚠️ Stretch | Uniswap V3 integration for safe swaps |
| **Privacy** ($16K) | ⚠️ Stretch | Confidential HTTP for API key protection |

## General Submission Requirements

* Build, simulate, or deploy a CRE Workflow that functions as an orchestration layer within the project.
* The workflow must integrate at least one blockchain with an external API, system, data source, LLM, or AI agent.
* Projects must demonstrate a successful simulation (via the CRE CLI) or a live deployment on the CRE network.
* Past hackathon projects are strictly prohibited unless the team is updating an existing project with new components.
* Submissions require a 3-5 minute, publicly viewable video demonstrating the workflow being executed within the app or simulated via the CLI.
* Source code must be publicly accessible (e.g., a public GitHub repo).
* The project README must contain links to all files that use Chainlink.

## Prize Tracks & Bounties

### 1. DeFi & Tokenization ($20,000)
* **1st Place:** $12,000 | **2nd Place:** $8,000
* **Focus:** Projects introducing new concepts to DeFi, stablecoins, and onchain finance, as well as the tokenization of Real World Assets (RWAs).
* **Use Cases:** Stablecoin issuance, tokenized asset lifecycle management, and custom Proof of Reserve data feeds.

### 2. CRE & AI ($17,000)
* **1st Place:** $10,500 | **2nd Place:** $6,500
* **Focus:** Integrating AI into Web3 workflows for decision-making, automation, or execution (including autonomous agents and AI-in-the-loop applications).
* **Use Cases:** AI agents consuming CRE workflows with x402 payments, AI agent blockchain abstraction, and AI-assisted CRE workflow generation.

### 3. Prediction Markets ($16,000)
* **1st Place:** $10,000 | **2nd Place:** $6,000
* **Focus:** Decentralized forecasting applications that utilize real-world and offchain data for verifiable market resolution.
* **Use Cases:** AI-powered settlement, event-driven market resolution, and private prediction markets using Chainlink Confidential Compute.

### 4. Risk & Compliance ($16,000)
* **1st Place:** $10,000 | **2nd Place:** $6,000
* **Focus:** Systems for monitoring, safeguards, and automated controls that detect risk and verify system health.
* **Use Cases:** Automated risk monitoring, real-time reserve health checks, and protocol safeguard triggers.

### 5. Privacy ($16,000)
* **1st Place:** $10,000 | **2nd Place:** $6,000
* **Focus:** Projects utilizing Chainlink Confidential Compute (early access) and/or CRE's Confidential HTTP for privacy-preserving workflows. 
* **Use Cases:** Sealed-bid auctions, private treasury operations, private rewards distribution, OTC settlements, and secure Web2 API integrations that protect credentials and sensitive data.

### 6. Top 10 Projects ($15,000)
* **Prize:** $1,500 each to the top 10 runner-up projects utilizing the Chainlink Runtime Environment.

### 7. Autonomous Agents ($5,000)
* **1st Place:** $3,500 | **2nd Place:** $1,500
* **Focus:** Track exclusively for autonomous agents on Moltbook building CRE projects across DeFi, AI, or Prediction Market tracks.
* **Specific Requirements:**
    * Run a one-shot simulation command (`cre simulate`).
    * Submit evidence of at least one on-chain write on a CRE-supported testnet.
    * Publish a valid submission post in `m/chainlink-official`.
    * The human operator must complete a designated Google Form.
    * Agents must only use CRE-supported testnets (no mainnet wallets or real funds).

### 8. Best Use of World ID with CRE ($5,000)
* **1st Place:** $3,000 | **2nd Place:** $1,500 | **3rd Place:** $500
* **Focus:** Integrating World ID (for privacy-preserving sybil resistance) with CRE to enable World ID usage on non-native blockchains via off-chain or on-chain proof verification.

### 9. Best Usage of CRE within a World Mini App ($5,000)
* **1st Place:** $3,000 | **2nd Place:** $1,500 | **3rd Place:** $500
* **Focus:** Integrating CRE into a World Mini App (which natively only supports World Chain) to leverage cross-chain data and protocols.

### 10. Build CRE Workflows with Tenderly Virtual TestNets ($5,000)
* **1st Place:** $2,500 | **2nd Place:** $1,750 | **3rd Place:** $750
* **Focus:** Orchestrating and testing CRE workflows using Tenderly Virtual TestNets.
* **Specific Requirements:**
    * Submit a Tenderly Virtual TestNet Explorer Link demonstrating the deployed contracts and transaction history.
    * Provide a GitHub repo containing CRE workflows, deployment scripts, and documentation.
    * Clearly demonstrate how the CRE workflow integrates with Virtual TestNets for testing.

### 11. thirdweb x CRE
* **Top 3 Projects:** 1 free month of Scale plan.
* **2x Runner-ups:** 3 free months of Growth plan.
* **Submission Reward:** 2 free months of Growth plan (for all participants who use thirdweb and submit).
* **Focus:** Combining thirdweb's development tools and SDKs with CRE's capability orchestration layer for production-ready, interoperable apps.