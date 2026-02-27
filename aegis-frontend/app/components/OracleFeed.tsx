'use client';

import { useState, useEffect, useRef } from 'react';
import { BrainCircuit, CheckCircle, XCircle, Loader2, Send, ChevronRight, Activity, AlertTriangle } from 'lucide-react';

type Phase = { label: string; status: 'pending' | 'running' | 'done' | 'error' };
type LLMBlock = { model: string; text: string; score?: number };
type Verdict = {
    status: 'APPROVED' | 'BLOCKED' | 'ERROR';
    score: number;
    targetToken: string;
    reasoning: string;
    checks: { name: string; triggered: boolean }[];
    hash?: string;
    explorerUrl?: string;
    callbackExplorerUrl?: string;
};

// Clean tokens — oracle will approve
const CLEAN_TOKENS = ['BRETT', 'TOSHI', 'DEGEN', 'WETH'];
// Malicious tokens — oracle will BLOCK
const MALICIOUS_TOKENS = [
    { label: 'Honeypot', desc: 'Bit 2 — can\'t sell' },
    { label: 'TaxToken', desc: 'Bit 1 — 99% sell tax' },
    { label: 'TimeBomb', desc: 'Bit 7 — logic bomb' },
    { label: 'UnverifiedDoge', desc: 'Bit 0 — no source' },
];

export default function OracleFeed({ isKilled, externalTrigger, onTriggerConsumed, onComplete }: {
    isKilled: boolean;
    externalTrigger: string | null;
    onTriggerConsumed: () => void;
    onComplete?: () => void;
}) {
    const [token, setToken] = useState('BRETT');
    const [running, setRunning] = useState(false);
    const [phases, setPhases] = useState<Phase[]>([]);
    const [llmBlocks, setLlmBlocks] = useState<LLMBlock[]>([]);
    const [verdict, setVerdict] = useState<Verdict | null>(null);
    const [error, setError] = useState<string | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (externalTrigger && !running) {
            setToken(externalTrigger);
            onTriggerConsumed();
            setTimeout(() => runAudit(externalTrigger), 150);
        }
    }, [externalTrigger]);

    useEffect(() => {
        feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
    }, [phases, llmBlocks, verdict]);

    const upsertPhase = (label: string, status: Phase['status']) => {
        setPhases(prev => {
            const idx = prev.findIndex(p => p.label === label);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = { ...next[idx], status };
                return next;
            }
            return [...prev, { label, status }];
        });
    };

    const runAudit = async (tok?: string) => {
        const target = tok || token;
        if (running || isKilled) return;

        setRunning(true);
        setVerdict(null);
        setError(null);
        setLlmBlocks([]);
        setPhases([{ label: 'Connecting to Chainlink CRE DON', status: 'running' }]);

        try {
            // auditOnly=true → no JIT swap from the UI
            const res = await fetch(`/api/audit?token=${encodeURIComponent(target)}&amount=0.1&auditOnly=true`);
            if (!res.body) throw new Error('No stream returned');

            const reader = res.body.getReader();
            const dec = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += dec.decode(value, { stream: true });
                const lines = buf.split('\n\n');
                buf = lines.pop() || '';
                for (const chunk of lines) {
                    if (!chunk.startsWith('data: ')) continue;
                    try { handleEvent(JSON.parse(chunk.slice(6))); } catch { /* ignore parse err */ }
                }
            }
        } catch (e: any) {
            setError(e.message || 'Stream failed');
            setRunning(false);
        }
    };

    const handleEvent = (data: any) => {
        switch (data.type) {
            case 'phase': {
                upsertPhase(data.phase, 'done');
                const NEXT: Record<string, string> = {
                    'Connecting to Chainlink CRE DON': `Submitting requestAudit() on-chain`,
                    'Spinning up Oracle Brain': 'GoPlus — Static Analysis',
                    'GoPlus — Static Analysis': 'BaseScan — Contract Source',
                    'BaseScan — Contract Source': 'AI Consensus (GPT-4o + Llama-3)',
                    'AI Consensus (GPT-4o + Llama-3)': 'Computing Risk Code',
                    'Computing Risk Code': 'Committing via onReportDirect()',
                    'Executing Cryptographic Callback via DON...': 'Committing via onReportDirect()',
                    'Committing verdict on-chain': 'Finalising CRE verdict',
                };
                const nxt = Object.entries(NEXT).find(([k]) => data.phase.includes(k.slice(0, 20)))?.[1];
                if (nxt) upsertPhase(nxt, 'running');
                break;
            }
            case 'static-analysis': {
                const isGoPlus = data.source?.includes('GoPlus');
                const isBaseScan = data.source?.includes('BaseScan');
                if (isGoPlus) {
                    data.status === 'pending'
                        ? upsertPhase('GoPlus — Static Analysis', 'running')
                        : (upsertPhase('GoPlus — Static Analysis', 'done'), upsertPhase('BaseScan — Contract Source', 'running'));
                } else if (isBaseScan) {
                    data.status === 'pending'
                        ? upsertPhase('BaseScan — Contract Source', 'running')
                        : (upsertPhase('BaseScan — Contract Source', 'done'), upsertPhase('AI Consensus (GPT-4o + Llama-3)', 'running'));
                }
                break;
            }
            case 'llm-reasoning-start': {
                setLlmBlocks(prev => [...prev, { model: data.model, text: '' }]);
                upsertPhase('AI Consensus (GPT-4o + Llama-3)', 'running');
                break;
            }
            case 'llm-reasoning-chunk': {
                setLlmBlocks(prev => prev.map(b => b.model === data.model ? { ...b, text: b.text + data.text } : b));
                break;
            }
            case 'llm-score': {
                setLlmBlocks(prev => prev.map(b => b.model === data.model ? { ...b, score: ((b.score ?? 0) | data.bit) } : b));
                break;
            }
            case 'tx': {
                upsertPhase(`Submitting requestAudit() on-chain`, 'done');
                upsertPhase('Spinning up Oracle Brain', 'running');
                break;
            }
            case 'tx-status': {
                upsertPhase('Committing via onReportDirect()', data.status === 'Confirmed' ? 'done' : 'error');
                break;
            }
            case 'final_verdict': {
                setVerdict(data.payload);
                setPhases(prev => prev.map(p => p.status === 'running' ? { ...p, status: 'done' } : p));
                setRunning(false);
                onComplete?.();
                break;
            }
            case 'error': {
                setError(data.message);
                setPhases(prev => prev.map(p => p.status === 'running' ? { ...p, status: 'error' } : p));
                setRunning(false);
                break;
            }
        }
    };

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>

            {/* Panel header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'rgba(13,20,36,0.5)' }}>
                <div className="flex items-center gap-2.5">
                    <BrainCircuit className="w-4 h-4" style={{ color: 'var(--cyan)' }} />
                    <span className="mono text-sm font-semibold" style={{ color: 'var(--cyan)' }}>ORACLE FEED</span>
                    {running && (
                        <span className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--amber)' }}>
                            <Loader2 className="w-3 h-3 animate-spin" /> CRE pipeline running…
                        </span>
                    )}
                </div>
                <div className="mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Activity className="w-3.5 h-3.5 inline mr-1.5" />
                    GoPlus · BaseScan · GPT-4o · Llama-3
                </div>
            </div>

            {/* ── Token input ── */}
            <div className="px-6 pt-5 pb-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-3 mb-4">
                    <input
                        list="token-list"
                        value={token}
                        onChange={e => setToken(e.target.value)}
                        placeholder="Token name or address…"
                        disabled={running || isKilled}
                        className="inp"
                        style={{ flex: 1 }}
                    />
                    <datalist id="token-list">
                        {[...CLEAN_TOKENS, ...MALICIOUS_TOKENS.map(t => t.label)].map(t => (
                            <option key={t} value={t} />
                        ))}
                    </datalist>
                    <button onClick={() => runAudit()} disabled={running || isKilled || !token} className="btn btn-cyan">
                        {running
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Auditing…</>
                            : <><Send className="w-4 h-4" /> Audit</>}
                    </button>
                </div>

                {/* Quick-pick: clean tokens */}
                <div className="mb-3">
                    <p className="mono text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>✅ Clean tokens (should PASS):</p>
                    <div className="flex flex-wrap gap-1.5">
                        {CLEAN_TOKENS.map(t => (
                            <button key={t} disabled={running || isKilled}
                                onClick={() => { setToken(t); runAudit(t); }}
                                className="badge badge-green"
                                style={{ cursor: 'pointer', border: '1px solid rgba(74,222,128,0.25)' }}>
                                {t}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Quick-pick: malicious tokens */}
                <div>
                    <p className="mono text-xs mb-2" style={{ color: 'var(--text-subtle)' }}>🚫 Malicious tokens (should BLOCK):</p>
                    <div className="flex flex-wrap gap-1.5">
                        {MALICIOUS_TOKENS.map(({ label, desc }) => (
                            <button key={label} disabled={running || isKilled}
                                onClick={() => { setToken(label); runAudit(label); }}
                                className="badge badge-red"
                                style={{ cursor: 'pointer', border: '1px solid rgba(248,113,113,0.25)' }}
                                title={desc}>
                                {label}
                            </button>
                        ))}
                    </div>
                </div>

                {isKilled && (
                    <p className="mono text-xs mt-3" style={{ color: 'var(--amber)' }}>
                        ⚠ Protocol locked — oracle disabled
                    </p>
                )}
            </div>

            {/* ── Live feed ── */}
            <div ref={feedRef} className="flex-1 overflow-y-auto" style={{ padding: '20px 24px' }}>
                <div className="space-y-2.5">

                    {/* Empty state */}
                    {phases.length === 0 && !verdict && !error && (
                        <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 200, paddingTop: 40 }}>
                            <BrainCircuit className="w-10 h-10" style={{ color: 'var(--text-subtle)' }} />
                            <div className="text-center">
                                <p className="mono text-sm" style={{ color: 'var(--text-muted)' }}>Select a token above to run a CRE security audit</p>
                                <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                                    GoPlus → BaseScan → GPT-4o + Llama-3 → onReportDirect()
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Phase steps */}
                    {phases.map((p, i) => (
                        <div key={i} className="flex items-center gap-3 mono text-sm" style={{ padding: '1px 0' }}>
                            {p.status === 'running' && <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: 'var(--cyan)' }} />}
                            {p.status === 'done' && <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--green)' }} />}
                            {p.status === 'error' && <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--red)' }} />}
                            {p.status === 'pending' && <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />}
                            <span style={{
                                color: p.status === 'running' ? 'var(--cyan)'
                                    : p.status === 'done' ? 'var(--text-muted)'
                                        : p.status === 'error' ? 'var(--red)'
                                            : 'var(--text-subtle)',
                            }}>
                                {p.label}
                            </span>
                        </div>
                    ))}

                    {/* LLM reasoning blocks */}
                    {llmBlocks.map((block, i) => (
                        <div key={i} className="card slide-in" style={{ marginTop: 14 }}>
                            <div className="flex items-center justify-between mb-3">
                                <span className="mono text-xs font-semibold" style={{ color: 'var(--indigo)' }}>
                                    ↪ [{block.model}]
                                </span>
                                {block.score !== undefined && (
                                    <span className={`badge ${block.score === 0 ? 'badge-green' : 'badge-red'}`}>
                                        Risk: {block.score === 0 ? '0x00 — clean ✅' : `0x${block.score.toString(16).toUpperCase()}`}
                                    </span>
                                )}
                            </div>
                            {block.text && (
                                <p className="mono text-xs leading-relaxed"
                                    style={{ color: 'var(--text-muted)', maxHeight: 120, overflowY: 'auto', lineHeight: 1.75 }}>
                                    {block.text}
                                </p>
                            )}
                        </div>
                    ))}

                    {/* Error card */}
                    {error && (
                        <div className="card slide-in" style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(248,113,113,0.05)', marginTop: 14 }}>
                            <p className="mono text-sm font-semibold mb-1.5" style={{ color: 'var(--red)' }}>Oracle Error</p>
                            <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>
                        </div>
                    )}

                    {/* ── Verdict card ── */}
                    {verdict && (
                        <div className="card slide-in" style={{
                            marginTop: 14,
                            background: verdict.status === 'APPROVED' ? 'rgba(74,222,128,0.04)' : 'rgba(248,113,113,0.04)',
                            borderColor: verdict.status === 'APPROVED' ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)',
                        }}>
                            {/* Verdict header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2.5">
                                    {verdict.status === 'APPROVED'
                                        ? <CheckCircle className="w-6 h-6" style={{ color: 'var(--green)' }} />
                                        : <XCircle className="w-6 h-6" style={{ color: 'var(--red)' }} />}
                                    <div>
                                        <p className="mono font-bold text-sm"
                                            style={{ color: verdict.status === 'APPROVED' ? 'var(--green)' : 'var(--red)' }}>
                                            CRE AUDIT: {verdict.status === 'APPROVED' ? 'TOKEN APPROVED' : 'TOKEN BLOCKED'}
                                        </p>
                                        <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            onReportDirect() committed on-chain
                                        </p>
                                    </div>
                                </div>
                                <span className={`badge ${verdict.status === 'APPROVED' ? 'badge-green' : 'badge-red'}`}>
                                    {verdict.targetToken} · Risk Code: {verdict.score}
                                </span>
                            </div>

                            {/* Risk matrix — only show flagged risks, or a single 'all clear' line */}
                            {verdict.status === 'APPROVED' ? (
                                <div className="flex items-center gap-2 mb-4 mono text-xs" style={{ color: 'var(--green)' }}>
                                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                                    All 8 risk vectors clean — Unverified, SellTax, Honeypot, Proxy, ObfuscatedTax, PrivEsc, ExtCall, LogicBomb
                                </div>
                            ) : (
                                <div className="mb-4">
                                    <p className="mono text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Triggered risk flags:</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {verdict.checks.filter(c => c.triggered).map((c, i) => (
                                            <div key={i} className="flex items-center gap-2 mono text-xs">
                                                <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--red)' }} />
                                                <span style={{ color: 'var(--red)' }}>{c.name}</span>
                                            </div>
                                        ))}
                                        {verdict.checks.filter(c => !c.triggered).map((c, i) => (
                                            <div key={i} className="flex items-center gap-2 mono text-xs">
                                                <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--green)' }} />
                                                <span style={{ color: 'var(--text-muted)' }}>{c.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reasoning */}
                            <p className="mono text-xs leading-relaxed mb-4" style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                {verdict.reasoning}
                            </p>

                            {/* Tenderly links */}
                            <div className="flex flex-col gap-1.5">
                                {verdict.explorerUrl && (
                                    <a href={verdict.explorerUrl} target="_blank" rel="noreferrer"
                                        className="mono text-xs" style={{ color: 'var(--cyan)' }}>
                                        requestAudit() tx → View on Tenderly ↗
                                    </a>
                                )}
                                {verdict.callbackExplorerUrl && (
                                    <a href={verdict.callbackExplorerUrl} target="_blank" rel="noreferrer"
                                        className="mono text-xs" style={{ color: 'var(--cyan)' }}>
                                        onReportDirect() tx → View on Tenderly ↗
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
