'use client';

import { useAuditStream } from '@/hooks/useAuditStream';
import { useEscrow } from '@/hooks/useEscrow';
import { useState, useEffect, useRef, useMemo } from 'react';
import type { AuditEventDTO } from '@kroxy/types';

const API_URL  = process.env.NEXT_PUBLIC_API_URL            ?? 'http://localhost:3001';
const BASE_SCAN = 'https://sepolia.basescan.org';

// ─── Judge config ──────────────────────────────────────────────────────────────

const JUDGE_DEFS = [
  { key: 'judge-alpha', fallback: 'claude-sonnet', name: 'Judge Alpha', provider: 'Strict · Textualist',        color: 'violet' as const, icon: '◈' },
  { key: 'judge-beta',  fallback: 'gpt-4o',        name: 'Judge Beta',  provider: 'Pragmatic · Performance',    color: 'emerald' as const, icon: '◉' },
  { key: 'judge-gamma', fallback: 'gemini-flash',  name: 'Judge Gamma', provider: 'Data-Driven · Statistical',  color: 'sky' as const,    icon: '◎' },
];

// ─── Phase ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'active' | 'verifying' | 'released' | 'disputed' | 'deliberating' | 'resolved';

function getPhase(escrow: any, events: AuditEventDTO[]): Phase {
  if (!escrow) return 'idle';
  const state = escrow.state;
  if (state === 'RELEASED') return 'released';
  if (state === 'DISPUTED') {
    if (events.some(e => e.eventType === 'CONSENSUS_REACHED')) return 'resolved';
    if (events.some(e => e.eventType === 'JUDGE_COMMITTED'))   return 'deliberating';
    return 'disputed';
  }
  if (events.some(e => e.eventType === 'CONDITION_CHECKED')) return 'verifying';
  return 'active';
}

const PHASE_LABEL: Record<Phase, string> = {
  idle:         'Awaiting agent interaction',
  active:       'USDC locked — service in progress',
  verifying:    'Verifying conditions on-chain',
  released:     'All conditions met — payment released',
  disputed:     'Conditions failed — dispute raised',
  deliberating: 'LLM court deliberating',
  resolved:     'Court reached consensus — verdict executed',
};

const PHASE_COLOR: Record<Phase, string> = {
  idle:         'text-zinc-500',
  active:       'text-cyan-400',
  verifying:    'text-amber-400',
  released:     'text-green-400',
  disputed:     'text-red-400',
  deliberating: 'text-violet-400',
  resolved:     'text-violet-300',
};

// ─── Utility hooks ─────────────────────────────────────────────────────────────

function useStats() {
  const [s, setS] = useState<any>(null);
  useEffect(() => {
    const go = () => fetch(`${API_URL}/api/stats`).then(r => r.json()).then(setS).catch(() => {});
    go();
    const iv = setInterval(go, 10_000);
    return () => clearInterval(iv);
  }, []);
  return s;
}

function useCourtCases() {
  const [cases, setCases] = useState<any[]>([]);
  useEffect(() => {
    const go = () => fetch(`${API_URL}/api/court/cases?limit=5`).then(r => r.json()).then(d => Array.isArray(d) && setCases(d)).catch(() => {});
    go();
    const iv = setInterval(go, 8_000);
    return () => clearInterval(iv);
  }, []);
  return cases;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function usd(micro: string | number | bigint | undefined | null) {
  if (micro == null) return '—';
  return `$${(Number(BigInt(String(micro))) / 1e6).toFixed(2)}`;
}
function short(addr: string) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

// ─── Background ───────────────────────────────────────────────────────────────

function Background() {
  return (
    <div className="fixed inset-0 bg-[#07070f] bg-grid pointer-events-none" />
  );
}

// ─── Flow line (animated USDC sweep) ─────────────────────────────────────────

function FlowLine({ active, reversed = false, color = 'cyan', label }: {
  active: boolean; reversed?: boolean; color?: string; label?: string;
}) {
  const via = color === 'green' ? 'rgba(34,197,94,0.9)' : color === 'violet' ? 'rgba(139,92,246,0.9)' : 'rgba(6,182,212,0.9)';
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 mx-3 min-w-[60px]">
      {label && (
        <span className={`text-[10px] font-bold font-mono transition-all duration-500 ${active ? (color === 'green' ? 'text-green-400' : 'text-cyan-400') : 'text-zinc-700'}`}>
          {label}
        </span>
      )}
      <div className="relative w-full h-[2px] rounded-full overflow-hidden bg-zinc-800/60">
        {active && (
          <div
            className={reversed ? 'flow-left' : 'flow-right'}
            style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(90deg, transparent 0%, ${via} 50%, transparent 100%)`,
              backgroundSize: '200% 100%',
            }}
          />
        )}
      </div>
      <span className={`text-[11px] transition-colors duration-500 ${active ? (color === 'green' ? 'text-green-500/60' : 'text-cyan-500/60') : 'text-zinc-800'}`}>
        {reversed ? '◂' : '▸'}
      </span>
    </div>
  );
}

// ─── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ side, address, name, role, action, state, escrow }: {
  side: 'left' | 'right'; address: string; name: string; role: string;
  action: string; state: string; escrow: any;
}) {
  const isLeft  = side === 'left';
  const isPaying    = escrow?.state === 'ACTIVE' && isLeft;
  const isReceiving = escrow?.state === 'RELEASED' && !isLeft;
  const isDisputing = escrow?.state === 'DISPUTED';

  const borderColor = isReceiving ? 'border-green-600/60'
    : isPaying      ? 'border-cyan-600/40'
    : isDisputing   ? 'border-red-700/40'
    : 'border-zinc-800/80';
  const bgColor = isReceiving ? 'bg-green-950/20'
    : isPaying    ? 'bg-cyan-950/10'
    : isDisputing ? 'bg-red-950/10'
    : 'bg-zinc-950/60';
  const glowClass = isReceiving ? 'glow-green' : isPaying ? 'glow-cyan' : isDisputing ? 'glow-red' : '';

  return (
    <div className={`relative w-[170px] shrink-0 rounded-2xl border ${borderColor} ${bgColor} ${glowClass} p-4 transition-all duration-700 backdrop-blur-sm`}>
      {/* Status dot */}
      <div className="absolute top-3 right-3">
        <span className={`block w-2 h-2 rounded-full ${
          isReceiving ? 'bg-green-400' : isPaying ? 'bg-cyan-400 animate-pulse' : isDisputing ? 'bg-red-400 animate-pulse' : 'bg-zinc-700'
        }`} />
      </div>

      {/* Role */}
      <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-2">{role}</p>

      {/* Name */}
      <p className="text-sm font-bold text-white mb-0.5">{name}</p>

      {/* Address */}
      <a
        href={`${BASE_SCAN}/address/${address}`}
        target="_blank" rel="noreferrer"
        className="text-[9px] font-mono text-zinc-600 hover:text-cyan-500 transition-colors"
      >
        {short(address)} ↗
      </a>

      {/* Divider */}
      <div className="h-px bg-zinc-800/60 my-3" />

      {/* Action */}
      <p className={`text-[10px] leading-relaxed transition-colors duration-500 ${
        isReceiving ? 'text-green-400' : isPaying ? 'text-cyan-400' : isDisputing ? 'text-red-400' : 'text-zinc-500'
      }`}>
        {action}
      </p>
    </div>
  );
}

// ─── Escrow orb (center) ──────────────────────────────────────────────────────

function EscrowOrb({ escrow, checks, total }: { escrow: any; checks: number; total: number }) {
  const state  = escrow?.state;
  const amount = escrow ? usd(escrow.amountUsdc) : null;

  const glowClass   = state === 'RELEASED' ? 'glow-green' : state === 'DISPUTED' ? 'glow-red' : state === 'ACTIVE' ? 'glow-cyan' : '';
  const borderColor = state === 'RELEASED' ? 'border-green-500/50' : state === 'DISPUTED' ? 'border-red-500/50' : state === 'ACTIVE' ? 'border-cyan-500/40' : 'border-zinc-700/60';
  const bgColor     = state === 'RELEASED' ? 'bg-green-950/30' : state === 'DISPUTED' ? 'bg-red-950/30' : state === 'ACTIVE' ? 'bg-cyan-950/20' : 'bg-zinc-950/60';
  const amountColor = state === 'RELEASED' ? 'text-green-400' : state === 'DISPUTED' ? 'text-red-400' : 'text-cyan-400';

  return (
    <div className={`relative w-[148px] h-[148px] shrink-0 rounded-full border-2 ${borderColor} ${bgColor} ${glowClass} flex flex-col items-center justify-center transition-all duration-700 backdrop-blur-sm`}>

      {/* Ring decoration */}
      <div className={`absolute inset-2 rounded-full border ${state === 'ACTIVE' ? 'border-cyan-800/30 animate-spin-slow' : 'border-zinc-800/20'}`}
        style={{ borderStyle: 'dashed' }} />

      {amount ? (
        <>
          <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">USDC Escrow</p>
          <p className={`text-[26px] font-black leading-none ${amountColor}`}>{amount}</p>
          <p className={`text-[9px] font-mono mt-1 ${
            state === 'RELEASED' ? 'text-green-600' : state === 'DISPUTED' ? 'text-red-600' : 'text-cyan-700'
          }`}>{state}</p>

          {state === 'ACTIVE' && total > 0 && (
            <div className="absolute bottom-5 w-20">
              <div className="h-[2px] bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min((checks / total) * 100, 100)}%` }} />
              </div>
              <p className="text-center text-[8px] text-zinc-700 mt-0.5 font-mono">{checks}/{total}</p>
            </div>
          )}

          {/* TX hash link */}
          {escrow?.txHashCreated && (
            <a href={`${BASE_SCAN}/tx/${escrow.txHashCreated}`} target="_blank" rel="noreferrer"
              className="absolute bottom-3 text-[8px] font-mono text-zinc-800 hover:text-zinc-600 transition-colors">
              {escrow.txHashCreated.slice(0, 8)}…
            </a>
          )}
        </>
      ) : (
        <div className="text-center">
          <p className="text-zinc-800 text-[9px] uppercase tracking-widest">Escrow</p>
          <p className="text-zinc-800 text-[8px] mt-1">awaiting…</p>
        </div>
      )}
    </div>
  );
}

// ─── Condition card ───────────────────────────────────────────────────────────

function ConditionCard({ event, idx }: { event: AuditEventDTO | null; idx: number }) {
  const d      = event?.rawData as Record<string, unknown> | null;
  const passed = d?.passed as boolean | undefined;
  const label  = (d?.conditionId as string | undefined) ?? `check-${idx + 1}`;
  const value  = d?.actualValue != null ? String(d.actualValue).slice(0, 16) : null;

  return (
    <div className={`animate-fade-in-up cond-${idx} rounded-xl border p-3 text-center transition-all duration-500 ${
      passed === true  ? 'border-green-800/60 bg-green-950/30'  :
      passed === false ? 'border-red-800/60 bg-red-950/30'      :
      'border-zinc-800/50 bg-zinc-950/40'
    }`}>
      <div className={`text-xl mb-1 leading-none ${
        passed === true  ? 'text-green-400 animate-check-pop' :
        passed === false ? 'text-red-400 animate-cross-pop'   :
        'text-zinc-700'
      }`}>
        {passed === true ? '✓' : passed === false ? '✕' : <span className="shimmer inline-block w-4 h-4 rounded" />}
      </div>
      <p className="text-[9px] font-mono text-zinc-500 truncate">{label}</p>
      {value && <p className="text-[8px] font-mono text-zinc-700 mt-0.5 truncate">{value}</p>}
    </div>
  );
}

// ─── Judge card with typewriter ───────────────────────────────────────────────

const JUDGE_COLORS = {
  violet:  { ring: 'border-violet-700/50', bg: 'bg-violet-950/20', badge: 'bg-violet-900/60 text-violet-300', verdict: 'text-violet-400' },
  emerald: { ring: 'border-emerald-700/50', bg: 'bg-emerald-950/20', badge: 'bg-emerald-900/60 text-emerald-300', verdict: 'text-emerald-400' },
  sky:     { ring: 'border-sky-700/50', bg: 'bg-sky-950/20', badge: 'bg-sky-900/60 text-sky-300', verdict: 'text-sky-400' },
};

const VERDICT_STYLES: Record<string, { label: string; cls: string }> = {
  PLAINTIFF_WINS: { label: 'Plaintiff Wins', cls: 'bg-red-950/60 text-red-300 border border-red-800/50' },
  DEFENDANT_WINS: { label: 'Defendant Wins', cls: 'bg-green-950/60 text-green-300 border border-green-800/50' },
  SPLIT:          { label: 'Split',          cls: 'bg-amber-950/60 text-amber-300 border border-amber-800/50' },
};

function JudgeCard({ def, commitEvent, revealEvent }: {
  def: typeof JUDGE_DEFS[0];
  commitEvent: AuditEventDTO | null;
  revealEvent: AuditEventDTO | null;
}) {
  const [displayed, setDisplayed] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const rd      = revealEvent?.rawData as Record<string, unknown> | null;
  const cd      = commitEvent?.rawData as Record<string, unknown> | null;
  const reasoning = rd?.reasoning as string | undefined;
  const verdict   = rd?.verdict   as string | undefined;
  const commitHash = cd?.commitHash as string | undefined;

  const status = revealEvent ? 'revealed' : commitEvent ? 'committed' : 'waiting';

  // Typewriter
  useEffect(() => {
    if (!reasoning) { setDisplayed(''); return; }
    if (intervalRef.current) clearInterval(intervalRef.current);
    let i = 0;
    setDisplayed('');
    intervalRef.current = setInterval(() => {
      i++;
      setDisplayed(reasoning.slice(0, i));
      if (i >= reasoning.length && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 16);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [reasoning]);

  const c = JUDGE_COLORS[def.color];
  const vs = verdict ? VERDICT_STYLES[verdict] : null;

  return (
    <div className={`animate-slide-up flex-1 rounded-2xl border p-4 transition-all duration-700 ${
      status === 'revealed'  ? `${c.ring} ${c.bg}` :
      status === 'committed' ? 'border-cyan-800/40 bg-cyan-950/10' :
      'border-zinc-800/60 bg-zinc-950/40'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className={`text-lg ${
              status === 'revealed' ? (verdict === 'PLAINTIFF_WINS' ? 'text-red-400' : verdict === 'DEFENDANT_WINS' ? 'text-green-400' : 'text-amber-400') :
              status === 'committed' ? 'text-cyan-400' : 'text-zinc-700'
            }`}>{def.icon}</span>
            <p className="text-sm font-bold text-white">{def.name}</p>
          </div>
          <p className="text-[9px] text-zinc-600 ml-6">{def.provider}</p>
        </div>
        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
          status === 'revealed'  ? `${c.badge}` :
          status === 'committed' ? 'bg-cyan-900/60 text-cyan-300' :
          'bg-zinc-800/80 text-zinc-600'
        }`}>
          {status === 'waiting' ? 'analyzing…' : status}
        </span>
      </div>

      {/* Commit hash */}
      {commitHash && (
        <div className="mb-3 rounded-lg bg-zinc-900/60 border border-zinc-800/50 px-2 py-1.5">
          <p className="text-[8px] text-zinc-600 mb-0.5 uppercase tracking-wider">commit hash</p>
          <p className="text-[9px] font-mono text-cyan-800 truncate">{commitHash.slice(0, 26)}…</p>
        </div>
      )}

      {/* Verdict badge */}
      {vs && (
        <div className={`text-[10px] font-bold px-3 py-1 rounded-lg text-center mb-3 ${vs.cls}`}>
          {vs.label}
        </div>
      )}

      {/* Reasoning */}
      <div className="min-h-[48px]">
        {status === 'waiting' ? (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1 h-1 rounded-full bg-zinc-700 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }} />
            ))}
          </div>
        ) : (
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            {displayed || <span className="text-zinc-700">Loading…</span>}
            {reasoning && displayed.length < reasoning.length && (
              <span className="text-zinc-500 animate-pulse">▌</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Court room ───────────────────────────────────────────────────────────────

function CourtRoom({ visible, events, escrowId, cases }: {
  visible: boolean; events: AuditEventDTO[]; escrowId: string | null; cases: any[];
}) {
  const courtCase = cases.find(c => c.escrowId === escrowId);
  const consensusEvent = events.find(e => e.escrowId === escrowId && e.eventType === 'CONSENSUS_REACHED');
  const consensusVerdict = (consensusEvent?.rawData as any)?.verdict as string | undefined;
  const vs = consensusVerdict ? VERDICT_STYLES[consensusVerdict] : null;

  const judgeData = JUDGE_DEFS.map((def, i) => {
    const commits = events.filter(e => e.escrowId === escrowId && e.eventType === 'JUDGE_COMMITTED');
    const reveals = events.filter(e => e.escrowId === escrowId && e.eventType === 'JUDGE_REVEALED');

    const commit = commits.find(e => {
      const d = e.rawData as any;
      return d.judge === def.key || d.judge === def.fallback;
    }) ?? commits[i] ?? null;

    const reveal = reveals.find(e => {
      const d = e.rawData as any;
      return d.judge === def.key || d.judge === def.fallback;
    }) ?? reveals[i] ?? null;

    return { def, commit, reveal };
  });

  if (!visible) return null;

  return (
    <div className="animate-slide-up border-t border-zinc-800/60 bg-zinc-950/40 backdrop-blur-sm px-6 py-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <p className="text-xs font-bold text-white uppercase tracking-widest">Kroxy Court · LLM Panel</p>
          {courtCase?.evidenceIpfsHash && (
            <a href={`https://ipfs.io/ipfs/${courtCase.evidenceIpfsHash}`} target="_blank" rel="noreferrer"
              className="text-[9px] font-mono text-zinc-600 hover:text-cyan-500 transition-colors">
              evidence ↗
            </a>
          )}
        </div>
        {vs && (
          <div className={`text-sm font-black px-4 py-1.5 rounded-xl animate-fade-in-up ${vs.cls}`}>
            {vs.label}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        {judgeData.map(({ def, commit, reveal }) => (
          <JudgeCard key={def.key} def={def} commitEvent={commit} revealEvent={reveal} />
        ))}
      </div>
    </div>
  );
}

// ─── Condition grid ───────────────────────────────────────────────────────────

function ConditionGrid({ checks }: { checks: AuditEventDTO[] }) {
  const SLOTS = 6;
  const slots = Array.from({ length: SLOTS }, (_, i) => checks[i] ?? null);
  return (
    <div className="border-t border-zinc-800/60 bg-zinc-950/30 backdrop-blur-sm px-6 py-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Condition Verification</p>
        <span className="text-[9px] font-mono text-zinc-700">
          {checks.filter(e => (e.rawData as any)?.passed).length}/{checks.length} passed
        </span>
      </div>
      <div className="grid grid-cols-6 gap-2">
        {slots.map((e, i) => <ConditionCard key={i} event={e} idx={i} />)}
      </div>
    </div>
  );
}

// ─── Event ticker ──────────────────────────────────────────────────────────────

const EVT_COLOR: Record<string, string> = {
  CONTRACT_CREATED:   'text-blue-500',
  ESCROW_LOCKED:      'text-cyan-500',
  CONDITION_CHECKED:  'text-amber-500',
  PAYMENT_RELEASED:   'text-green-500',
  DISPUTE_RAISED:     'text-red-500',
  CASE_OPENED:        'text-violet-400',
  JUDGE_COMMITTED:    'text-violet-500',
  JUDGE_REVEALED:     'text-violet-300',
  CONSENSUS_REACHED:  'text-pink-400',
  REPUTATION_UPDATED: 'text-emerald-500',
  EVIDENCE_POSTED:    'text-orange-400',
};

function EventTicker({ events }: { events: AuditEventDTO[] }) {
  const recent = useMemo(() => events.slice(-30).reverse(), [events]);
  if (recent.length === 0) return (
    <div className="shrink-0 h-8 border-t border-zinc-900 bg-zinc-950/80 flex items-center px-4">
      <span className="text-[9px] text-zinc-700 font-mono">awaiting events — run <code>node demo.js</code> to start</span>
    </div>
  );

  const items = [...recent, ...recent]; // duplicate for seamless loop

  return (
    <div className="shrink-0 h-8 border-t border-zinc-900 bg-zinc-950/90 overflow-hidden flex items-center">
      <div className="flex gap-8 whitespace-nowrap ticker">
        {items.map((e, i) => {
          const color = EVT_COLOR[e.eventType] ?? 'text-zinc-600';
          return (
            <span key={i} className="text-[9px] font-mono flex items-center gap-2">
              <span className={`${color} font-bold`}>{e.eventType.replace(/_/g, ' ')}</span>
              <span className="text-zinc-700">{e.actorAddress ? short(e.actorAddress) : ''}</span>
              <span className="text-zinc-800">·</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Stats bar ─────────────────────────────────────────────────────────────────

function StatsBar({ stats, connected, now }: { stats: any; connected: boolean; now: Date }) {
  return (
    <div className="shrink-0 flex items-center justify-between px-5 py-2 border-b border-zinc-900/80 bg-zinc-950/60 backdrop-blur-sm">
      <div className="flex items-center gap-5">
        {/* Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-500 flex items-center justify-center text-[11px] font-black shadow-[0_0_16px_rgba(139,92,246,0.4)]">
            K
          </div>
          <div>
            <p className="text-[11px] font-black tracking-tight text-white">KROXY</p>
            <p className="text-[8px] text-zinc-600 tracking-widest">AI AGENT ECONOMY</p>
          </div>
        </div>

        <div className="w-px h-6 bg-zinc-800" />

        {/* Network */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-400 animate-pulse' : 'bg-zinc-700'}`} />
          <span className="text-[9px] font-mono text-zinc-600">{connected ? 'LIVE' : 'OFFLINE'} · BASE SEPOLIA</span>
        </div>

        {/* Stats pills */}
        {stats && (
          <div className="flex items-center gap-3 text-[10px]">
            <span><span className="text-cyan-400 font-bold">{usd(stats.totalUsdcInEscrow)}</span><span className="text-zinc-600"> in escrow</span></span>
            <span><span className="text-green-400 font-bold">{usd(stats.settled24h)}</span><span className="text-zinc-600"> settled 24h</span></span>
            {stats.activeJobs > 0 && <span><span className="text-violet-400 font-bold">{stats.activeJobs}</span><span className="text-zinc-600"> jobs</span></span>}
            {stats.activeCases > 0 && <span className="text-pink-400 font-bold animate-pulse">{stats.activeCases} court case{stats.activeCases > 1 ? 's' : ''}</span>}
          </div>
        )}
      </div>

      <span className="text-[10px] font-mono text-zinc-700">{now.toLocaleTimeString()}</span>
    </div>
  );
}

// ─── Narrative banner ─────────────────────────────────────────────────────────

function NarrativeBanner({ phase, escrow, checks, total }: {
  phase: Phase; escrow: any; checks: number; total: number;
}) {
  const amount = escrow ? usd(escrow.amountUsdc) : '';
  const messages: Record<Phase, string> = {
    idle:         '◈  Awaiting agent interaction — run node demo.js to begin',
    active:       `◈  Agent B has ${amount} USDC locked in escrow and is delivering service`,
    verifying:    `◈  Verifying ${checks} of ${total} conditions on-chain — checking HTTP endpoints and data quality`,
    released:     `◈  All conditions met — ${amount} USDC released to Agent B — transaction complete`,
    disputed:     `◈  Conditions failed — dispute raised — summoning three independent LLM judges`,
    deliberating: `◈  Claude, GPT-4o, and Gemini are independently analyzing the evidence`,
    resolved:     `◈  Court has reached consensus — verdict executed on Base Sepolia`,
  };

  return (
    <div key={phase} className={`shrink-0 flex items-center justify-center px-6 py-3 border-b ${
      phase === 'released'     ? 'border-green-900/40 bg-green-950/15' :
      phase === 'disputed'     ? 'border-red-900/40 bg-red-950/15' :
      phase === 'deliberating' ? 'border-violet-900/40 bg-violet-950/15' :
      phase === 'resolved'     ? 'border-violet-900/60 bg-violet-950/20' :
      phase === 'verifying'    ? 'border-amber-900/30 bg-amber-950/10' :
      'border-zinc-900/60 bg-zinc-950/30'
    }`} style={{ animation: 'narrative-fade 0.6s ease-out both' }}>
      <p className={`text-[11px] font-semibold text-center ${PHASE_COLOR[phase]}`}>
        {messages[phase]}
      </p>
    </div>
  );
}

// ─── Side event log ───────────────────────────────────────────────────────────

function EventLog({ events }: { events: AuditEventDTO[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const recent = useMemo(() => [...events].reverse().slice(0, 40), [events]);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [events.length]);

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-zinc-900/60">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-600">Live Events</p>
        <span className="ml-auto text-[8px] font-mono text-zinc-700">{events.length}</span>
      </div>
      <div ref={ref} className="flex-1 overflow-y-auto py-1">
        {recent.length === 0 ? (
          <p className="text-[9px] text-zinc-700 text-center mt-8">no events yet</p>
        ) : (
          recent.map((e, i) => {
            const color = EVT_COLOR[e.eventType] ?? 'text-zinc-600';
            const isCourtEvent = ['CASE_OPENED','JUDGE_COMMITTED','JUDGE_REVEALED','CONSENSUS_REACHED'].includes(e.eventType);
            return (
              <div key={e.id} className={`chain-block animate-fade-in-up px-3 py-1.5 border-b border-zinc-900/30 transition-colors hover:bg-zinc-900/20 ${
                isCourtEvent ? 'bg-violet-950/10' : ''
              }`}>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`w-1 h-1 rounded-full ${color.replace('text-', 'bg-')}`} />
                  <span className={`text-[9px] font-bold ${color}`}>{e.eventType.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center justify-between ml-2.5">
                  <span className="text-[8px] font-mono text-zinc-700">{e.actorAddress ? short(e.actorAddress) : ''}</span>
                  <span className="text-[8px] font-mono text-zinc-800">{e.thisHash ? e.thisHash.slice(0, 8) : e.hash.slice(0, 8)}…</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function KroxyDashboard() {
  const [escrowId, setEscrowId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const { events, connected } = useAuditStream(escrowId ?? undefined);
  const { escrow } = useEscrow(escrowId);
  const stats     = useStats();
  const courtCases = useCourtCases();

  // Auto-latch to latest escrow from events
  useEffect(() => {
    if (!escrowId && events.length > 0) setEscrowId(events[0].escrowId);
  }, [events, escrowId]);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const checks     = useMemo(() => events.filter(e => e.eventType === 'CONDITION_CHECKED'), [events]);
  const totalChecks = 6;
  const phase      = getPhase(escrow, events);
  const state      = escrow?.state;

  // Agent info (fall back to escrow payer/payee when available)
  const agentAAddr = escrow?.payerAddress ?? '0x31635eFbCa9E2580Ad1Ab5af208c6285fF57b736';
  const agentBAddr = escrow?.payeeAddress ?? '0x5798E1e0609bbd18FaDD7c5F9dFfee2370a5112c';

  const agentAAction = phase === 'idle'         ? 'Waiting to post a job'
    : phase === 'active'       ? `Locked ${usd(escrow?.amountUsdc)} in escrow`
    : phase === 'verifying'    ? 'Waiting for condition checks'
    : phase === 'released'     ? 'Payment sent — transaction complete'
    : phase === 'disputed'     ? 'Dispute raised — awaiting court'
    : phase === 'deliberating' ? 'Awaiting court verdict'
    : phase === 'resolved'     ? 'Court resolved the dispute'
    : '';

  const agentBAction = phase === 'idle'         ? 'Waiting for a job'
    : phase === 'active'       ? 'Delivering service…'
    : phase === 'verifying'    ? 'Conditions being checked'
    : phase === 'released'     ? `Received ${usd(escrow?.amountUsdc)} USDC`
    : phase === 'disputed'     ? 'Defending in court'
    : phase === 'deliberating' ? 'Awaiting judge verdicts'
    : phase === 'resolved'     ? 'Verdict executed on-chain'
    : '';

  // Flow directions
  const flowAtoE = state === 'ACTIVE';
  const flowEtoB = state === 'RELEASED';
  const flowLabel = flowEtoB ? usd(escrow?.amountUsdc) : flowAtoE ? usd(escrow?.amountUsdc) : undefined;

  // Show sections
  const showConditions = ['verifying', 'released', 'disputed'].includes(phase) && checks.length > 0;
  const showCourt      = ['disputed', 'deliberating', 'resolved'].includes(phase);

  return (
    <div className="h-screen flex flex-col bg-[#07070f] text-white overflow-hidden scanlines">
      <Background />

      {/* ── Stats + header ── */}
      <StatsBar stats={stats} connected={connected} now={now} />

      {/* ── Narrative ── */}
      <NarrativeBanner phase={phase} escrow={escrow} checks={checks.length} total={totalChecks} />

      {/* ── Main content ── */}
      <div className="flex-1 flex min-h-0">

        {/* LEFT: Event log sidebar */}
        <aside className="w-[200px] shrink-0 border-r border-zinc-900/60 bg-zinc-950/20 backdrop-blur-sm">
          <EventLog events={events} />
        </aside>

        {/* CENTER: Scene + panels */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* ── Hero scene ── */}
          <div className={`shrink-0 flex items-center justify-center gap-0 px-8 py-6 transition-colors duration-700 ${
            state === 'RELEASED' ? 'bg-green-950/5' :
            state === 'DISPUTED' ? 'bg-red-950/5'   :
            state === 'ACTIVE'   ? 'bg-cyan-950/5'  : ''
          }`}>
            {/* Agent A */}
            <AgentCard
              side="left"
              address={agentAAddr}
              name="Agent Alpha"
              role="Buyer / Payer"
              action={agentAAction}
              state={phase}
              escrow={escrow}
            />

            {/* Flow A → Escrow */}
            <FlowLine
              active={flowAtoE}
              reversed={false}
              color="cyan"
              label={flowAtoE ? flowLabel : undefined}
            />

            {/* Escrow orb */}
            <EscrowOrb escrow={escrow} checks={checks.length} total={totalChecks} />

            {/* Flow Escrow → B */}
            <FlowLine
              active={flowEtoB}
              reversed={false}
              color="green"
              label={flowEtoB ? flowLabel : undefined}
            />

            {/* Agent B */}
            <AgentCard
              side="right"
              address={agentBAddr}
              name="Agent Beta"
              role="Seller / Payee"
              action={agentBAction}
              state={phase}
              escrow={escrow}
            />
          </div>

          {/* ── Condition checks (when verifying/released/disputed) ── */}
          {showConditions && <ConditionGrid checks={checks} />}

          {/* ── Court room (when disputed/deliberating/resolved) ── */}
          {showCourt && (
            <div className="flex-1 min-h-0 overflow-y-auto">
              <CourtRoom
                visible={showCourt}
                events={events}
                escrowId={escrowId}
                cases={courtCases}
              />
            </div>
          )}

          {/* ── Idle / released fill ── */}
          {!showConditions && !showCourt && (
            <div className="flex-1 flex items-center justify-center">
              {phase === 'idle' ? (
                <div className="text-center animate-fade-in-up">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-900/40 to-cyan-900/40 border border-zinc-800 flex items-center justify-center mx-auto mb-4 animate-float">
                    <span className="text-2xl text-zinc-600">◈</span>
                  </div>
                  <p className="text-zinc-600 text-sm font-semibold mb-2">No active escrow</p>
                  <p className="text-zinc-700 text-xs">Run <code className="bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded text-cyan-600">node demo.js</code> to start the demo</p>
                </div>
              ) : phase === 'released' ? (
                <div className="text-center animate-fade-in-up">
                  <div className="text-5xl mb-3 animate-float">✓</div>
                  <p className="text-green-400 font-bold text-lg">{usd(escrow?.amountUsdc)} released</p>
                  <p className="text-zinc-600 text-sm mt-1">Agent Beta successfully delivered the service</p>
                  {escrow?.txHashSettled && (
                    <a href={`${BASE_SCAN}/tx/${escrow.txHashSettled}`} target="_blank" rel="noreferrer"
                      className="inline-block mt-3 text-[10px] font-mono text-cyan-700 hover:text-cyan-400 transition-colors">
                      {escrow.txHashSettled.slice(0, 20)}… ↗
                    </a>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* RIGHT: Escrow details sidebar */}
        <aside className="w-[200px] shrink-0 border-l border-zinc-900/60 bg-zinc-950/20 backdrop-blur-sm p-3 space-y-4 overflow-y-auto">
          {/* Escrow details */}
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-700 mb-2">Escrow</p>
            {escrow ? (
              <div className="space-y-2 text-[9px]">
                <div className="flex justify-between">
                  <span className="text-zinc-600">Amount</span>
                  <span className="font-mono font-bold text-cyan-400">{usd(escrow.amountUsdc)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-600">State</span>
                  <span className={`font-bold ${
                    state === 'RELEASED' ? 'text-green-400' :
                    state === 'DISPUTED' ? 'text-red-400' :
                    state === 'ACTIVE'   ? 'text-cyan-400' : 'text-zinc-500'
                  }`}>{state}</span>
                </div>
                {escrow.txHashCreated && (
                  <div>
                    <span className="text-zinc-600 block mb-0.5">Create TX</span>
                    <a href={`${BASE_SCAN}/tx/${escrow.txHashCreated}`} target="_blank" rel="noreferrer"
                      className="font-mono text-zinc-700 hover:text-cyan-500 transition-colors block truncate">
                      {escrow.txHashCreated.slice(0, 14)}… ↗
                    </a>
                  </div>
                )}
                {escrow.txHashSettled && (
                  <div>
                    <span className="text-zinc-600 block mb-0.5">Settle TX</span>
                    <a href={`${BASE_SCAN}/tx/${escrow.txHashSettled}`} target="_blank" rel="noreferrer"
                      className={`font-mono transition-colors block truncate ${
                        state === 'RELEASED' ? 'text-green-700 hover:text-green-400' : 'text-red-700 hover:text-red-400'
                      }`}>
                      {escrow.txHashSettled.slice(0, 14)}… ↗
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[9px] text-zinc-700">awaiting…</p>
            )}
          </div>

          <div className="h-px bg-zinc-900" />

          {/* Phase indicator */}
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-700 mb-2">Phase</p>
            <div className="space-y-1">
              {(['idle','active','verifying','released','disputed','deliberating','resolved'] as Phase[]).map(p => {
                const steps: Phase[] = ['idle','active','verifying'];
                const disputeSteps: Phase[] = ['disputed','deliberating','resolved'];
                const isHappyPath = [...steps, 'released'].includes(phase);
                const show = isHappyPath ? [...steps, 'released'].includes(p) : [...steps.slice(0,2), ...disputeSteps].includes(p);
                if (!show) return null;
                const isDone = (isHappyPath
                  ? ['idle','active','verifying','released']
                  : ['idle','active','disputed','deliberating','resolved']).indexOf(phase) >=
                  (isHappyPath
                  ? ['idle','active','verifying','released']
                  : ['idle','active','disputed','deliberating','resolved']).indexOf(p);
                return (
                  <div key={p} className="flex items-center gap-1.5">
                    <div className={`w-1 h-1 rounded-full shrink-0 ${phase === p ? 'bg-cyan-400 animate-pulse' : isDone ? 'bg-zinc-500' : 'bg-zinc-800'}`} />
                    <span className={`text-[9px] capitalize ${phase === p ? PHASE_COLOR[p] : isDone ? 'text-zinc-600' : 'text-zinc-800'}`}>
                      {p}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-zinc-900" />

          {/* Court cases count */}
          {courtCases.length > 0 && (
            <div>
              <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-zinc-700 mb-2">Court Cases</p>
              {courtCases.slice(0, 3).map(c => {
                const vs = c.verdict ? VERDICT_STYLES[c.verdict] : null;
                return (
                  <div key={c.id} className="mb-2 rounded-lg border border-zinc-900 bg-zinc-950/50 p-2">
                    <p className="text-[8px] font-mono text-zinc-700 truncate mb-1">{c.escrowId.slice(0, 16)}…</p>
                    {vs ? (
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${vs.cls}`}>{vs.label}</span>
                    ) : (
                      <span className="text-[8px] text-violet-400 animate-pulse">deliberating…</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </aside>
      </div>

      {/* ── Bottom event ticker ── */}
      <EventTicker events={events} />
    </div>
  );
}
