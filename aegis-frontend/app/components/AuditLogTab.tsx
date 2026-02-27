'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Clock, ExternalLink, Filter } from 'lucide-react';

type LogEntry = {
    id: string;
    time: Date;
    agent: string;
    token: string;
    riskCode: number;
    status: 'Cleared' | 'Blocked' | 'Pending';
    txHash?: string;
};

const INITIAL_LOGS: LogEntry[] = [
    { id: '1', time: new Date(Date.now() - 2 * 60000), agent: 'NOVA', token: 'BRETT', riskCode: 0, status: 'Cleared', txHash: '0x1a2b3c' },
    { id: '2', time: new Date(Date.now() - 4 * 60000), agent: 'CIPHER', token: 'TaxToken', riskCode: 18, status: 'Blocked', txHash: '0x4d5e6f' },
    { id: '3', time: new Date(Date.now() - 7 * 60000), agent: 'REX', token: 'HoneypotCoin', riskCode: 4, status: 'Blocked', txHash: '0x7a8b9c' },
    { id: '4', time: new Date(Date.now() - 12 * 60000), agent: 'PHANTOM', token: 'TOSHI', riskCode: 0, status: 'Cleared', txHash: '0xabc123' },
    { id: '5', time: new Date(Date.now() - 20 * 60000), agent: 'NOVA', token: 'DEGEN', riskCode: 0, status: 'Cleared', txHash: '0xdef456' },
];

function timeAgo(d: Date) {
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
    return `${Math.floor(secs / 3600)}h ago`;
}

function decodeBits(code: number) {
    const names = ['Unverified', 'SellRestriction', 'Honeypot', 'Proxy', 'ObfuscatedTax', 'PrivEscalation', 'ExtCallRisk', 'LogicBomb'];
    return names.filter((_, i) => (code & (1 << i)) !== 0);
}

export default function AuditLogTab() {
    const [logs] = useState<LogEntry[]>(INITIAL_LOGS);
    const [filter, setFilter] = useState<'all' | 'Cleared' | 'Blocked'>('all');

    const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

    const cleared = logs.filter(l => l.status === 'Cleared').length;
    const blocked = logs.filter(l => l.status === 'Blocked').length;

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Audit Log</h2>
                    <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        <span style={{ color: 'var(--green)' }}>{cleared} cleared</span>
                        <span className="mx-2" style={{ color: 'var(--border-bright)' }}>·</span>
                        <span style={{ color: 'var(--red)' }}>{blocked} blocked</span>
                    </p>
                </div>
                <div className="flex items-center gap-1">
                    {(['all', 'Cleared', 'Blocked'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                            className="mono text-xs px-2.5 py-1 rounded-lg transition-all capitalize"
                            style={filter === f ? {
                                background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)'
                            } : {
                                background: 'transparent', color: 'var(--text-muted)', border: '1px solid transparent'
                            }}>
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Log list */}
            <div className="space-y-2">
                {filtered.map(entry => {
                    const bits = decodeBits(entry.riskCode);
                    return (
                        <div key={entry.id} className="rounded-xl p-3.5"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-2.5">
                                    {entry.status === 'Cleared'
                                        ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--green)' }} />
                                        : entry.status === 'Blocked'
                                            ? <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--red)' }} />
                                            : <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--amber)' }} />}
                                    <div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="mono text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                {entry.agent}
                                            </span>
                                            <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>→</span>
                                            <span className="mono text-xs font-semibold" style={{ color: 'var(--cyan)' }}>{entry.token}</span>
                                            <span className="mono text-xs px-1.5 py-0.5 rounded"
                                                style={entry.status === 'Cleared'
                                                    ? { background: 'var(--green-dim)', color: 'var(--green)' }
                                                    : { background: 'var(--red-dim)', color: 'var(--red)' }}>
                                                {entry.status === 'Cleared' ? `Risk Code: 0` : `Risk Code: ${entry.riskCode}`}
                                            </span>
                                        </div>
                                        {bits.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                                {bits.map(b => (
                                                    <span key={b} className="mono text-xs px-1.5 py-0.5 rounded"
                                                        style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                        {b}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="mono text-xs" style={{ color: 'var(--text-muted)' }}>{timeAgo(entry.time)}</span>
                                    {entry.txHash && (
                                        <a href="#" className="flex items-center gap-1 mono text-xs transition-colors"
                                            style={{ color: 'var(--text-muted)' }}>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filtered.length === 0 && (
                    <div className="text-center py-12 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                        No {filter === 'all' ? '' : filter.toLowerCase()} audit events yet
                    </div>
                )}
            </div>
        </div>
    );
}
