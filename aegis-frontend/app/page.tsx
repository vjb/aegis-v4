'use client';

import { useState } from 'react';
import { Shield, Bot, SlidersHorizontal, FileText, ShoppingBag, Lock, Unlock, Radio, Zap } from 'lucide-react';
import AgentsTab from './components/AgentsTab';
import FirewallTab from './components/FirewallTab';
import AuditLogTab from './components/AuditLogTab';
import MarketplaceTab from './components/MarketplaceTab';
import OracleFeed from './components/OracleFeed';

type Tab = 'agents' | 'firewall' | 'log' | 'marketplace';

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [isKilled, setIsKilled] = useState(false);
  const [oracleToken, setOracleToken] = useState('');
  const [triggerAudit, setTriggerAudit] = useState<string | null>(null);

  const handleKillSwitch = () => {
    setIsKilled(k => !k);
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'agents', label: 'Agents', icon: Bot },
    { id: 'firewall', label: 'Firewall', icon: SlidersHorizontal },
    { id: 'log', label: 'Audit Log', icon: FileText },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
  ];

  return (
    <main
      className="flex flex-col h-screen"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'rgba(15,23,42,0.8)', backdropFilter: 'blur(12px)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #6366f1 100%)', boxShadow: '0 0 16px rgba(6,182,212,0.35)' }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-base" style={{ color: 'var(--text-primary)' }}>AEGIS</span>
              <span className="mono text-xs px-1.5 py-0.5 rounded" style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid rgba(6,182,212,0.2)' }}>v4</span>
            </div>
            <p className="mono text-xs" style={{ color: 'var(--text-muted)' }}>ERC-7579 Executor · Chainlink CRE Oracle</p>
          </div>
        </div>

        {/* Center status */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 mono text-xs" style={{ color: 'var(--text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full pulse-slow" style={{ background: 'var(--green)' }} />
              <span style={{ color: 'var(--green)' }}>Oracle Online</span>
            </span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            <span className="flex items-center gap-1.5">
              <Radio className="w-3 h-3" style={{ color: 'var(--cyan)' }} />
              <span>Chainlink CRE DON</span>
            </span>
            <span style={{ color: 'var(--border-bright)' }}>·</span>
            <span>Base VNet</span>
          </div>
        </div>

        {/* Right: kill switch */}
        <button
          onClick={handleKillSwitch}
          className="flex items-center gap-2 px-4 py-2 rounded-lg mono text-sm font-semibold transition-all"
          style={isKilled ? {
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.4)',
            color: 'var(--amber)',
            boxShadow: '0 0 16px rgba(245,158,11,0.15)'
          } : {
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#f87171',
          }}
        >
          {isKilled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          {isKilled ? 'UNLOCK PROTOCOL' : 'KILL SWITCH'}
        </button>
      </header>

      {/* ── Kill switch banner ── */}
      {isKilled && (
        <div className="px-5 py-2 flex items-center gap-2 mono text-xs font-semibold flex-shrink-0"
          style={{ background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid rgba(245,158,11,0.2)', color: 'var(--amber)' }}>
          <Zap className="w-3 h-3" />
          PROTOCOL LOCKED — All agentic outflow halted. Smart Account connections severed.
        </div>
      )}

      {/* ── Body: Left tabs + Right oracle ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left panel */}
        <div className="flex flex-col w-[58%] min-h-0" style={{ borderRight: '1px solid var(--border)' }}>
          {/* Tab bar */}
          <div
            className="flex items-center gap-1 px-4 py-2 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--border)', background: 'rgba(15,23,42,0.5)' }}
          >
            {tabs.map(t => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg mono text-xs font-medium transition-all"
                  style={active ? {
                    background: 'var(--cyan-dim)',
                    color: 'var(--cyan)',
                    border: '1px solid rgba(6,182,212,0.2)'
                  } : {
                    color: 'var(--text-muted)',
                    border: '1px solid transparent',
                  }}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'agents' && <AgentsTab isKilled={isKilled} onAudit={tok => setTriggerAudit(tok)} />}
            {activeTab === 'firewall' && <FirewallTab />}
            {activeTab === 'log' && <AuditLogTab />}
            {activeTab === 'marketplace' && <MarketplaceTab isKilled={isKilled} onAudit={tok => { setActiveTab('agents'); setTriggerAudit(tok); }} />}
          </div>
        </div>

        {/* Right panel — Oracle Feed (always visible) */}
        <div className="flex-1 flex flex-col min-h-0">
          <OracleFeed isKilled={isKilled} externalTrigger={triggerAudit} onTriggerConsumed={() => setTriggerAudit(null)} />
        </div>
      </div>
    </main>
  );
}
