'use client';

import { ShoppingBag, Star, TrendingUp, Shield, Zap } from 'lucide-react';

type AgentTemplate = {
    id: string;
    name: string;
    description: string;
    strategy: string;
    suggestedBudget: number;
    riskLevel: 'Conservative' | 'Balanced' | 'Aggressive';
    clearanceRate: number;
    icon: string;
    tokens: string[];
};

const TEMPLATES: AgentTemplate[] = [
    {
        id: 'bluechip',
        name: 'BLUECHIP_BOT',
        description: 'Only trades WETH, USDC, BRETT, and TOSHI — all confirmed Risk Code 0 tokens.',
        strategy: 'Blue-chip only · Low cadence',
        suggestedBudget: 0.5,
        riskLevel: 'Conservative',
        clearanceRate: 100,
        icon: '🔵',
        tokens: ['WETH', 'BRETT', 'TOSHI', 'DEGEN'],
    },
    {
        id: 'yield',
        name: 'YIELD_BOT',
        description: 'Focuses on high-yield opportunities. Runs CRE oracle before every single trade.',
        strategy: 'Yield-seeking · Medium cadence',
        suggestedBudget: 0.2,
        riskLevel: 'Balanced',
        clearanceRate: 87,
        icon: '📈',
        tokens: ['BRETT', 'DEGEN', 'TOSHI'],
    },
    {
        id: 'degen',
        name: 'DEGEN_BOT',
        description: 'Explores new tokens, relies heavily on CRE oracle to block honeypots and tax tokens.',
        strategy: 'Exploratory · High cadence',
        suggestedBudget: 0.05,
        riskLevel: 'Aggressive',
        clearanceRate: 62,
        icon: '🎲',
        tokens: ['BRETT', 'DEGEN', 'custom tokens'],
    },
    {
        id: 'safe',
        name: 'SAFE_BOT',
        description: 'Ultra-conservative. Requires BaseScan source, GoPlus clean, AND both AI models agree.',
        strategy: 'Triple-verified only · Low cadence',
        suggestedBudget: 1.0,
        riskLevel: 'Conservative',
        clearanceRate: 100,
        icon: '🛡️',
        tokens: ['WETH', 'USDC', 'cbETH'],
    },
];

const RISK_COLORS: Record<AgentTemplate['riskLevel'], string> = {
    Conservative: 'var(--green)',
    Balanced: 'var(--amber)',
    Aggressive: 'var(--red)',
};

export default function MarketplaceTab({ isKilled, onAudit }: { isKilled: boolean; onAudit: (tok: string) => void }) {
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Agent Marketplace</h2>
                    <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Pre-built strategies — all use real Chainlink CRE oracle
                    </p>
                </div>
                <div className="flex items-center gap-1.5 mono text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: 'rgba(129,140,248,0.1)', color: 'var(--indigo)', border: '1px solid rgba(129,140,248,0.2)' }}>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {TEMPLATES.length} agents
                </div>
            </div>

            <div className="space-y-3">
                {TEMPLATES.map(t => (
                    <div key={t.id} className="rounded-xl p-4"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 flex-1">
                                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                                    style={{ background: 'var(--bg-elevated)' }}>
                                    {t.icon}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                                        <span className="mono text-xs px-1.5 py-0.5 rounded"
                                            style={{ color: RISK_COLORS[t.riskLevel], background: `${RISK_COLORS[t.riskLevel]}20`, border: `1px solid ${RISK_COLORS[t.riskLevel]}40` }}>
                                            {t.riskLevel}
                                        </span>
                                    </div>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{t.description}</p>

                                    {/* Clearance rate */}
                                    <div className="flex items-center gap-4 mt-2.5">
                                        <div className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <Shield className="w-3 h-3" style={{ color: 'var(--green)' }} />
                                            {t.clearanceRate}% clearance rate
                                        </div>
                                        <div className="flex items-center gap-1.5 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                                            <TrendingUp className="w-3 h-3" style={{ color: 'var(--cyan)' }} />
                                            {t.strategy}
                                        </div>
                                    </div>

                                    {/* Token list */}
                                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                        {t.tokens.map(tok => (
                                            <span key={tok} className="mono text-xs px-1.5 py-0.5 rounded"
                                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                                                {tok}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Deploy button */}
                            <div className="flex flex-col items-end gap-2 flex-shrink-0">
                                <div className="mono text-xs text-right" style={{ color: 'var(--text-muted)' }}>
                                    Suggested budget<br />
                                    <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{t.suggestedBudget} ETH</span>
                                </div>
                                <button
                                    disabled={isKilled}
                                    onClick={() => onAudit(t.tokens[0])}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mono text-xs font-medium transition-all disabled:opacity-40"
                                    style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)' }}
                                >
                                    <Zap className="w-3.5 h-3.5" />
                                    Deploy
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer note */}
            <p className="mono text-xs text-center pt-2" style={{ color: 'var(--text-subtle)' }}>
                Deploying runs subscribeAgent() + trial oracle simulation via CRE DON
            </p>
        </div>
    );
}
