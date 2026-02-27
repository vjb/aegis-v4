'use client';

import { useState, useEffect, useRef } from 'react';
import { BrainCircuit, CheckCircle, XCircle, Loader2, Send, ChevronRight, Activity } from 'lucide-react';

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
};

const KNOWN_TOKENS = ['BRETT', 'TOSHI', 'DEGEN', 'WETH', 'USDC', 'Honeypot', 'TaxToken', 'HoneypotCoin'];

export default function OracleFeed({ isKilled, externalTrigger, onTriggerConsumed }: {
    isKilled: boolean;
    externalTrigger: string | null;
    onTriggerConsumed: () => void;
}) {
    const [token, setToken] = useState('BRETT');
    const [running, setRunning] = useState(false);
    const [phases, setPhases] = useState<Phase[]>([]);
    const [llmBlocks, setLlmBlocks] = useState<LLMBlock[]>([]);
    const [verdict, setVerdict] = useState<Verdict | null>(null);
    const [error, setError] = useState<string | null>(null);
    const feedRef = useRef<HTMLDivElement>(null);

    // Consume external trigger (from agents/marketplace)
    useEffect(() => {
        if (externalTrigger && !running) {
            setToken(externalTrigger);
            onTriggerConsumed();
            // Small delay so state settles before running
            setTimeout(() => runAudit(externalTrigger), 150);
        }
    }, [externalTrigger]);

    // Auto-scroll feed
    useEffect(() => {
        feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
    }, [phases, llmBlocks, verdict]);

    const setPhaseStatus = (label: string, status: Phase['status']) => {
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
        const targetToken = tok || token;
        if (running || isKilled) return;

        setRunning(true);
        setVerdict(null);
        setError(null);
        setLlmBlocks([]);
        setPhases([
            { label: 'Connecting to Chainlink CRE DON', status: 'running' },
        ]);

        try {
            const res = await fetch(`/api/audit?token=${encodeURIComponent(targetToken)}&amount=0.1`);
            if (!res.body) throw new Error('No stream');

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
                    try {
                        const data = JSON.parse(chunk.slice(6));
                        handleEvent(data);
                    } catch { /* ignore malformed */ }
                }
            }
        } catch (e: any) {
            setError(e.message || 'Connection failed');
        } finally {
            setRunning(false);
        }
    };

    const handleEvent = (data: any) => {
        if (data.type === 'phase') {
            setPhaseStatus(data.phase, 'done');
            // Mark next phase as running (heuristic)
            const nextLabels: Record<string, string> = {
                'Spinning up Oracle Brain': 'Running GoPlus Analysis',
                'Running GoPlus Analysis': 'Fetching contract source via BaseScan',
                'Fetching contract source via BaseScan': 'Running AI Consensus',
                'Running AI Consensus': 'Computing Final Risk Code',
                'Executing Cryptographic Callback via DON...': 'Committing to chain',
                'Reading Adjudging State off Tenderly...': 'Finalising verdict',
            };
            const next = nextLabels[data.phase];
            if (next) setPhaseStatus(next, 'running');
            else setPhaseStatus(data.phase, 'done');
        } else if (data.type === 'static-analysis') {
            const label = data.source || 'Static Analysis';
            setPhaseStatus(label, data.status === 'pending' ? 'running' : 'done');
        } else if (data.type === 'llm-reasoning-start') {
            setLlmBlocks(prev => [...prev, { model: data.model, text: '' }]);
            setPhaseStatus(`AI: ${data.model}`, 'running');
        } else if (data.type === 'llm-reasoning-chunk') {
            setLlmBlocks(prev => prev.map(b => b.model === data.model ? { ...b, text: b.text + data.text } : b));
        } else if (data.type === 'llm-score') {
            setLlmBlocks(prev => prev.map(b => b.model === data.model ? { ...b, score: (b.score ?? 0) | data.bit } : b));
            setPhaseStatus(`AI: ${data.model}`, 'done');
        } else if (data.type === 'tx') {
            setPhaseStatus('requestAudit() on-chain', 'done');
        } else if (data.type === 'tx-status') {
            setPhaseStatus('onReportDirect() committed', data.status === 'Confirmed' ? 'done' : 'error');
        } else if (data.type === 'final_verdict') {
            setVerdict(data.payload);
            setRunning(false);
        } else if (data.type === 'error') {
            setError(data.message);
            setRunning(false);
        }
    };

    return (
        <div className="flex flex-col h-full" style={{ background: 'var(--bg-base)' }}>
            {/* Oracle Feed header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border)', background: 'rgba(15,23,42,0.5)' }}>
                <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4" style={{ color: 'var(--cyan)' }} />
                    <span className="mono text-xs font-semibold" style={{ color: 'var(--cyan)' }}>ORACLE FEED</span>
                    {running && (
                        <span className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--amber)' }}>
                            <Loader2 className="w-3 h-3 animate-spin" /> CRE Running
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Activity className="w-3 h-3" />
                    GoPlus · BaseScan · GPT-4o · Llama-3
                </div>
            </div>

            {/* Audit input */}
            <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <input
                            list="token-list"
                            value={token}
                            onChange={e => setToken(e.target.value)}
                            placeholder="Token name or address..."
                            disabled={running || isKilled}
                            className="w-full rounded-lg px-3 py-2 mono text-xs outline-none disabled:opacity-50"
                            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)' }}
                        />
                        <datalist id="token-list">
                            {KNOWN_TOKENS.map(t => <option key={t} value={t} />)}
                        </datalist>
                    </div>
                    <button
                        onClick={() => runAudit()}
                        disabled={running || isKilled || !token}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg mono text-xs font-semibold transition-all disabled:opacity-40"
                        style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.25)' }}
                    >
                        {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        {running ? 'Running...' : 'Audit'}
                    </button>
                </div>
                {isKilled && <p className="mono text-xs mt-2" style={{ color: 'var(--amber)' }}>Protocol locked — oracle disabled</p>}
            </div>

            {/* Live feed */}
            <div ref={feedRef} className="flex-1 overflow-y-auto p-4 space-y-3">

                {/* Empty state */}
                {phases.length === 0 && !verdict && !error && (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                        <BrainCircuit className="w-10 h-10" style={{ color: 'var(--text-subtle)' }} />
                        <p className="mono text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                            Enter a token above to run the full<br />
                            Chainlink CRE oracle pipeline
                        </p>
                        <p className="mono text-xs text-center" style={{ color: 'var(--text-subtle)', marginTop: 4 }}>
                            GoPlus → BaseScan → GPT-4o + Llama-3 → verdict
                        </p>
                    </div>
                )}

                {/* Phase steps */}
                {phases.map((p, i) => (
                    <div key={i} className="flex items-center gap-2.5 mono text-xs">
                        {p.status === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" style={{ color: 'var(--cyan)' }} />}
                        {p.status === 'done' && <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--green)' }} />}
                        {p.status === 'error' && <XCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--red)' }} />}
                        {p.status === 'pending' && <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />}
                        <span style={{ color: p.status === 'running' ? 'var(--cyan)' : p.status === 'done' ? 'var(--text-muted)' : 'var(--text-subtle)' }}>
                            {p.label}
                        </span>
                    </div>
                ))}

                {/* LLM reasoning blocks */}
                {llmBlocks.map((block, i) => (
                    <div key={i} className="rounded-xl p-3.5 space-y-2"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-bright)' }}>
                        <div className="flex items-center justify-between">
                            <span className="mono text-xs font-semibold" style={{ color: 'var(--indigo)' }}>
                                ↪ [{block.model}] Analysis
                            </span>
                            {block.score !== undefined && (
                                <span className="mono text-xs px-2 py-0.5 rounded"
                                    style={block.score === 0
                                        ? { background: 'var(--green-dim)', color: 'var(--green)' }
                                        : { background: 'var(--red-dim)', color: 'var(--red)' }}>
                                    Risk bits: {block.score === 0 ? '0 ✅' : block.score}
                                </span>
                            )}
                        </div>
                        {block.text && (
                            <p className="mono text-xs leading-relaxed" style={{ color: 'var(--text-muted)', maxHeight: 120, overflowY: 'auto' }}>
                                {block.text}
                            </p>
                        )}
                    </div>
                ))}

                {/* Error */}
                {error && (
                    <div className="rounded-xl p-4" style={{ background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)' }}>
                        <p className="mono text-xs font-semibold mb-1" style={{ color: 'var(--red)' }}>Oracle Error</p>
                        <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{error}</p>
                        <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-subtle)' }}>
                            Ensure Docker is running: docker exec aegis-oracle-node
                        </p>
                    </div>
                )}

                {/* Verdict card */}
                {verdict && (
                    <div className="rounded-xl p-4 space-y-3"
                        style={{
                            background: verdict.status === 'APPROVED' ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                            border: `1px solid ${verdict.status === 'APPROVED' ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}`,
                        }}>
                        {/* Verdict header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {verdict.status === 'APPROVED'
                                    ? <CheckCircle className="w-5 h-5" style={{ color: 'var(--green)' }} />
                                    : <XCircle className="w-5 h-5" style={{ color: 'var(--red)' }} />}
                                <span className="mono text-sm font-bold"
                                    style={{ color: verdict.status === 'APPROVED' ? 'var(--green)' : 'var(--red)' }}>
                                    {verdict.status === 'APPROVED' ? 'TRADE CLEARED' : 'TRADE BLOCKED'}
                                </span>
                            </div>
                            <span className="mono text-xs px-2 py-1 rounded"
                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                                {verdict.targetToken} · Risk Code: {verdict.score}
                            </span>
                        </div>

                        {/* Risk matrix */}
                        <div className="grid grid-cols-2 gap-1.5">
                            {verdict.checks?.map((c, i) => (
                                <div key={i} className="flex items-center gap-1.5 mono text-xs">
                                    {c.triggered
                                        ? <XCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--red)' }} />
                                        : <CheckCircle className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--green)' }} />}
                                    <span style={{ color: c.triggered ? 'var(--red)' : 'var(--text-muted)' }}>{c.name}</span>
                                </div>
                            ))}
                        </div>

                        {/* Reasoning */}
                        <p className="mono text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            {verdict.reasoning}
                        </p>

                        {/* Explorer links */}
                        {verdict.explorerUrl && (
                            <a href={verdict.explorerUrl} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 mono text-xs transition-colors"
                                style={{ color: 'var(--cyan)' }}>
                                View on Tenderly →
                            </a>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
