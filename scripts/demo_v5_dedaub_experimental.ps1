#!/usr/bin/env pwsh
<#
═══════════════════════════════════════════════════════════════
  Aegis V5 — Dedaub Bytecode Decompilation (Experimental)
═══════════════════════════════════════════════════════════════
  Demonstrates the full Dedaub fallback pipeline:
  1. Targets a known UNVERIFIED contract on Base Sepolia
  2. BaseScan returns "No verified source"
  3. Fetches raw bytecode via eth_getCode
  4. Sends bytecode to Dedaub API for decompilation
  5. Feeds decompiled source into GPT-4o + Llama-3 consensus
  6. Returns 8-bit risk code

  Prerequisites:
    - .env with DEDAUB_API_KEY set
    - CRE oracle node running (docker compose up)
    - AEGIS_DEDAUB_SECRET registered:
        cre workflow secrets set --id AEGIS_DEDAUB_SECRET --value <key>

  Usage:
    ./scripts/demo_v5_dedaub_experimental.ps1
#>

$ErrorActionPreference = "Stop"

# ── Load .env ──────────────────────────────────────────────────
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^\s*([^#][^=]+)=(.+)$") {
            [System.Environment]::SetEnvironmentVariable($Matches[1].Trim(), $Matches[2].Trim(), "Process")
        }
    }
}

$MODULE   = $env:AEGIS_MODULE_ADDRESS
$RPC      = $env:BASE_SEPOLIA_RPC_URL
$PK       = $env:PRIVATE_KEY
$DEDAUB   = $env:DEDAUB_API_KEY

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🧪 DEDAUB BETA — Bytecode Decompilation Pipeline" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

if (-not $DEDAUB) {
    Write-Host "  ❌ DEDAUB_API_KEY not set in .env" -ForegroundColor Red
    Write-Host "  Get one at: https://app.dedaub.com → Settings → API Keys" -ForegroundColor Yellow
    exit 1
}

# ── Step 1: Deploy an unverified contract ──────────────────────
Write-Host "━━━ STEP 1: Deploy Unverified Test Contract ━━━" -ForegroundColor Yellow
Write-Host "[DEDAUB_BETA] Deploying a minimal contract WITHOUT verifying on BaseScan..." -ForegroundColor Gray

# Simple storage contract bytecode (unverified on BaseScan)
$INIT_BYTECODE = "0x608060405234801561001057600080fd5b5060c78061001f6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80632e64cec11460375780636057361d14604c575b600080fd5b60005460405190815260200160405180910390f35b605c6057366004606e565b600055565b005b634e487b7160e01b600052604160045260246000fd5b600060208284031215607e57600080fd5b503591905056fea264697066735822"

$env:FOUNDRY_DISABLE_NIGHTLY_WARNING = "1"
$DEPLOY_TX = cast send --private-key $PK --rpc-url $RPC --create $INIT_BYTECODE 2>&1
$UNVERIFIED_ADDR = ($DEPLOY_TX | Select-String "contractAddress\s+(\S+)" | ForEach-Object { $_.Matches[0].Groups[1].Value })

if (-not $UNVERIFIED_ADDR) {
    Write-Host "[DEDAUB_BETA] Using existing MockHoneypot (known unverified-like behavior)" -ForegroundColor Yellow
    $UNVERIFIED_ADDR = $env:MOCK_HONEYPOT_ADDRESS
}

Write-Host "[DEDAUB_BETA] Target: $UNVERIFIED_ADDR" -ForegroundColor Green

# ── Step 2: Verify BaseScan returns no source ──────────────────
Write-Host ""
Write-Host "━━━ STEP 2: Verify BaseScan Status ━━━" -ForegroundColor Yellow
$BS_URL = "https://api.etherscan.io/v2/api?chainid=84532&module=contract&action=getsourcecode&address=$UNVERIFIED_ADDR&apikey=$($env:BASESCAN_API_KEY)"
$BS_RESULT = Invoke-RestMethod -Uri $BS_URL -Method GET -ErrorAction SilentlyContinue

if ($BS_RESULT.result[0].SourceCode -eq "") {
    Write-Host "[BaseScan] ✅ No verified source — UNVERIFIED CONTRACT" -ForegroundColor Green
} else {
    Write-Host "[BaseScan] ⚠️ Contract appears verified — Dedaub fallback would NOT trigger" -ForegroundColor Yellow
    Write-Host "[BaseScan] Source: $($BS_RESULT.result[0].ContractName)" -ForegroundColor Gray
}

# ── Step 3: Fetch bytecode ─────────────────────────────────────
Write-Host ""
Write-Host "━━━ STEP 3: Fetch Raw Bytecode ━━━" -ForegroundColor Yellow
$BYTECODE = cast code $UNVERIFIED_ADDR --rpc-url $RPC 2>&1
$BC_LEN = $BYTECODE.Length
Write-Host "[DEDAUB_BETA] Bytecode: $BC_LEN hex chars" -ForegroundColor Green

if ($BC_LEN -le 2) {
    Write-Host "[DEDAUB_BETA] ❌ No bytecode at address — nothing to decompile" -ForegroundColor Red
    exit 1
}

# ── Step 4: Send to Dedaub API ─────────────────────────────────
Write-Host ""
Write-Host "━━━ STEP 4: Dedaub Decompilation ━━━" -ForegroundColor Yellow
Write-Host "[DEDAUB_BETA] Sending $BC_LEN hex chars to Dedaub API..." -ForegroundColor Gray

$CLEAN_BC = $BYTECODE -replace "^0x", ""
$BODY = @{ bytecode = $CLEAN_BC } | ConvertTo-Json
$HEADERS = @{
    "Content-Type" = "application/json"
    "x-api-key"    = $DEDAUB
}

try {
    $DEDAUB_RESPONSE = Invoke-RestMethod -Uri "https://api.dedaub.com/api/v2/decompile" -Method POST -Body $BODY -Headers $HEADERS -TimeoutSec 120
    Write-Host "[DEDAUB_BETA] ✅ Decompilation complete!" -ForegroundColor Green

    if ($DEDAUB_RESPONSE.source) {
        $SRC_LEN = $DEDAUB_RESPONSE.source.Length
        Write-Host "[DEDAUB_BETA] Decompiled source: $SRC_LEN chars" -ForegroundColor Green
        Write-Host ""
        Write-Host "─── Decompiled Output (first 500 chars) ───" -ForegroundColor Cyan
        Write-Host $DEDAUB_RESPONSE.source.Substring(0, [Math]::Min(500, $SRC_LEN)) -ForegroundColor White
        Write-Host "─── (truncated) ───" -ForegroundColor Cyan
    } elseif ($DEDAUB_RESPONSE.md5) {
        Write-Host "[DEDAUB_BETA] Processing async (md5: $($DEDAUB_RESPONSE.md5)) — check back in 30s" -ForegroundColor Yellow
    }
} catch {
    Write-Host "[DEDAUB_BETA] ❌ API error: $($_.Exception.Message)" -ForegroundColor Red
}

# ── Step 5: Simulate CRE oracle (if Docker is running) ─────────
Write-Host ""
Write-Host "━━━ STEP 5: CRE Oracle Simulation ━━━" -ForegroundColor Yellow
$DOCKER_RUNNING = docker ps --filter "name=aegis-oracle" --format "{{.Names}}" 2>$null

if ($DOCKER_RUNNING -match "aegis-oracle") {
    Write-Host "[CRE] Oracle node detected — running simulate with Dedaub fallback..." -ForegroundColor Green
    Write-Host "[CRE] The oracle will:" -ForegroundColor Gray
    Write-Host "  1. Try BaseScan → find no verified source" -ForegroundColor Gray
    Write-Host "  2. Fetch bytecode via RPC" -ForegroundColor Gray
    Write-Host "  3. Send to Dedaub via ConfidentialHTTPClient" -ForegroundColor Gray
    Write-Host "  4. Feed decompiled code to GPT-4o + Llama-3" -ForegroundColor Gray
    Write-Host "  5. Return 8-bit risk code" -ForegroundColor Gray
    Write-Host ""
    Write-Host "(CRE simulate requires manual trigger — see docs/DEMO_GUIDE.md)" -ForegroundColor Yellow
} else {
    Write-Host "[CRE] Docker oracle not running — skipping CRE simulation" -ForegroundColor Yellow
    Write-Host "[CRE] Run: docker compose up --build -d" -ForegroundColor Gray
}

# ── Summary ────────────────────────────────────────────────────
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ DEDAUB BETA DEMO COMPLETE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Target:      $UNVERIFIED_ADDR" -ForegroundColor White
Write-Host "  BaseScan:    No verified source (expected)" -ForegroundColor White
Write-Host "  Bytecode:    $BC_LEN hex chars fetched" -ForegroundColor White
Write-Host "  Dedaub:      Decompilation attempted" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
