/**
 * ═══════════════════════════════════════════════════════════════
 * HeimdallLive.test.ts — LIVE Integration Tests (ZERO MOCKING)
 * ═══════════════════════════════════════════════════════════════
 *
 * Every test hits REAL infrastructure:
 *   - Local Heimdall microservice on localhost:8080
 *   - Base Sepolia RPC for eth_getCode
 *   - BaseScan API for verification check
 *
 * Prerequisites:
 *   docker run -d -p 8080:8080 --name aegis-heimdall aegis-heimdall
 */

import * as dotenv from "dotenv";
dotenv.config();

const HEIMDALL_URL = "http://localhost:8080";
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";

// Known contract addresses on Base Sepolia
const AEGIS_MODULE = process.env.AEGIS_MODULE_ADDRESS || "0x23EfaEF29EcC0e6CE313F0eEd3d5dA7E0f5Bcd89";

// ─── Helper: fetch with timeout ──────────────────────────────────────────────
async function fetchWithTimeout(url: string, opts: RequestInit, timeoutMs = 60000): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...opts, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// ─── Helper: get bytecode from Base Sepolia via live RPC ─────────────────────
async function getLiveBytecode(address: string): Promise<string> {
    const res = await fetchWithTimeout(BASE_SEPOLIA_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            jsonrpc: "2.0",
            method: "eth_getCode",
            params: [address, "latest"],
            id: 1,
        }),
    });
    const body = await res.json() as any;
    return body.result || "0x";
}

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 2: Local Heimdall Microservice Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("Phase 2: Live Heimdall Microservice", () => {
    // Increased timeout — Heimdall decompilation can take 30+ seconds
    jest.setTimeout(120000);

    it("GET /health should return ok with Heimdall version", async () => {
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/health`, { method: "GET" });
        expect(res.status).toBe(200);

        const body = await res.json() as any;
        expect(body.status).toBe("ok");
        expect(body.heimdall).toBeDefined();
        expect(body.heimdall).toContain("heimdall");
    });

    it("POST /decompile should return decompiled logic for known bytecode", async () => {
        // Fetch REAL bytecode from Base Sepolia
        const bytecode = await getLiveBytecode(AEGIS_MODULE);
        expect(bytecode.length).toBeGreaterThan(10);

        // Send to LIVE local Heimdall service
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/decompile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bytecode }),
        }, 120000);

        expect(res.status).toBe(200);

        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.decompiled).toBeDefined();
        expect(body.decompiled.length).toBeGreaterThan(0);
        expect(body.bytecodeLength).toBeGreaterThan(10);

        console.log(`[TEST] Decompiled ${body.bytecodeLength} hex chars → ${body.decompiled.length} chars in ${body.elapsedMs}ms`);
        console.log(`[TEST] First 300 chars:\n${body.decompiled.slice(0, 300)}`);
    });

    it("POST /decompile should reject empty bytecode", async () => {
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/decompile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bytecode: "" }),
        });

        expect(res.status).toBe(400);
        const body = await res.json() as any;
        expect(body.success).toBe(false);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// PHASE 3: Live Base Sepolia Pipeline Tests
// ═════════════════════════════════════════════════════════════════════════════

describe("Phase 3: Live Base Sepolia Pipeline", () => {
    jest.setTimeout(120000);

    it("should fetch live bytecode from Base Sepolia via eth_getCode", async () => {
        const bytecode = await getLiveBytecode(AEGIS_MODULE);

        expect(bytecode).toBeDefined();
        expect(bytecode.startsWith("0x")).toBe(true);
        expect(bytecode.length).toBeGreaterThan(100);

        console.log(`[TEST] Live bytecode for AegisModule: ${bytecode.length} hex chars`);
    });

    it("should fetch bytecode AND decompile via full pipeline", async () => {
        // Step 1: Live RPC to Base Sepolia
        const bytecode = await getLiveBytecode(AEGIS_MODULE);
        expect(bytecode.length).toBeGreaterThan(100);

        // Step 2: Live call to local Heimdall microservice
        const res = await fetchWithTimeout(`${HEIMDALL_URL}/decompile`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bytecode }),
        }, 120000);

        expect(res.status).toBe(200);
        const body = await res.json() as any;
        expect(body.success).toBe(true);
        expect(body.decompiled.length).toBeGreaterThan(0);

        // The decompiled output should contain function-like structures
        const hasStructure = body.decompiled.includes("function") ||
            body.decompiled.includes("CALL") ||
            body.decompiled.includes("JUMPDEST") ||
            body.decompiled.includes("storage");
        expect(hasStructure).toBe(true);

        console.log(`[TEST] Full pipeline: Base Sepolia → Heimdall → ${body.decompiled.length} chars of decompiled code`);
    });
});
