/**
 * ═══════════════════════════════════════════════════════════════
 * Source Resolver — BaseScan → Dedaub Fallback Pipeline
 * ═══════════════════════════════════════════════════════════════
 *
 * Orchestrates contract source code retrieval:
 * 1. Try BaseScan (verified source code)
 * 2. If unverified → fetch bytecode → Dedaub decompilation
 * 3. If both fail → return empty (bit 0 set, AI skipped)
 *
 * This module is testable independently of the CRE oracle by
 * accepting mock implementations for BaseScan, Dedaub, and RPC.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SourceResult {
    source: string;
    contractName: string;
    provider: "basescan" | "dedaub" | "mock" | "none";
    isDecompiled: boolean;
}

export interface FetchSourceOptions {
    address: string;
    logger: (msg: string) => void;

    // Mockable dependencies (for testing)
    mockBaseScan?: { source: string; name: string } | null;
    mockDedaub?: (() => string) | null;
    mockBytecode?: string | (() => string) | null;
}

// ─── Main Function ───────────────────────────────────────────────────────────

export async function fetchSourceCode(
    opts: FetchSourceOptions
): Promise<SourceResult> {
    const { address, logger } = opts;

    // ── Step 1: Try BaseScan ──────────────────────────────────────────────
    if (opts.mockBaseScan && opts.mockBaseScan.source && opts.mockBaseScan.source.length > 0) {
        logger(`[BaseScan] Verified source found for ${address} (${opts.mockBaseScan.source.length} chars)`);
        return {
            source: opts.mockBaseScan.source,
            contractName: opts.mockBaseScan.name,
            provider: "basescan",
            isDecompiled: false,
        };
    }

    // ── Step 2: BaseScan failed → try Dedaub fallback ─────────────────────
    logger(`[DEDAUB_BETA] Unverified contract at ${address} — attempting bytecode decompilation`);

    // Step 2a: Fetch bytecode
    let bytecode = "";
    if (opts.mockBytecode) {
        if (typeof opts.mockBytecode === "function") {
            bytecode = opts.mockBytecode();
        } else {
            bytecode = opts.mockBytecode;
        }
    }

    // If bytecode is empty or just 0x, no point calling Dedaub
    if (!bytecode || bytecode === "0x" || bytecode.length <= 2) {
        logger(`[DEDAUB_BETA] No bytecode found for ${address} — skipping decompilation`);
        return {
            source: "",
            contractName: "",
            provider: "none",
            isDecompiled: false,
        };
    }

    logger(`[DEDAUB_BETA] Bytecode fetched: ${bytecode.length} hex chars`);

    // Step 2b: Call Dedaub
    if (opts.mockDedaub) {
        try {
            const decompiled = opts.mockDedaub();
            if (decompiled && decompiled.length > 0) {
                logger(`[DEDAUB_BETA] Decompilation successful: ${decompiled.length} chars`);
                return {
                    source: decompiled,
                    contractName: `Decompiled_${address.slice(0, 10)}`,
                    provider: "dedaub",
                    isDecompiled: true,
                };
            }
        } catch (err: any) {
            logger(`[DEDAUB_BETA] Decompilation failed: ${err.message}`);
        }
    }

    // ── Step 3: Both failed ───────────────────────────────────────────────
    logger(`[DEDAUB_BETA] All source retrieval methods exhausted — AI will be skipped, bit 0 set`);
    return {
        source: "",
        contractName: "",
        provider: "none",
        isDecompiled: false,
    };
}
