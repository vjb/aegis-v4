/**
 * ═══════════════════════════════════════════════════════════════
 * Dedaub Pipeline Fallback — Integration Tests (TDD Red Phase)
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests that the CRE oracle pipeline correctly:
 * 1. Uses BaseScan source when contract IS verified
 * 2. Falls back to Dedaub decompilation when contract is NOT verified
 * 3. Skips AI entirely only if BOTH BaseScan AND Dedaub produce nothing
 */

import {
    fetchSourceCode,
    SourceResult,
} from "../cre-node/sourceResolver";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const VERIFIED_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract VerifiedToken {
    function transfer(address to, uint256 amount) public returns (bool) {
        return true;
    }
}`;

const DECOMPILED_SOURCE = `// Decompiled by Dedaub
function transfer(address arg0, uint256 arg1) public {
    require(stor_allowlist[msg.sender], "Not allowed");
    balances[arg0] += arg1;
}`;

const SAMPLE_BYTECODE = "0x608060405234801561001057600080fd5b50610150806100206000396000f3fe";

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("Source Resolver — Pipeline Fallback", () => {

    // ── BaseScan Path ─────────────────────────────────────────────────────

    describe("verified contracts (BaseScan path)", () => {
        it("should return BaseScan source when contract is verified", async () => {
            const result = await fetchSourceCode({
                address: "0x1234567890abcdef1234567890abcdef12345678",
                mockBaseScan: { source: VERIFIED_SOURCE, name: "VerifiedToken" },
                mockDedaub: null,
                mockBytecode: null,
                logger: () => { },
            });

            expect(result.source).toBe(VERIFIED_SOURCE);
            expect(result.provider).toBe("basescan");
            expect(result.contractName).toBe("VerifiedToken");
            expect(result.isDecompiled).toBe(false);
        });

        it("should NOT call Dedaub when BaseScan succeeds", async () => {
            const dedaubCalled = { value: false };

            await fetchSourceCode({
                address: "0x1234567890abcdef1234567890abcdef12345678",
                mockBaseScan: { source: VERIFIED_SOURCE, name: "VerifiedToken" },
                mockDedaub: () => { dedaubCalled.value = true; return DECOMPILED_SOURCE; },
                mockBytecode: SAMPLE_BYTECODE,
                logger: () => { },
            });

            expect(dedaubCalled.value).toBe(false);
        });
    });

    // ── Dedaub Fallback Path ──────────────────────────────────────────────

    describe("unverified contracts (Dedaub fallback)", () => {
        it("should fall back to Dedaub when BaseScan returns no source", async () => {
            const result = await fetchSourceCode({
                address: "0xdeadbeef00000000000000000000000000000000",
                mockBaseScan: { source: "", name: "" },  // unverified
                mockDedaub: () => DECOMPILED_SOURCE,
                mockBytecode: SAMPLE_BYTECODE,
                logger: () => { },
            });

            expect(result.source).toBe(DECOMPILED_SOURCE);
            expect(result.provider).toBe("dedaub");
            expect(result.isDecompiled).toBe(true);
        });

        it("should fetch bytecode via eth_getCode before calling Dedaub", async () => {
            const bytecodeFetched = { value: false };

            await fetchSourceCode({
                address: "0xdeadbeef00000000000000000000000000000000",
                mockBaseScan: { source: "", name: "" },
                mockDedaub: () => DECOMPILED_SOURCE,
                mockBytecode: () => { bytecodeFetched.value = true; return SAMPLE_BYTECODE; },
                logger: () => { },
            });

            expect(bytecodeFetched.value).toBe(true);
        });

        it("should log [DEDAUB_BETA] when falling back", async () => {
            const logs: string[] = [];

            await fetchSourceCode({
                address: "0xdeadbeef00000000000000000000000000000000",
                mockBaseScan: { source: "", name: "" },
                mockDedaub: () => DECOMPILED_SOURCE,
                mockBytecode: SAMPLE_BYTECODE,
                logger: (msg: string) => logs.push(msg),
            });

            expect(logs.some(l => l.includes("[DEDAUB_BETA]"))).toBe(true);
            expect(logs.some(l => l.includes("Unverified"))).toBe(true);
        });
    });

    // ── Double Failure Path ───────────────────────────────────────────────

    describe("both sources fail", () => {
        it("should return empty source if both BaseScan and Dedaub fail", async () => {
            const result = await fetchSourceCode({
                address: "0xdeadbeef00000000000000000000000000000000",
                mockBaseScan: { source: "", name: "" },
                mockDedaub: () => { throw new Error("Dedaub API error"); },
                mockBytecode: SAMPLE_BYTECODE,
                logger: () => { },
            });

            expect(result.source).toBe("");
            expect(result.provider).toBe("none");
            expect(result.isDecompiled).toBe(false);
        });

        it("should return empty source if bytecode fetch fails", async () => {
            const result = await fetchSourceCode({
                address: "0xdeadbeef00000000000000000000000000000000",
                mockBaseScan: { source: "", name: "" },
                mockDedaub: () => DECOMPILED_SOURCE,
                mockBytecode: "0x",  // empty contract
                logger: () => { },
            });

            expect(result.source).toBe("");
            expect(result.provider).toBe("none");
        });
    });
});
