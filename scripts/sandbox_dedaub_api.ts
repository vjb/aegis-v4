/**
 * ═══════════════════════════════════════════════════════════════
 * SANDBOX: Dedaub API Authentication Debugging
 * ═══════════════════════════════════════════════════════════════
 * 
 * Isolated script — NO CRE, NO pipeline, just raw HTTP.
 * 3 attempts max. Target: 200 OK.
 */

import * as dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.DEDAUB_API_KEY;
const TARGET_ADDRESS = "0xe576457db751c1c4e5a69fbb222425d98733b4a0";

// ─── Logging ─────────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  🔬 SANDBOX: Dedaub API Debug");
console.log("═══════════════════════════════════════════════════════════════\n");

console.log(`[ENV] DEDAUB_API_KEY defined: ${!!API_KEY}`);
console.log(`[ENV] DEDAUB_API_KEY length: ${API_KEY?.length ?? 0}`);
console.log(`[ENV] DEDAUB_API_KEY prefix: ${API_KEY?.slice(0, 12)}...`);
console.log(`[ENV] Target: ${TARGET_ADDRESS}\n`);

if (!API_KEY) {
    console.error("❌ DEDAUB_API_KEY is undefined — check .env");
    process.exit(1);
}

let attempt = 0;
const MAX_ATTEMPTS = 3;

async function tryRequest(label: string, url: string, opts: RequestInit): Promise<boolean> {
    attempt++;
    console.log(`\n━━━ ATTEMPT ${attempt}/${MAX_ATTEMPTS}: ${label} ━━━`);
    console.log(`[REQ] URL: ${url}`);
    console.log(`[REQ] Method: ${opts.method}`);
    console.log(`[REQ] Headers: ${JSON.stringify(Object.fromEntries(Object.entries(opts.headers as Record<string, string>)))}`);
    if (opts.body) console.log(`[REQ] Body (first 200): ${String(opts.body).slice(0, 200)}`);

    try {
        const res = await fetch(url, opts);
        console.log(`[RES] Status: ${res.status} ${res.statusText}`);
        const text = await res.text();
        console.log(`[RES] Body (first 500): ${text.slice(0, 500)}`);

        if (res.ok) {
            console.log(`\n✅ SUCCESS — 200 OK on attempt ${attempt}!`);
            return true;
        }
        return false;
    } catch (err: any) {
        console.log(`[ERR] ${err.message}`);
        return false;
    }
}

async function main() {
    // ── ATTEMPT 1: Strict X-API-Key header, POST bytecode by address ─────
    // Dedaub docs say X-API-Key. Try with address instead of raw bytecode.
    const ok1 = await tryRequest(
        "X-API-Key + address-based decompile",
        "https://api.dedaub.com/api/v2/decompile",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
            },
            body: JSON.stringify({
                address: TARGET_ADDRESS,
                network: "base-sepolia",
            }),
        }
    );
    if (ok1) return process.exit(0);

    // ── ATTEMPT 2: Try with network "base" and different body format ─────
    // Maybe "base-sepolia" isn't recognized. Try mainnet-style or just address.
    const ok2 = await tryRequest(
        "X-API-Key + address only (no network)",
        "https://api.dedaub.com/api/v2/decompile",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
            },
            body: JSON.stringify({
                address: "0x532f27101965dd16442E59d40670FaF5eBB142E4",  // BRETT on Base mainnet
                network: "base",
            }),
        }
    );
    if (ok2) return process.exit(0);

    // ── ATTEMPT 3: Try the Watchdog/public endpoint with raw bytecode ────
    // Some Dedaub endpoints use /api/v3/ or just /v2/
    const sampleBytecode = "608060405234801561001057600080fd5b506004361061002b5760003560e01c8063a9059cbb14610030575b600080fd5b005b600080fd";
    const ok3 = await tryRequest(
        "X-API-Key + raw bytecode + /api/v3/decompile",
        "https://api.dedaub.com/api/v3/decompile",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-API-Key": API_KEY,
            },
            body: JSON.stringify({ bytecode: sampleBytecode }),
        }
    );
    if (ok3) return process.exit(0);

    // ── ALL ATTEMPTS FAILED ──────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════════════════");
    console.log("  MAX RETRIES REACHED - ABORTING DEDAUB INTEGRATION");
    console.log("═══════════════════════════════════════════════════════════════\n");
    process.exit(1);
}

main();
