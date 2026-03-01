/**
 * ═══════════════════════════════════════════════════════════════
 * DedaubClient — Unit Tests (TDD Red Phase)
 * ═══════════════════════════════════════════════════════════════
 *
 * Tests for the Dedaub bytecode decompilation client.
 * Written FIRST (red) — implementation comes after.
 */

import { DedaubClient, DedaubError } from "../cre-node/DedaubClient";

// ─── Mock Data ───────────────────────────────────────────────────────────────
const SAMPLE_BYTECODE =
    "0x608060405234801561001057600080fd5b506004361061002b5760003560e01c8063a9059cbb14610030575b600080fd5b61004a600480360381019061004591906100e4565b61004c565b005b600080fd5b600080fd";

const MOCK_DECOMPILED = `// Decompiled by Dedaub
// Address: 0x1234...
// Compiler: solc v0.8.20

function transfer(address to, uint256 amount) public {
    revert();
}`;

// ─── Test Suite ──────────────────────────────────────────────────────────────

describe("DedaubClient", () => {
    let client: DedaubClient;

    beforeEach(() => {
        client = new DedaubClient({
            apiKey: "test-api-key-12345",
            baseUrl: "https://api.dedaub.com",
        });
    });

    // ── Core Decompilation ────────────────────────────────────────────────

    describe("submitBytecode", () => {
        it("should accept 0x-prefixed bytecode and return decompiled string", async () => {
            // Mock the HTTP layer
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({
                    md5: "abc123",
                    source: MOCK_DECOMPILED,
                }),
            });
            client.setFetchImpl(mockFetch);

            const result = await client.submitBytecode(SAMPLE_BYTECODE);

            expect(result).toBeDefined();
            expect(typeof result).toBe("string");
            expect(result.length).toBeGreaterThan(0);
            expect(result).toContain("function");
        });

        it("should strip 0x prefix before sending to API", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ md5: "abc123", source: MOCK_DECOMPILED }),
            });
            client.setFetchImpl(mockFetch);

            await client.submitBytecode(SAMPLE_BYTECODE);

            // Verify the bytecode sent to API does not have 0x prefix
            const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
            expect(callBody.bytecode).not.toMatch(/^0x/);
        });

        it("should include API key in request headers", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ md5: "abc123", source: MOCK_DECOMPILED }),
            });
            client.setFetchImpl(mockFetch);

            await client.submitBytecode(SAMPLE_BYTECODE);

            const headers = mockFetch.mock.calls[0][1].headers;
            expect(
                headers["x-api-key"] || headers["Authorization"]
            ).toBeDefined();
        });

        it("should truncate output exceeding 15000 chars", async () => {
            const longSource = "x".repeat(20000);
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ md5: "abc123", source: longSource }),
            });
            client.setFetchImpl(mockFetch);

            const result = await client.submitBytecode(SAMPLE_BYTECODE);
            expect(result.length).toBeLessThanOrEqual(15000);
        });
    });

    // ── Error Handling ────────────────────────────────────────────────────

    describe("error handling", () => {
        it("should throw DedaubError on 401 Unauthorized", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 401,
                statusText: "Unauthorized",
                json: async () => ({ error: "Invalid API key" }),
            });
            client.setFetchImpl(mockFetch);

            await expect(
                client.submitBytecode(SAMPLE_BYTECODE)
            ).rejects.toThrow(DedaubError);
            await expect(
                client.submitBytecode(SAMPLE_BYTECODE)
            ).rejects.toThrow(/401/);
        });

        it("should throw DedaubError on 500 Server Error", async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
                json: async () => ({ error: "Server error" }),
            });
            client.setFetchImpl(mockFetch);

            await expect(
                client.submitBytecode(SAMPLE_BYTECODE)
            ).rejects.toThrow(DedaubError);
        });

        it("should throw on empty bytecode", async () => {
            await expect(client.submitBytecode("")).rejects.toThrow();
            await expect(client.submitBytecode("0x")).rejects.toThrow();
        });

        it("should throw on network timeout", async () => {
            const mockFetch = jest
                .fn()
                .mockRejectedValue(new Error("Network timeout"));
            client.setFetchImpl(mockFetch);

            await expect(
                client.submitBytecode(SAMPLE_BYTECODE)
            ).rejects.toThrow(/timeout/i);
        });
    });

    // ── Async Polling (if API returns pending) ────────────────────────────

    describe("async polling", () => {
        it("should poll if initial response indicates processing", async () => {
            const mockFetch = jest
                .fn()
                .mockResolvedValueOnce({
                    ok: true,
                    status: 202,
                    json: async () => ({
                        md5: "abc123",
                        status: "pending",
                    }),
                })
                .mockResolvedValueOnce({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        md5: "abc123",
                        source: MOCK_DECOMPILED,
                    }),
                });
            client.setFetchImpl(mockFetch);

            const result = await client.submitBytecode(SAMPLE_BYTECODE);
            expect(result).toContain("function");
            expect(mockFetch).toHaveBeenCalledTimes(2);
        });
    });

    // ── Logging ───────────────────────────────────────────────────────────

    describe("logging", () => {
        it("should call logger with [DEDAUB_BETA] prefix", async () => {
            const logs: string[] = [];
            client.setLogger((msg: string) => logs.push(msg));

            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                status: 200,
                json: async () => ({ md5: "abc123", source: MOCK_DECOMPILED }),
            });
            client.setFetchImpl(mockFetch);

            await client.submitBytecode(SAMPLE_BYTECODE);

            expect(logs.length).toBeGreaterThan(0);
            expect(logs.every((l) => l.startsWith("[DEDAUB_BETA]"))).toBe(
                true
            );
        });
    });
});
