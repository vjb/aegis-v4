/**
 * ═══════════════════════════════════════════════════════════════
 * DedaubClient — Bytecode Decompilation via Dedaub API
 * ═══════════════════════════════════════════════════════════════
 *
 * Submits raw EVM bytecode to the Dedaub decompiler API and returns
 * human-readable Solidity-like source code.
 *
 * In the CRE oracle, this uses ConfidentialHTTPClient to keep the
 * API key sealed inside the DON. For unit tests, the fetch implementation
 * is injectable via setFetchImpl().
 *
 * Usage:
 *   const client = new DedaubClient({ apiKey: "...", baseUrl: "https://api.dedaub.com" });
 *   const decompiled = await client.submitBytecode("0x6080604052...");
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DedaubConfig {
    apiKey: string;
    baseUrl: string;
}

export class DedaubError extends Error {
    public readonly statusCode: number;
    constructor(message: string, statusCode: number = 0) {
        super(message);
        this.name = "DedaubError";
        this.statusCode = statusCode;
    }
}

type FetchImpl = (url: string, init: any) => Promise<any>;
type Logger = (msg: string) => void;

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_OUTPUT_CHARS = 15000;
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 3000;

// ─── Client ──────────────────────────────────────────────────────────────────

export class DedaubClient {
    private config: DedaubConfig;
    private fetchImpl: FetchImpl;
    private logger: Logger;

    constructor(config: DedaubConfig) {
        this.config = config;
        this.fetchImpl = globalThis.fetch?.bind(globalThis) ?? (async () => { throw new Error("No fetch implementation"); });
        this.logger = () => { };  // silent by default
    }

    /** Inject a custom fetch for testing / CRE ConfidentialHTTPClient bridge */
    setFetchImpl(impl: FetchImpl): void {
        this.fetchImpl = impl;
    }

    /** Inject a logger (e.g. nodeRuntime.log in CRE) */
    setLogger(logger: Logger): void {
        this.logger = logger;
    }

    /**
     * Submit raw EVM bytecode for decompilation.
     * @param bytecode - 0x-prefixed hex bytecode
     * @returns Decompiled Solidity-like source code
     */
    async submitBytecode(bytecode: string): Promise<string> {
        // ── Validate input ────────────────────────────────────────────────
        if (!bytecode || bytecode === "0x" || bytecode.length <= 2) {
            throw new DedaubError("Empty or invalid bytecode — nothing to decompile", 400);
        }

        // Strip 0x prefix for the API
        const cleanBytecode = bytecode.startsWith("0x")
            ? bytecode.slice(2)
            : bytecode;

        this.logger(`[DEDAUB_BETA] Submitting ${cleanBytecode.length} hex chars for decompilation`);

        // ── POST to Dedaub API ────────────────────────────────────────────
        let response: any;
        try {
            response = await this.fetchImpl(`${this.config.baseUrl}/api/v2/decompile`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": this.config.apiKey,
                },
                body: JSON.stringify({ bytecode: cleanBytecode }),
            });
        } catch (err: any) {
            this.logger(`[DEDAUB_BETA] Network error: ${err.message}`);
            throw new DedaubError(`[DEDAUB_BETA] Network error: ${err.message}`, 0);
        }

        // ── Handle errors ─────────────────────────────────────────────────
        if (!response.ok && response.status !== 202) {
            const statusCode = response.status || 0;
            this.logger(`[DEDAUB_BETA] API error: HTTP ${statusCode} ${response.statusText}`);
            throw new DedaubError(
                `[DEDAUB_BETA] API returned ${statusCode}: ${response.statusText}`,
                statusCode
            );
        }

        // ── Handle async (202 Accepted → poll for result) ─────────────────
        let result = await response.json();

        if (response.status === 202 || result.status === "pending") {
            this.logger(`[DEDAUB_BETA] Decompilation pending (md5: ${result.md5}) — polling...`);
            result = await this.pollForResult(result.md5);
        }

        // ── Extract and truncate source ───────────────────────────────────
        let source = result.source || result.decompiled || "";

        if (source.length > MAX_OUTPUT_CHARS) {
            this.logger(`[DEDAUB_BETA] Output truncated from ${source.length} to ${MAX_OUTPUT_CHARS} chars`);
            source = source.slice(0, MAX_OUTPUT_CHARS);
        }

        this.logger(`[DEDAUB_BETA] Decompilation complete: ${source.length} chars`);
        return source;
    }

    /**
     * Poll the Dedaub API until the decompilation result is ready.
     */
    private async pollForResult(md5: string): Promise<any> {
        for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
            this.logger(`[DEDAUB_BETA] Poll attempt ${attempt}/${MAX_POLL_ATTEMPTS}...`);

            await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

            try {
                const response = await this.fetchImpl(
                    `${this.config.baseUrl}/api/v2/decompile/${md5}`,
                    {
                        method: "GET",
                        headers: { "x-api-key": this.config.apiKey },
                    }
                );

                if (!response.ok) continue;

                const result = await response.json();
                if (result.source || result.decompiled) {
                    this.logger(`[DEDAUB_BETA] Decompilation ready after ${attempt} polls`);
                    return result;
                }
            } catch {
                // Retry on network errors
            }
        }

        throw new DedaubError(
            `[DEDAUB_BETA] Decompilation timed out after ${MAX_POLL_ATTEMPTS} attempts`,
            408
        );
    }
}
