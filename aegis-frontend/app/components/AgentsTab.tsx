'use client';

import { useState } from 'react';
import { Bot, Plus, Trash2, CheckCircle, XCircle, TrendingUp, AlertTriangle } from 'lucide-react';

type Agent = {
    id: string;
    name: string;
    address: string;
    budget: number;
    spent: number;
    status: 'Active' | 'Revoked';
    clearances: number;
    blocks: number;
};

const INITIAL_AGENTS: Agent[] = [
    { id: 'nova', name: 'NOVA', address: '0x00000000000000000000000000000000000A1FA0', budget: 0.05, spent: 0.01, status: 'Active', clearances: 3, blocks: 0 },
    { id: 'cipher', name: 'CIPHER', address: '0x00000000000000000000000000000000000B2FB1', budget: 0.01, spent: 0.01, status: 'Revoked', clearances: 0, blocks: 2 },
    { id: 'phantom', name: 'PHANTOM', address: '0x00000000000000000000000000000000000C3FC2', budget: 0.02, spent: 0.005, status: 'Active', clearances: 1, blocks: 0 },
];

export default function AgentsTab({ isKilled, onAudit }: { isKilled: boolean; onAudit: (token: string) => void }) {
    const [agents, setAgents] = useState<Agent[]>(INITIAL_AGENTS);
    const [showForm, setShowForm] = useState(false);
    const [newAddr, setNewAddr] = useState('');
    const [newName, setNewName] = useState('');
    const [newBudget, setNewBudget] = useState(0.05);

    const revoke = (id: string) => {
        setAgents(prev => prev.map(a => a.id === id ? { ...a, status: 'Revoked', budget: 0 } : a));
    };

    const subscribe = () => {
        if (!newAddr || !newName) return;
        const newAgent: Agent = {
            id: `agent-${Date.now()}`,
            name: newName.toUpperCase(),
            address: newAddr,
            budget: newBudget,
            spent: 0,
            status: 'Active',
            clearances: 0,
            blocks: 0,
        };
        setAgents(prev => [...prev, newAgent]);
        setNewAddr(''); setNewName(''); setNewBudget(0.05); setShowForm(false);
    };

    return (
        <div className="space-y-4">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Managed Agents</h2>
                    <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {agents.filter(a => a.status === 'Active').length} active · {agents.reduce((s, a) => s + a.budget, 0).toFixed(3)} ETH total budget
                    </p>
                </div>
                <button
                    onClick={() => setShowForm(s => !s)}
                    disabled={isKilled}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mono text-xs font-medium transition-all disabled:opacity-40"
                    style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)' }}
                >
                    <Plus className="w-3.5 h-3.5" /> Subscribe Agent
                </button>
            </div>

            {/* Subscribe form */}
            {showForm && (
                <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-bright)' }}>
                    <p className="mono text-xs font-semibold" style={{ color: 'var(--cyan)' }}>New Agent Subscription</p>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="mono text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Agent Name</label>
                            <input
                                value={newName}
                                onChange={e => setNewName(e.target.value)}
                                placeholder="e.g. REX"
                                className="w-full rounded-lg px-3 py-2 mono text-xs outline-none"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)' }}
                            />
                        </div>
                        <div>
                            <label className="mono text-xs block mb-1" style={{ color: 'var(--text-muted)' }}>Wallet Address</label>
                            <input
                                value={newAddr}
                                onChange={e => setNewAddr(e.target.value)}
                                placeholder="0x..."
                                className="w-full rounded-lg px-3 py-2 mono text-xs outline-none"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--text-primary)' }}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between mono text-xs mb-1.5">
                            <span style={{ color: 'var(--text-muted)' }}>Budget Cap</span>
                            <span style={{ color: 'var(--cyan)' }}>{newBudget.toFixed(3)} ETH</span>
                        </div>
                        <input type="range" min="0.001" max="1" step="0.001" value={newBudget}
                            onChange={e => setNewBudget(parseFloat(e.target.value))}
                            className="w-full" />
                        <div className="flex justify-between mono text-xs mt-1" style={{ color: 'var(--text-subtle)' }}>
                            <span>0.001 ETH</span><span>1 ETH</span>
                        </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                        <button onClick={subscribe}
                            className="flex-1 py-2 rounded-lg mono text-xs font-semibold transition-all"
                            style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.25)' }}>
                            Confirm — subscribeAgent()
                        </button>
                        <button onClick={() => setShowForm(false)}
                            className="px-4 py-2 rounded-lg mono text-xs transition-all"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Agent table */}
            <div className="space-y-2">
                {agents.map(agent => {
                    const pct = agent.budget > 0 ? Math.min(1, agent.spent / agent.budget) : 1;
                    const barColor = pct > 0.85 ? 'var(--red)' : pct > 0.6 ? 'var(--amber)' : 'var(--green)';
                    const remaining = Math.max(0, agent.budget - agent.spent);

                    return (
                        <div key={agent.id} className="rounded-xl p-4"
                            style={{ background: 'var(--bg-surface)', border: `1px solid ${agent.status === 'Revoked' ? 'rgba(239,68,68,0.15)' : 'var(--border)'}` }}>
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                        style={{ background: agent.status === 'Revoked' ? 'var(--red-dim)' : 'var(--bg-elevated)' }}>
                                        <Bot className="w-4 h-4" style={{ color: agent.status === 'Revoked' ? 'var(--red)' : 'var(--cyan)' }} />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="mono text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{agent.name}</span>
                                            <span className="mono text-xs px-1.5 py-0.5 rounded"
                                                style={agent.status === 'Active' ? { background: 'var(--green-dim)', color: 'var(--green)' } : { background: 'var(--red-dim)', color: 'var(--red)' }}>
                                                {agent.status}
                                            </span>
                                        </div>
                                        <p className="mono text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {agent.address.slice(0, 10)}...{agent.address.slice(-6)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-3 mono text-xs" style={{ color: 'var(--text-muted)' }}>
                                        <span className="flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" style={{ color: 'var(--green)' }} /> {agent.clearances}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <XCircle className="w-3 h-3" style={{ color: 'var(--red)' }} /> {agent.blocks}
                                        </span>
                                    </div>
                                    {agent.status === 'Active' && (
                                        <button onClick={() => revoke(agent.id)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg mono text-xs transition-all"
                                            style={{ background: 'var(--red-dim)', color: 'var(--red)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                            <Trash2 className="w-3 h-3" /> Revoke
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Budget bar */}
                            <div className="space-y-1.5">
                                <div className="flex justify-between mono text-xs" style={{ color: 'var(--text-muted)' }}>
                                    <span>Budget used</span>
                                    <span>{agent.spent.toFixed(4)} / {agent.budget.toFixed(3)} ETH
                                        <span className="ml-2" style={{ color: remaining < 0.001 ? 'var(--red)' : 'var(--text-muted)' }}>
                                            ({remaining.toFixed(4)} ETH left)
                                        </span>
                                    </span>
                                </div>
                                <div className="budget-bar">
                                    <div className="budget-bar-fill" style={{ width: `${pct * 100}%`, background: barColor }} />
                                </div>
                                {pct > 0.9 && (
                                    <p className="mono text-xs flex items-center gap-1" style={{ color: 'var(--amber)' }}>
                                        <AlertTriangle className="w-3 h-3" /> Budget nearly exhausted
                                    </p>
                                )}
                            </div>

                            {/* Quick audit button */}
                            {agent.status === 'Active' && (
                                <button
                                    onClick={() => onAudit('BRETT')}
                                    className="mt-3 w-full py-1.5 rounded-lg mono text-xs transition-all flex items-center justify-center gap-1.5"
                                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                                >
                                    <TrendingUp className="w-3 h-3" /> Simulate Trade → Oracle Feed
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
