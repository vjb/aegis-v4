# Aegis Protocol V5 — System Architecture

> 12 Mermaid diagrams covering all layers of the Aegis V5 stack.

---

## 1. System Context

```mermaid
graph TD
    Owner["👤 Treasury Owner\nConnects wallet · sets rules"]
    Agent["🤖 AI Trading Agent\nHolds gas ETH only — zero capital"]
    Aegis["🛡️ AegisModule\nERC-7579 Executor on Smart Account"]
    CRE["🔗 Chainlink CRE DON\nWASM oracle · GoPlus · AI models"]
    SA["💰 Smart Account - Safe\nHolds ALL capital"]
    Swap["🔄 Simulated Swap\nETH transfer + SwapExecuted event"]

    Owner -->|"install · budget · revoke"| Aegis
    Agent -->|"requestAudit(token)"| Aegis
    Aegis -->|"emits AuditRequested"| CRE
    CRE -->|"onReport(tradeId, riskScore)"| Aegis
    Aegis -->|"executeFromExecutor() on clearance"| SA
    SA -->|"triggerSwap() — simulated"| Swap

    style Owner fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style Agent fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    style Aegis fill:#fff3e0,stroke:#e65100,color:#bf360c
    style CRE fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    style SA fill:#e0f7fa,stroke:#00695c,color:#004d40
    style Swap fill:#fce4ec,stroke:#c62828,color:#b71c1c
```

---

## 2. AegisModule Internal Structure

```mermaid
graph LR
    subgraph Inputs
        A["agent: requestAudit(token)"]
        B["CRE: onReport(id, score)"]
        C["owner: subscribeAgent(addr, budget)"]
        D["owner: revokeAgent(addr)"]
    end

    subgraph AegisModule.sol
        direction TB
        TR["tradeRequests mapping\nid → token · agent"]
        AA["agentAllowances mapping\naddr → remaining budget"]
        IA["isApproved mapping\ntoken → bool"]
        PP["_processReport()\nriskScore == 0 → approve\nriskScore > 0 → deny"]
    end

    subgraph Outputs
        E["emit AuditRequested"]
        F["emit ClearanceUpdated / ClearanceDenied"]
        G["triggerSwap() — simulated swap"]
    end

    A --> TR --> E
    B --> PP --> IA --> F
    IA -->|"approved"| G
    C --> AA
    D -->|"zeroes budget"| AA

    style A fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    style B fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    style C fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style D fill:#ffebee,stroke:#c62828,color:#b71c1c
    style TR fill:#fff8e1,stroke:#f9a825,color:#f57f17
    style AA fill:#fff8e1,stroke:#f9a825,color:#f57f17
    style IA fill:#fff8e1,stroke:#f9a825,color:#f57f17
    style PP fill:#fff8e1,stroke:#f9a825,color:#f57f17
    style E fill:#e0f2f1,stroke:#00796b,color:#004d40
    style F fill:#e0f2f1,stroke:#00796b,color:#004d40
    style G fill:#e0f2f1,stroke:#00796b,color:#004d40
```

---

## 3. CRE Oracle Pipeline

```mermaid
flowchart LR
    EVENT(["AuditRequested\ntradeId · token · config"])

    subgraph Phase1["Phase 1 — GoPlus"]
        GP1["GoPlus Security API\nlive on-chain data"]
        GP2["honeypot · sell restriction\nunverified · proxy → bits 0–3"]
    end

    subgraph Phase2["Phase 2 — Source Code"]
        BS1["BaseScan via ConfidentialHTTPClient\nAPI key sealed inside DON"]
        BS2["Full Solidity source\n(e.g. 52,963 chars BrettToken.sol)"]
    end

    subgraph Phase3["Phase 3 — AI Consensus"]
        AI1["GPT-4o reads source"]
        AI2["Llama-3 reads source"]
        AI3["Union of flags\nbits 4–7: tax · priv · extCall · bomb"]
    end

    REPORT(["onReport(tradeId, riskCode)\nvia KeystoneForwarder"])

    EVENT --> Phase1 --> GP1 --> GP2
    GP2 --> Phase2 --> BS1 --> BS2
    BS2 --> Phase3
    Phase3 --> AI1 & AI2 --> AI3 --> REPORT

    style EVENT fill:#fff3e0,stroke:#e65100,color:#bf360c
    style GP1 fill:#fffde7,stroke:#f9a825,color:#f57f17
    style GP2 fill:#fffde7,stroke:#f9a825,color:#f57f17
    style BS1 fill:#e0f7fa,stroke:#00838f,color:#006064
    style BS2 fill:#e0f7fa,stroke:#00838f,color:#006064
    style AI1 fill:#e8eaf6,stroke:#283593,color:#1a237e
    style AI2 fill:#fce4ec,stroke:#ad1457,color:#880e4f
    style AI3 fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    style REPORT fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
```

---

## 4. Trade Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> Pending : requestAudit(token)
    Pending --> Running : CRE WASM sandbox starts
    Running --> Cleared : riskScore == 0
    Running --> Blocked : riskScore > 0
    Cleared --> Approved : isApproved[token] = true
    Blocked --> Denied : emit ClearanceDenied
    Approved --> Executed : triggerSwap()\nisApproved consumed (CEI anti-replay)
    Approved --> Reverted : second triggerSwap()\nrevert TokenNotCleared
    Executed --> [*]
    Denied --> [*]
    Reverted --> [*]
```

---

## 5. ERC-4337 Account Abstraction Sequence

```mermaid
sequenceDiagram
    participant Bot as 🤖 AI Agent
    participant Bundler as 📦 Pimlico Bundler
    participant EP as 🔗 EntryPoint v0.7
    participant Safe as 💰 Smart Account
    participant AM as 🛡️ AegisModule
    participant CRE as 🔮 CRE DON

    Bot->>Bundler: UserOp { callData: requestAudit(BRETT) }
    Bundler->>EP: handleOps
    EP->>Safe: validateUserOp ✓
    EP->>Safe: execute
    Safe->>AM: requestAudit(BRETT)
    AM-->>CRE: emit AuditRequested

    Note over CRE: GoPlus + BaseScan + AI audit

    CRE->>AM: onReport(id, 0) via KeystoneForwarder
    AM->>AM: isApproved[BRETT] = true

    Bot->>Bundler: UserOp { callData: triggerSwap(BRETT, 0.01 ETH) }
    Bundler->>EP: handleOps
    EP->>Safe: execute
    Safe->>AM: triggerSwap
    AM->>AM: check allowance ✓ · consume clearance (CEI)
    AM->>Safe: executeFromExecutor
    Safe-->>AM: SwapExecuted event emitted
```

---

## 6. Multi-Agent Firewall — Demo 2

```mermaid
flowchart TD
    subgraph Agents
        NOVA["NOVA\n0.05 ETH budget"]
        CIPHER["CIPHER\n0.008 ETH budget"]
        REX["REX\n0.01 ETH budget"]
    end

    subgraph Oracle["Chainlink CRE runs for each token independently"]
        O1["BRETT\nGoPlus ✅ · AI ✅ → Risk Code 0"]
        O2["TaxToken\nAI reads hidden sell restriction → Risk Code 18"]
        O3["HoneypotCoin\nAI reads honeypot pattern → Risk Code 36"]
    end

    subgraph Results
        R1["✅ APPROVED\nNOVA executes triggerSwap"]
        R2["🔴 BLOCKED\nCIPHER stands down"]
        R3["🔴 BLOCKED\nREX denied · bypass attempt reverts"]
    end

    NOVA -->|requestAudit| O1 --> R1
    CIPHER -->|requestAudit| O2 --> R2
    REX -->|requestAudit| O3 --> R3

    style NOVA fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    style CIPHER fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style REX fill:#fff3e0,stroke:#e65100,color:#bf360c
    style O1 fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style O2 fill:#ffebee,stroke:#c62828,color:#b71c1c
    style O3 fill:#ffebee,stroke:#c62828,color:#b71c1c
    style R1 fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style R2 fill:#ffebee,stroke:#c62828,color:#b71c1c
    style R3 fill:#ffebee,stroke:#c62828,color:#b71c1c
```

---

## 7. Security Zone Architecture

```mermaid
graph TB
    subgraph PublicZone["Public Internet"]
        GoPlus["GoPlus API"]
        BaseScan["BaseScan API"]
        OpenAI["OpenAI GPT-4o"]
        Groq["Groq Llama-3"]
    end

    subgraph DON["Chainlink DON — Trusted Execution Environment"]
        Conf["ConfidentialHTTPClient\nAPI keys sealed — never transmitted"]
        WASM["WASM Sandbox\ndeterministic · isolated"]
    end

    subgraph OnChain["On-Chain — Public · Immutable"]
        KF["KeystoneForwarder\nonly valid caller for onReport()"]
        AM["AegisModule.sol"]
        Safe["Smart Account\nholds ALL capital"]
    end

    subgraph AgentZone["Agent Zone — Untrusted"]
        Bot["AI Agent Wallet\ngas only · zero capital at risk"]
    end

    Conf -->|sealed request| BaseScan & OpenAI & Groq
    WASM --> GoPlus
    WASM --> Conf
    WASM -->|risk code| KF --> AM
    AM --> Safe
    Bot -->|requestAudit only| AM

    style GoPlus fill:#fffde7,stroke:#f9a825,color:#f57f17
    style BaseScan fill:#e0f7fa,stroke:#00838f,color:#006064
    style OpenAI fill:#e8eaf6,stroke:#283593,color:#1a237e
    style Groq fill:#fce4ec,stroke:#ad1457,color:#880e4f
    style Conf fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    style WASM fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    style KF fill:#fff3e0,stroke:#e65100,color:#bf360c
    style AM fill:#fff3e0,stroke:#e65100,color:#bf360c
    style Safe fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style Bot fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
```

---

## 8. 8-Bit Risk Matrix

```mermaid
graph LR
    subgraph GoPlus["GoPlus Output — Bits 0–3"]
        B0["Bit 0\nUnverified code\nis_open_source = 0"]
        B1["Bit 1\nSell restriction\nsell_tax > threshold"]
        B2["Bit 2\nHoneypot\nis_honeypot = 1"]
        B3["Bit 3\nUpgradeable proxy\nis_proxy = 1"]
    end

    subgraph AI["AI Consensus — Bits 4–7"]
        B4["Bit 4\nObfuscated tax\nhidden fee in source"]
        B5["Bit 5\nPrivilege escalation\nnon-standard Ownable"]
        B6["Bit 6\nExternal call risk\nreentrancy potential"]
        B7["Bit 7\nLogic bomb\ntime-gated malicious code"]
    end

    subgraph Verdict
        V0["riskCode == 0\nAll clear → APPROVED"]
        V1["riskCode > 0\nAny bit set → BLOCKED"]
    end

    B0 & B1 & B2 & B3 & B4 & B5 & B6 & B7 --> OR["Bitwise OR"]
    OR -->|"= 0"| V0
    OR -->|"> 0"| V1

    style B0 fill:#fffde7,stroke:#f9a825,color:#f57f17
    style B1 fill:#fffde7,stroke:#f9a825,color:#f57f17
    style B2 fill:#fffde7,stroke:#f9a825,color:#f57f17
    style B3 fill:#fffde7,stroke:#f9a825,color:#f57f17
    style B4 fill:#e8eaf6,stroke:#283593,color:#1a237e
    style B5 fill:#e8eaf6,stroke:#283593,color:#1a237e
    style B6 fill:#e8eaf6,stroke:#283593,color:#1a237e
    style B7 fill:#e8eaf6,stroke:#283593,color:#1a237e
    style OR fill:#f5f5f5,stroke:#616161,color:#212121
    style V0 fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style V1 fill:#ffebee,stroke:#c62828,color:#b71c1c
```

---

## 9. Agent Subscription Lifecycle

```mermaid
sequenceDiagram
    participant Owner as 👤 Owner
    participant AM as 🛡️ AegisModule
    participant Agent as 🤖 AI Agent
    participant Safe as 💰 Safe

    Owner->>AM: depositETH() — 0.1 ETH
    Owner->>AM: subscribeAgent(agentAddr, 0.05 ETH)
    AM-->>Owner: emit AgentSubscribed

    Agent->>AM: requestAudit(BRETT)
    Note over AM: CRE oracle runs...
    AM->>AM: isApproved[BRETT] = true

    Agent->>AM: triggerSwap(BRETT, 0.01 ETH)
    AM->>AM: agentAllowances -= 0.01 ETH
    AM->>Safe: triggerSwap() — simulated
    Note right of AM: Budget remaining: 0.04 ETH

    Owner->>AM: revokeAgent(agentAddr)
    AM->>AM: agentAllowances[agentAddr] = 0
    AM-->>Owner: emit AgentRevoked
```

---

## 10. Base Sepolia Deployment Flow

```mermaid
flowchart LR
    Deploy["forge script DeployMocks.s.sol"]

    subgraph BaseSepolia["Base Sepolia - 84532"]
        Contracts["AegisModule + MockBRETT\n+ MockHoneypot"]
        Explorer["BaseScan\nverified source"]
    end

    subgraph Oracle
        Docker["Docker: aegis-oracle-node\ncre workflow simulate"]
    end

    subgraph DemoScripts
        D1["demo_v5_setup.ps1"]
        D2["demo_v5_master.ps1"]
        D3["demo_v5_cre.ps1"]
    end

    Deploy -->|"1. broadcast"| Contracts
    Deploy -->|"2. verify"| Explorer
    D1 -->|"docker compose up"| Docker
    DemoScripts -->|"cast send requestAudit()"| Contracts
    Contracts -->|"AuditRequested log"| Docker
    Docker -->|"--evm-tx-hash"| Contracts
    Docker -->|"onReportDirect(id, riskCode)"| Contracts

    style Deploy fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    style Contracts fill:#fff3e0,stroke:#e65100,color:#bf360c
    style Explorer fill:#e0f7fa,stroke:#00838f,color:#006064
    style Docker fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    style D1 fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style D2 fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style D3 fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
```

---

## 11. Frontend Architecture — Command Center

```mermaid
graph TB
    subgraph Browser["Next.js App"]
        Header["Header: logo · VNet status · wallet · kill switch"]

        subgraph Left["Left Panel 60%"]
            Tabs["Tabs: Agents · Firewall · Audit Log · Marketplace"]
            AgTab["AgentsTab\nsubscribe · revoke · filter · dismiss · ERC-7715 scope"]
            FwTab["FirewallTab\n8-bit risk toggles"]
            LogTab["AuditLogTab\nreal on-chain events"]
            MktTab["MarketplaceTab\npreset agent templates"]
        end

        subgraph Right["Right Panel 40% — Always Visible"]
            Feed["Oracle Feed\nSSE stream: GoPlus → AI → verdict"]
            Input["Chat Interface\nAI assistant + audit trigger"]
        end
    end

    subgraph API["API Routes"]
        Audit["/api/audit → CRE SSE stream"]
        Chat["/api/chat → LLM assistant"]
        Events["/api/events → on-chain events"]
    end

    AgTab & FwTab -->|"writeContract"| AM["AegisModule.sol"]
    LogTab --> Events
    Feed --> Audit -->|"docker exec cre simulate"| CRE["CRE Oracle"]
    AM -->|"readContract"| AgTab & LogTab

    style Header fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    style Tabs fill:#e8eaf6,stroke:#283593,color:#1a237e
    style AgTab fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    style FwTab fill:#fff3e0,stroke:#e65100,color:#bf360c
    style LogTab fill:#e0f7fa,stroke:#00838f,color:#006064
    style MktTab fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
    style Feed fill:#fffde7,stroke:#f9a825,color:#f57f17
    style Input fill:#fffde7,stroke:#f9a825,color:#f57f17
    style Audit fill:#fff8e1,stroke:#ff8f00,color:#e65100
    style Chat fill:#fff8e1,stroke:#ff8f00,color:#e65100
    style Events fill:#fff8e1,stroke:#ff8f00,color:#e65100
    style AM fill:#fff3e0,stroke:#e65100,color:#bf360c
    style CRE fill:#f3e5f5,stroke:#6a1b9a,color:#4a148c
```

---

## 12. End-to-End — Complete Happy Path

```mermaid
sequenceDiagram
    participant Agent as 🤖 AI Agent
    participant AM as 🛡️ AegisModule
    participant GP as 📊 GoPlus API
    participant BS as 🔍 BaseScan
    participant LLM as 🧠 GPT-4o + Llama-3
    participant KF as 🔑 KeystoneForwarder
    participant Safe as 💰 Smart Account

    Agent->>AM: requestAudit(BRETT)
    AM-->>GP: emit AuditRequested → CRE activates

    GP->>AM: honeypot=0 · sell_tax=0 · verified=1
    Note over AM: Phase 1 ✅ GoPlus

    BS-->>AM: 52,963 chars BrettToken.sol
    Note over AM: Phase 2 ✅ BaseScan (ConfidentialHTTP)

    LLM-->>AM: tax=false · priv=false · risk=0 (both models)
    Note over AM: Phase 3 ✅ AI Consensus

    KF->>AM: onReport(tradeId, riskCode=0)
    AM->>AM: isApproved[BRETT] = true

    Agent->>AM: triggerSwap(BRETT, 0.01 ETH)
    AM->>AM: consume clearance (CEI anti-replay)
    AM->>Safe: executeFromExecutor
    Safe->>Safe: triggerSwap() — simulated
    Safe-->>AM: SwapExecuted event emitted
```



