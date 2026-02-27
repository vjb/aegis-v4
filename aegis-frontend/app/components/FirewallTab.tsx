'use client';

import { useState } from 'react';
import { Flame, ToggleLeft, ToggleRight } from 'lucide-react';

type FirewallConfig = {
    maxTax: number;
    maxOwnerHolding: number;
    minLiquidity: number;
    blockProxies: boolean;
    strictLogic: boolean;
    blockMintable: boolean;
    blockHoneypots: boolean;
    allowUnverified: boolean;
};

const RISK_BITS = [
    { bit: 0, label: 'Unverified Code', source: 'GoPlus', desc: 'Blocks tokens with unverified source code' },
    { bit: 1, label: 'Sell Restriction', source: 'GoPlus', desc: 'Blocks tokens with sell tax above threshold' },
    { bit: 2, label: 'Honeypot', source: 'GoPlus', desc: 'Blocks known honeypot architectures' },
    { bit: 3, label: 'Upgradeable Proxy', source: 'GoPlus', desc: 'Blocks tokens behind proxy contracts' },
    { bit: 4, label: 'Obfuscated Tax', source: 'AI', desc: 'LLM reads source code and detects hidden fee logic' },
    { bit: 5, label: 'Privilege Escalation', source: 'AI', desc: 'Detects non-standard Ownable backdoors' },
    { bit: 6, label: 'External Call Risk', source: 'AI', desc: 'Detects reentrancy or arbitrary external calls' },
    { bit: 7, label: 'Logic Bomb', source: 'AI', desc: 'Detects time-gated or conditional malicious logic' },
];

export default function FirewallTab() {
    const [config, setConfig] = useState<FirewallConfig>({
        maxTax: 5,
        maxOwnerHolding: 20,
        minLiquidity: 1,
        blockProxies: true,
        strictLogic: true,
        blockMintable: true,
        blockHoneypots: true,
        allowUnverified: false,
    });

    const [enabledBits, setEnabledBits] = useState<Set<number>>(new Set([0, 1, 2, 3, 4, 5, 6, 7]));

    const toggleBit = (bit: number) => {
        setEnabledBits(prev => {
            const next = new Set(prev);
            if (next.has(bit)) next.delete(bit); else next.add(bit);
            return next;
        });
    };

    const riskCode = Array.from(enabledBits).reduce((acc, bit) => acc | (1 << bit), 0);

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Rules of Engagement</h2>
                    <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Active risk bits: <span style={{ color: 'var(--cyan)' }}>{enabledBits.size}/8</span>
                        <span className="ml-3">Mask: <span style={{ color: 'var(--cyan)' }}>0x{riskCode.toString(16).padStart(2, '0').toUpperCase()}</span></span>
                    </p>
                </div>
                <div className="flex items-center gap-1.5 mono text-xs px-2.5 py-1 rounded-lg"
                    style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)' }}>
                    <Flame className="w-3.5 h-3.5" />
                    Chainlink CRE enforced
                </div>
            </div>

            {/* Risk bit toggles */}
            <div className="space-y-2">
                <p className="mono text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--text-subtle)' }}>Risk Bit Matrix</p>
                {RISK_BITS.map(({ bit, label, source, desc }) => {
                    const enabled = enabledBits.has(bit);
                    return (
                        <button
                            key={bit}
                            onClick={() => toggleBit(bit)}
                            className="w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all"
                            style={{
                                background: enabled ? 'var(--bg-surface)' : 'var(--bg-elevated)',
                                border: `1px solid ${enabled ? 'var(--border-bright)' : 'var(--border)'}`,
                            }}
                        >
                            {/* Bit index */}
                            <span className="mono text-xs w-5 text-center flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                                {bit}
                            </span>

                            {/* Toggle */}
                            {enabled
                                ? <ToggleRight className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--cyan)' }} />
                                : <ToggleLeft className="w-5 h-5 flex-shrink-0" style={{ color: 'var(--text-subtle)' }} />
                            }

                            {/* Info */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="mono text-xs font-semibold" style={{ color: enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                        {label}
                                    </span>
                                    <span className="mono text-xs px-1.5 py-0.5 rounded"
                                        style={source === 'AI'
                                            ? { background: 'rgba(129,140,248,0.1)', color: 'var(--indigo)', border: '1px solid rgba(129,140,248,0.2)' }
                                            : { background: 'var(--green-dim)', color: 'var(--green)' }}>
                                        {source}
                                    </span>
                                </div>
                                <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                            </div>

                            {/* Risk bit visual */}
                            <span className="mono text-xs w-6 text-center flex-shrink-0 font-bold"
                                style={{ color: enabled ? 'var(--cyan)' : 'var(--text-subtle)' }}>
                                {enabled ? '1' : '0'}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-2">
                <p className="mono text-xs uppercase tracking-widest" style={{ color: 'var(--text-subtle)' }}>Threshold Tuning</p>

                {[
                    { key: 'maxTax' as keyof FirewallConfig, label: 'Max Allowed Tax', unit: '%', min: 0, max: 50, step: 1 },
                    { key: 'maxOwnerHolding' as keyof FirewallConfig, label: 'Max Owner Holding', unit: '%', min: 0, max: 100, step: 5 },
                    { key: 'minLiquidity' as keyof FirewallConfig, label: 'Min Pool Liquidity', unit: 'K USD', min: 0, max: 100, step: 1 },
                ].map(({ key, label, unit, min, max, step }) => (
                    <div key={key}>
                        <div className="flex justify-between mono text-xs mb-2">
                            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
                            <span style={{ color: 'var(--cyan)' }}>{config[key]}{unit}</span>
                        </div>
                        <input
                            type="range" min={min} max={max} step={step}
                            value={config[key] as number}
                            onChange={e => setConfig(prev => ({ ...prev, [key]: parseFloat(e.target.value) }))}
                            className="w-full"
                        />
                    </div>
                ))}
            </div>
        </div>
    );
}
