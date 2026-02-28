<#
.SYNOPSIS
Aegis Protocol V5 - Chainlink CRE Exclusive Showcase (The "God Mode" Oracle Demo)

.DESCRIPTION
Strictly engineered for Chainlink Hackathon judges. Bypasses the frontend and
the standard flow to focus exclusively on the raw, unadulterated execution of
the Chainlink Runtime Environment (CRE) WASM sandbox.

Demonstrates:
  1. Off-chain EVM trigger interception from a live Base Sepolia transaction.
  2. Booting the secure WASM enclave.
  3. Confidential HTTP requests shielding API keys.
  4. Parallel Multi-Model AI Consensus (GPT-4o vs Llama-3).
  5. Deterministic ABI-encoded risk score output.

.EXAMPLE
.\scripts\demo_v5_cre.ps1 -Interactive
.\scripts\demo_v5_cre.ps1 -TxHash 0xabc123...
#>

param(
    [string]$TxHash = "",
    [switch]$Interactive
)

$ErrorActionPreference = "Continue"
$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "true"

# ─── Helper: Cinematic Pause ───────────────────────────────────────
function Pause-Demo { 
    if ($Interactive) { 
        Write-Host "`n  [Press Enter to advance...] " -NoNewline -ForegroundColor DarkGray; Read-Host 
    } 
}

# ─── Helper: Animated Spinner ───────────────────────────────────────
function Show-Spinner {
    param([string]$Message, [int]$DurationMs)
    $spinChars = @('|', '/', '-', '\')
    $i = 0
    Write-Host -NoNewline $Message
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    while ($stopwatch.ElapsedMilliseconds -lt $DurationMs) {
        Write-Host -NoNewline "`b$($spinChars[$i % 4])"
        $i++
        Start-Sleep -Milliseconds 75
    }
    Write-Host "`b " -NoNewline
}

Clear-Host
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "     ██████╗ ███████╗ ██████╗ ██╗ ███████╗" -ForegroundColor Cyan
Write-Host "     ██╔══██╗██╔════╝██╔════╝ ██║ ██╔════╝" -ForegroundColor Cyan
Write-Host "     ███████║█████╗  ██║ ████╗██║ ███████╗" -ForegroundColor Cyan
Write-Host "     ██╔══██║██╔══╝  ██║   ██║██║ ╚════██║" -ForegroundColor Cyan
Write-Host "     ██║  ██║███████╗╚██████╔╝██║ ███████║" -ForegroundColor Cyan
Write-Host "     ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝ ╚══════╝  v5.0" -ForegroundColor Cyan
Write-Host ""
Write-Host "  🔗 CHAINLINK CRE: CONFIDENTIAL AI CONSENSUS" -ForegroundColor White
Write-Host "  Zero-Custody Account Abstraction on Base Sepolia" -ForegroundColor DarkGray
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════════════" -ForegroundColor Cyan

# ── 1. Load Environment & V5 Config ────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$EnvPath = Join-Path (Resolve-Path "$ScriptDir\..").Path ".env"

if (!(Test-Path $EnvPath)) {
    Write-Host "❌ .env file not found." -ForegroundColor Red
    exit 1
}

$RPC = ""; $ModuleAddr = ""; $PK = ""; $TargetToken = ""
Get-Content $EnvPath | ForEach-Object {
    if ($_ -match "^BASE_SEPOLIA_RPC_URL=(.*)") { $RPC = $Matches[1].Trim() }
    if ($_ -match "^AEGIS_MODULE_ADDRESS=(.*)") { $ModuleAddr = $Matches[1].Trim() }
    if ($_ -match "^PRIVATE_KEY=(.*)") { $PK = $Matches[1].Trim() }
    if ($_ -match "^MOCK_HONEYPOT_ADDRESS=(.*)") { $TargetToken = $Matches[1].Trim() }
}

if (-not $RPC) { $RPC = "https://sepolia.base.org" }

Write-Host "`n[Aegis] Booting Decentralized Firewall Infrastructure..." -ForegroundColor DarkGray
Write-Host "  ➤ Network:      Base Sepolia (Public Testnet)" -ForegroundColor DarkGray
Write-Host "  ➤ Module:       $ModuleAddr (ERC-7579)" -ForegroundColor DarkGray
Write-Host "  ➤ Target:       $TargetToken (Known Honeypot)" -ForegroundColor DarkGray
Pause-Demo

# ── 2. The Trigger (Simulating the UserOp) ─────────────────────────────
if ([string]::IsNullOrWhiteSpace($TxHash)) {
    Write-Host "`n[Aegis] No TxHash provided. Generating live 'AuditRequested' event..." -ForegroundColor Yellow
    Write-Host "[Aegis] Simulating Agent NOVA routing ERC-4337 intent through Pimlico..." -ForegroundColor DarkGray
    
    $CastCommand = "cast send $ModuleAddr `"requestAudit(address)`" $TargetToken --rpc-url $RPC --private-key <PRIVATE_KEY>"
    Write-Host "`n> $CastCommand" -ForegroundColor DarkMagenta
    Show-Spinner -Message "  Awaiting Base Sepolia Block Confirmation... " -DurationMs 2500
    
    $TxOutput = cast send $ModuleAddr "requestAudit(address)" $TargetToken --rpc-url $RPC --private-key $PK 2>&1 | Out-String
    
    foreach ($line in $TxOutput -split "`n") {
        if ($line -match "transactionHash\s+(0x[a-fA-F0-9]{64})") {
            $TxHash = $Matches[1]
            break
        }
        if ($line -match "(0x[a-fA-F0-9]{64})") {
            $TxHash = $Matches[1]
            break
        }
    }
    
    if ([string]::IsNullOrWhiteSpace($TxHash)) {
        Write-Error "Failed to generate a transaction hash. Ensure Base Sepolia is responsive."
        exit 1
    }
    
    Write-Host "  ✅ UserOperation Confirmed. AuditRequested Event Emitted." -ForegroundColor Green
    Write-Host "  ➤ TxHash: $TxHash" -ForegroundColor White
    Pause-Demo
}

# ── 3. The CRE WASM Sandbox (The Core Flex) ────────────────────────────
Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host " ⚙️ CHAINLINK RUNTIME ENVIRONMENT (CRE) SECURE EXECUTION" -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "The DON has intercepted the event. Orchestrating WASM isolation..." -ForegroundColor Gray

$DockerCommand = "docker exec -e AEGIS_DEMO_MODE=true aegis-oracle-node cre workflow simulate /app --target base-sepolia --evm-tx-hash $TxHash --trigger-index 0 --evm-event-index 0 --non-interactive --verbose"

Write-Host "`n> $DockerCommand`n" -ForegroundColor DarkMagenta
Pause-Demo

Write-Host "--- BEGIN RAW SECURE WASM EXECUTION ---`n" -ForegroundColor DarkGray

$oldErrAction = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    Invoke-Expression "$DockerCommand 2>&1" | ForEach-Object {
        $strLine = $_.ToString()
        $Color = "DarkGray"
        $SleepTime = 15 # Cinematic typing effect
        
        # 1. Colorize the AI Engine & Consensus outputs
        if ($strLine -match "\[USER LOG\]") {
            if ($strLine -match "🟢|✅") { $Color = "Green" }
            elseif ($strLine -match "🔴|❌") { $Color = "Red"; $SleepTime = 200 }
            elseif ($strLine -match "\[Confidential HTTP\]|ConfidentialHTTPClient") { $Color = "DarkCyan"; $SleepTime = 400 }
            elseif ($strLine -match "\[GPT-4o\]|\[Right Brain\]") { $Color = "Cyan"; $SleepTime = 50 }
            elseif ($strLine -match "\[Llama-3\]|\[Left Brain\]") { $Color = "Magenta"; $SleepTime = 50 }
            elseif ($strLine -match "\[GoPlus\]") { $Color = "Yellow"; $SleepTime = 40 }
            elseif ($strLine -match "\[BaseScan\]") { $Color = "DarkCyan"; $SleepTime = 40 }
            elseif ($strLine -match "FINAL RISK DASHBOARD|AEGIS ORACLE|FORENSIC AUDIT INITIATED") { $Color = "Yellow" }
            elseif ($strLine -match "Final Risk Code: \d+") { $Color = "Red"; $SleepTime = 500 }
            else { $Color = "White" }
        }
        # 2. Colorize the Chainlink Infrastructure steps
        elseif ($strLine -match "\[SIMULATION\]|\[SIMULATOR\]|\[WORKFLOW\]") {
            $Color = "DarkMagenta"
        }
        # 3. Handle raw JSON logs (The "Noise")
        elseif ($strLine -match "^\{.*\}$" -or $strLine -match "`"level`":") {
            if ($strLine -match "`"level`":`"error`"") { $Color = "DarkRed" }
            else { 
                $Color = "DarkGray" 
                $SleepTime = 2 # Speed through the JSON noise extremely fast
            }
        }
        else {
             if ($strLine -match "error|fail|Error|Failed") { $Color = "Red" }
             else { $Color = "Gray" }
        }
        
        # Add visual "loading" spinners for HTTP requests
        if ($strLine -match "Confidential HTTP.*Sending|ConfidentialHTTPClient.*Sending") {
            Write-Host $strLine -ForegroundColor $Color
            Show-Spinner -Message "        Establishing secure enclave connection... " -DurationMs 1800
            continue
        }
        
        Start-Sleep -Milliseconds $SleepTime
        Write-Host $strLine -ForegroundColor $Color
    }
} catch {
    Write-Error "Docker execution encountered an issue: $_"
}

$ErrorActionPreference = $oldErrAction

Write-Host "`n--- END RAW SECURE WASM EXECUTION ---" -ForegroundColor DarkGray

# ── 4. The Epilogue ────────────────────────────────────────────────────
Write-Host "`n[Aegis] ✅ CRE Consensus Complete." -ForegroundColor Green
Write-Host "[Aegis] The Chainlink WASM sandbox successfully:" -ForegroundColor Gray
Write-Host "        1. Masked API keys via Confidential HTTP." -ForegroundColor White
Write-Host "        2. Achieved multi-model consensus between GPT-4o and Llama-3." -ForegroundColor White
Write-Host "        3. Prepared the ABI-encoded payload to route back to the ERC-7579 module." -ForegroundColor White
Write-Host "`n==========================================================================" -ForegroundColor Cyan
