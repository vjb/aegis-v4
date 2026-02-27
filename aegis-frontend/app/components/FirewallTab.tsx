'use client';

import { useState, useEffect, useCallback } from 'react';
import { Flame, ToggleLeft, ToggleRight, Save, RefreshCw, ExternalLink, Loader2, AlertTriangle, Lock } from 'lucide-react';

type FirewallConfig = {
    maxTax: number;
    blockProxies: boolean;
    blockHoneypots: boolean;
    strictLogic: boolean;
    allowUnverified: boolean;
};

const DEFAULT_CONFIG: FirewallConfig = {
    maxTax: 5,
    blockProxies: true,
    blockHoneypots: true,
    strictLogic: true,
    allowUnverified: false,
};

export default function FirewallTab() {
    const [chainConfig, setChainConfig] = useState<FirewallConfig | null>(null);
    const [localConfig, setLocalConfig] = useState<FirewallConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<{ hash: string; explorerUrl: string } | null>(null);
    const [error, setError] = useState<string | null>(null);

    const isDirty = chainConfig && JSON.stringify(localConfig) !== JSON.stringify(chainConfig);

    const loadConfig = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const res = await fetch('/api/firewall');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            const cfg: FirewallConfig = {
                maxTax: data.config?.maxTax ?? 5,
                blockProxies: data.config?.blockProxies ?? true,
                blockHoneypots: data.config?.blockHoneypots ?? true,
                strictLogic: data.config?.strictLogic ?? true,
                allowUnverified: data.config?.allowUnverified ?? false,
            };
            setChainConfig(cfg);
            setLocalConfig(cfg);
        } catch (e: any) {
            setError(e.message);
            // Fall back to defaults so UI is still usable
            setChainConfig(DEFAULT_CONFIG);
            setLocalConfig(DEFAULT_CONFIG);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadConfig(); }, [loadConfig]);

    const saveConfig = async () => {
        setSaving(true); setSaveResult(null); setError(null);
        try {
            const res = await fetch('/api/firewall', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: localConfig }),
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setSaveResult({ hash: data.hash, explorerUrl: data.explorerUrl });
            setChainConfig({ ...localConfig });
        } catch (e: any) {
            setError(`Save failed: ${e.message}`);
        } finally {
            setSaving(false);
        }
    };

    const set = (key: keyof FirewallConfig, value: boolean | number) => {
        setSaveResult(null);
        setLocalConfig(prev => ({ ...prev, [key]: value }));
    };

    const Toggle = ({ on, onClick }: { on: boolean; onClick: () => void }) => (
        <button onClick={onClick} className="flex items-center gap-2 mono text-xs px-3 py-2 rounded-lg transition-all"
            style={{
                background: on ? 'var(--cyan-dim)' : 'var(--bg-elevated)',
                border: '1px solid', borderColor: on ? 'rgba(56,189,248,0.3)' : 'var(--border)',
                color: on ? 'var(--cyan)' : 'var(--text-muted)',
                minWidth: 72, justifyContent: 'center',
            }}>
            {on ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {on ? 'ON' : 'OFF'}
        </button>
    );

    return (
        <div className="space-y-7">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Firewall Rules</h2>
                    <p className="mono text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {loading ? 'Reading from chain…' : error ? '⚠ Using defaults — chain read failed' : 'Synced with on-chain firewallConfig()'}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={loadConfig} disabled={loading} className="btn btn-ghost" style={{ padding: '7px 10px' }} title="Re-read from chain">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <div className="badge badge-cyan"><Flame className="w-3.5 h-3.5" /> CRE enforced</div>
                </div>
            </div>

            {/* Chain read error (non-blocking) */}
            {error && !saving && (
                <div className="card" style={{ borderColor: 'rgba(248,113,113,0.25)', background: 'rgba(255,107,107,0.05)', padding: '12px 16px' }}>
                    <p className="mono text-xs" style={{ color: 'var(--red)' }}>⚠ {error}</p>
                    <p className="mono text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>Ensure TENDERLY_RPC_URL, AEGIS_MODULE_ADDRESS, and PRIVATE_KEY are in .env — you can still edit rules locally below.</p>
                </div>
            )}

            {/* Unsaved changes banner */}
            {isDirty && (
                <div className="card slide-in flex items-center justify-between" style={{ padding: '14px 18px', borderColor: 'rgba(251,191,36,0.3)', background: 'rgba(251,191,36,0.04)' }}>
                    <div className="flex items-center gap-2.5 mono text-xs" style={{ color: 'var(--amber)' }}>
                        <AlertTriangle className="w-4 h-4" />
                        Unsaved changes — not yet on-chain
                    </div>
                    <button onClick={saveConfig} disabled={saving} className="btn btn-cyan" style={{ padding: '8px 16px', fontSize: 12 }}>
                        {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending tx…</> : <><Save className="w-3.5 h-3.5" /> Save → setFirewallConfig()</>}
                    </button>
                </div>
            )}

            {/* Save success */}
            {saveResult && (
                <div className="card slide-in" style={{ padding: '14px 18px', borderColor: 'rgba(74,222,128,0.3)', background: 'rgba(74,222,128,0.04)' }}>
                    <p className="mono text-xs" style={{ color: 'var(--green)' }}>✅ setFirewallConfig() confirmed</p>
                    {saveResult.explorerUrl && (
                        <a href={saveResult.explorerUrl} target="_blank" rel="noreferrer"
                            className="mono text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--cyan)' }}>
                            View tx in Tenderly <ExternalLink className="w-3 h-3" />
                        </a>
                    )}
                </div>
            )}

            {/* ── SECTION 1: Owner-controlled toggles ── */}
            <div>
                <p className="section-title">Owner-Controlled Rules</p>
                <p className="mono text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>
                    These rules gate individual risk bits. Toggle and hit Save to commit on-chain.
                </p>
                <div className="space-y-3">

                    {/* Bit 0: allowUnverified */}
                    <div className="card" style={{ padding: '18px 20px' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="mono text-xs w-5 text-center" style={{ color: 'var(--text-subtle)' }}>0</span>
                                <div>
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <span className="mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Unverified Source Code</span>
                                        <span className="badge badge-green">GoPlus</span>
                                    </div>
                                    <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>Block tokens with no verified code on BaseScan</p>
                                </div>
                            </div>
                            <Toggle on={!localConfig.allowUnverified} onClick={() => set('allowUnverified', !localConfig.allowUnverified)} />
                        </div>
                    </div>

                    {/* Bit 2: blockHoneypots */}
                    <div className="card" style={{ padding: '18px 20px' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="mono text-xs w-5 text-center" style={{ color: 'var(--text-subtle)' }}>2</span>
                                <div>
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <span className="mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Honeypot Detection</span>
                                        <span className="badge badge-green">GoPlus</span>
                                    </div>
                                    <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>Block tokens that can be bought but not sold (GoPlus simulation)</p>
                                </div>
                            </div>
                            <Toggle on={localConfig.blockHoneypots} onClick={() => set('blockHoneypots', !localConfig.blockHoneypots)} />
                        </div>
                    </div>

                    {/* Bit 3: blockProxies */}
                    <div className="card" style={{ padding: '18px 20px' }}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <span className="mono text-xs w-5 text-center" style={{ color: 'var(--text-subtle)' }}>3</span>
                                <div>
                                    <div className="flex items-center gap-2.5 mb-1">
                                        <span className="mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Upgradeable Proxy</span>
                                        <span className="badge badge-green">GoPlus</span>
                                    </div>
                                    <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>Block tokens deployed behind proxy contracts (owner can change code)</p>
                                </div>
                            </div>
                            <Toggle on={localConfig.blockProxies} onClick={() => set('blockProxies', !localConfig.blockProxies)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* ── SECTION 2: Threshold sliders ── */}
            <div>
                <p className="section-title">Threshold Tuning</p>
                <div className="card space-y-7" style={{ padding: '24px' }}>

                    {/* maxTax */}
                    <div>
                        <div className="flex justify-between mono text-xs mb-2.5">
                            <span style={{ color: 'var(--text-muted)' }}>
                                Max Allowed Tax <span style={{ color: 'var(--text-subtle)' }}>(Bit 1 · GoPlus)</span>
                            </span>
                            <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>{localConfig.maxTax}%</span>
                        </div>
                        <input type="range" min={0} max={50} step={1} value={localConfig.maxTax}
                            onChange={e => set('maxTax', parseInt(e.target.value))} style={{ width: '100%' }} />
                        <p className="mono text-xs mt-2" style={{ color: 'var(--text-subtle)' }}>
                            Tokens with buy/sell tax {">"} {localConfig.maxTax}% trigger bit 1 and are blocked
                        </p>
                    </div>

                    {/* strictLogic */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="mono text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>Strict AI Consensus</p>
                            <p className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>
                                When ON: both GPT-4o AND Llama-3 must agree to flag bits 4–7.<br />
                                When OFF: either model alone can trigger a block.
                            </p>
                        </div>
                        <Toggle on={localConfig.strictLogic} onClick={() => set('strictLogic', !localConfig.strictLogic)} />
                    </div>
                </div>
            </div>

            {/* ── SECTION 3: Always-on AI detectors (read-only) ── */}
            <div>
                <div className="flex items-center gap-2.5 mb-2">
                    <p className="section-title" style={{ marginBottom: 0 }}>AI Detectors</p>
                    <Lock className="w-3.5 h-3.5" style={{ color: 'var(--text-subtle)' }} />
                </div>
                <p className="mono text-xs mb-4" style={{ color: 'var(--text-subtle)' }}>
                    These bits are set by the CRE AI oracle whenever detected — always enforced.
                    Use <strong>Strict AI Consensus</strong> above to tune how aggressively they fire.
                </p>
                <div className="space-y-2.5">
                    {[
                        { bit: 1, label: 'Sell Tax Restriction', source: 'GoPlus', desc: 'Buy/sell tax above maxTax threshold' },
                        { bit: 4, label: 'Obfuscated Tax Logic', source: 'AI', desc: 'Hidden fee logic in transfer() detected by LLM source reading' },
                        { bit: 5, label: 'Transfer Allowlist Honeypot', source: 'AI', desc: 'Whitelist preventing non-approved wallets from selling' },
                        { bit: 6, label: 'External Call Risk', source: 'AI', desc: 'Reentrancy or arbitrary external delegatecall' },
                        { bit: 7, label: 'Logic Bomb', source: 'AI', desc: 'Time-gated or condition-gated malicious code' },
                    ].map(({ bit, label, source, desc }) => (
                        <div key={bit} className="flex items-center gap-4" style={{
                            padding: '14px 18px', borderRadius: 12,
                            background: 'var(--bg-surface)', border: '1px solid var(--border)',
                        }}>
                            <span className="mono text-xs w-5 text-center flex-shrink-0" style={{ color: 'var(--text-subtle)' }}>{bit}</span>
                            <div className="flex-1">
                                <div className="flex items-center gap-2.5 mb-0.5">
                                    <span className="mono text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                    <span className={`badge ${source === 'AI' ? 'badge-indigo' : 'badge-green'}`}>{source}</span>
                                </div>
                                <p className="mono text-xs" style={{ color: 'var(--text-subtle)' }}>{desc}</p>
                            </div>
                            <span className="mono text-xs font-semibold" style={{ color: 'var(--green)' }}>ALWAYS ON</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom save */}
            {isDirty && (
                <button onClick={saveConfig} disabled={saving} className="btn btn-cyan w-full" style={{ justifyContent: 'center', padding: '12px 0' }}>
                    {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending setFirewallConfig() tx…</> : <><Save className="w-4 h-4" /> Save Changes → on-chain</>}
                </button>
            )}

            <p className="mono text-xs text-center" style={{ color: 'var(--text-subtle)' }}>
                Read via <code>firewallConfig()</code> · Written via <code>setFirewallConfig()</code> · Owner-only tx
            </p>
        </div>
    );
}
