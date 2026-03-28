'use client';

import { useAuditStream } from '@/hooks/useAuditStream';
import { useEscrow } from '@/hooks/useEscrow';
import { AuditTrail } from '@/components/AuditTrail';
import { HashChainVisualizer } from '@/components/HashChainVisualizer';
import { EscrowStatus } from '@/components/EscrowStatus';
import { ReputationCard } from '@/components/ReputationCard';
import { LiveIndicator } from '@/components/LiveIndicator';
import { useState, useEffect } from 'react';

const BASESCAN = 'https://basescan.org';
const ESCROW_CONTRACT = process.env.NEXT_PUBLIC_KROXY_ESCROW_ADDRESS ?? '';
const AGENT_A = '0x31635eFbCa9E2580Ad1Ab5af208c6285fF57b736';
const AGENT_B = '0x5798E1e0609bbd18FaDD7c5F9dFfee2370a5112c';

function AgentCard({
  label,
  role,
  address,
  active,
  side,
}: {
  label: string;
  role: string;
  address: string;
  active: boolean;
  side: 'left' | 'right';
}) {
  return (
    <div className={`relative rounded-xl border p-4 transition-all duration-500 min-w-[180px] ${
      active
        ? 'border-violet-500/50 bg-violet-950/30 shadow-[0_0_20px_rgba(139,92,246,0.15)]'
        : 'border-zinc-800 bg-zinc-950/50'
    }`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full transition-all duration-300 ${active ? 'bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.8)]' : 'bg-zinc-600'}`} />
        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-sm font-bold text-white">{role}</p>
      <p className="text-[11px] font-mono text-zinc-500 mt-1">{address.slice(0, 6)}&hellip;{address.slice(-4)}</p>
      <a
        href={`${BASESCAN}/address/${address}`}
        target="_blank" rel="noreferrer"
        className="text-[10px] text-cyan-600 hover:text-cyan-400 transition-colors"
      >
        View on Basescan ↗
      </a>
    </div>
  );
}

function EscrowFlowCard({
  escrow,
  conditionChecks,
  totalChecks,
}: {
  escrow: any;
  conditionChecks: any[];
  totalChecks: number;
}) {
  const state = escrow?.state;
  const pct = Math.min((conditionChecks.length / totalChecks) * 100, 100);

  const stateColor =
    state === 'RELEASED' ? 'border-green-500/50 bg-green-950/20 shadow-[0_0_30px_rgba(34,197,94,0.1)]' :
    state === 'DISPUTED' ? 'border-red-500/50 bg-red-950/20 shadow-[0_0_30px_rgba(239,68,68,0.1)]' :
    state === 'ACTIVE'   ? 'border-cyan-500/50 bg-cyan-950/20 shadow-[0_0_30px_rgba(6,182,212,0.1)]' :
    'border-zinc-800 bg-zinc-950/50';

  return (
    <div className={`rounded-xl border p-4 transition-all duration-700 text-center min-w-[200px] ${stateColor}`}>
      <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">Escrow Contract</p>
      <p className="text-xs font-mono text-zinc-400 mb-3">{ESCROW_CONTRACT.slice(0, 6)}&hellip;{ESCROW_CONTRACT.slice(-4)}</p>

      {state === 'ACTIVE' && (
        <>
          <div className="text-2xl font-bold text-cyan-400 mb-1">$2.50</div>
          <div className="text-xs text-zinc-500 mb-3">USDC locked</div>
          <div className="w-full bg-zinc-800 rounded-full h-1.5 mb-1">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-600">{conditionChecks.length}/{totalChecks} checks</p>
        </>
      )}

      {state === 'RELEASED' && (
        <div className="text-green-400 font-bold">
          <div className="text-2xl mb-1">✓</div>
          <div className="text-sm">RELEASED</div>
          <div className="text-xs text-zinc-500 mt-1">USDC transferred</div>
        </div>
      )}

      {state === 'DISPUTED' && (
        <div className="text-red-400 font-bold">
          <div className="text-2xl mb-1">⚠</div>
          <div className="text-sm">DISPUTED</div>
          <div className="text-xs text-zinc-500 mt-1">Awaiting arbitration</div>
        </div>
      )}

      {!state && (
        <div className="text-zinc-600 text-xs">Awaiting escrow…</div>
      )}
    </div>
  );
}

function FlowArrow({ direction, active, amount }: { direction: 'right' | 'left'; active: boolean; amount?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 px-2">
      {amount && <span className="text-xs font-bold text-violet-400">{amount}</span>}
      <div className={`flex items-center gap-1 ${active ? 'text-cyan-400' : 'text-zinc-700'}`}>
        {direction === 'left' && <span className="text-lg">←</span>}
        <div className={`h-px w-16 md:w-24 transition-all duration-300 ${active ? 'bg-gradient-to-r from-cyan-500 to-violet-500' : 'bg-zinc-800'}`} />
        {direction === 'right' && <span className="text-lg">→</span>}
      </div>
      {active && (
        <div className="flex gap-1">
          {[0,1,2].map(i => (
            <div
              key={i}
              className="w-1 h-1 rounded-full bg-cyan-400 animate-ping"
              style={{ animationDelay: `${i * 200}ms`, animationDuration: '1.5s' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DemoPage() {
  const [escrowId, setEscrowId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [now, setNow] = useState(new Date());

  const { events, connected } = useAuditStream(escrowId ?? undefined);
  const { escrow } = useEscrow(escrowId);

  useEffect(() => {
    if (!escrowId && events.length > 0) {
      setEscrowId(events[0].escrowId);
      setInputValue(events[0].escrowId);
    }
  }, [events, escrowId]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const conditionChecks = events.filter(e => e.eventType === 'CONDITION_CHECKED');
  const totalChecks = 6;
  const isActive = escrow?.state === 'ACTIVE';
  const isReleased = escrow?.state === 'RELEASED';
  const isDisputed = escrow?.state === 'DISPUTED';
  const isDone = isReleased || isDisputed;

  return (
    <div className="min-h-screen bg-[#07070f] text-white">
      {/* State banner */}
      <div className={`px-6 py-2.5 flex items-center gap-3 border-b text-xs font-medium transition-all duration-700 ${
        isReleased ? 'bg-green-950/50 border-green-800/50 text-green-400' :
        isDisputed ? 'bg-red-950/50 border-red-800/50 text-red-400' :
        isActive   ? 'bg-cyan-950/50 border-cyan-800/50 text-cyan-400' :
        'bg-zinc-950 border-zinc-800/50 text-zinc-600'
      }`}>
        {isReleased && <><span className="font-bold text-green-400">✓</span><span>Payment released — $2.50 USDC transferred to Agent B</span></>}
        {isDisputed && <><span className="font-bold text-red-400">⚠</span><span>Dispute raised — conditions failed · Awaiting LLM arbitration</span></>}
        {isActive   && <><span className="animate-pulse text-cyan-400">●</span><span>Verifying — {conditionChecks.length}/{totalChecks} condition checks</span><div className="flex-1 max-w-32 h-1 bg-cyan-900 rounded-full overflow-hidden"><div className="h-full bg-cyan-400 rounded-full transition-all duration-700" style={{ width: `${Math.min((conditionChecks.length / totalChecks) * 100, 100)}%` }} /></div></>}
        {!escrow    && <span>Run <code className="bg-zinc-800 px-1 rounded text-zinc-300">node demo.js</code> to start</span>}
        {escrowId && <span className="ml-auto font-mono text-[11px] opacity-40 hidden lg:block">{escrowId.slice(0,24)}&hellip;</span>}
        <div className="ml-auto flex items-center gap-2">
          <LiveIndicator connected={connected} />
          <span className="font-mono text-zinc-600 hidden md:block">{now.toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Agent flow visualization */}
      <div className="border-b border-zinc-900 bg-[#08081a] px-6 py-6">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 flex-wrap">
          <AgentCard
            label="Agent A"
            role="Buyer / Payer"
            address={AGENT_A}
            active={isActive || !escrow}
            side="left"
          />
          <FlowArrow direction="right" active={isActive} amount={isActive ? '$2.50 USDC' : undefined} />
          <EscrowFlowCard escrow={escrow} conditionChecks={conditionChecks} totalChecks={totalChecks} />
          <FlowArrow direction="right" active={isReleased} amount={isReleased ? '$2.50 USDC' : undefined} />
          <AgentCard
            label="Agent B"
            role="Seller / Payee"
            address={AGENT_B}
            active={isReleased}
            side="right"
          />
        </div>

        {/* Escrow ID input */}
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-600 font-mono">Escrow ID:</span>
            <input
              type="text"
              placeholder="0x… or leave empty for latest"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={() => setEscrowId(inputValue.trim() || null)}
              onKeyDown={e => { if (e.key === 'Enter') setEscrowId(inputValue.trim() || null); }}
              className="w-80 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-700 outline-none focus:border-zinc-600 transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      {/* Settlement banner */}
      {isDone && escrow?.txHashSettled && (
        <div className={`px-6 py-3 flex items-center justify-between border-b ${
          isReleased ? 'border-green-800/30 bg-green-950/20' : 'border-red-800/30 bg-red-950/20'
        }`}>
          <span className={`text-sm font-bold ${isReleased ? 'text-green-400' : 'text-red-400'}`}>
            {isReleased ? '✓ Settlement confirmed on-chain' : '⚠ Dispute raised on-chain'}
          </span>
          <a
            href={`${BASESCAN}/tx/${escrow.txHashSettled}`}
            target="_blank" rel="noreferrer"
            className="text-xs font-mono text-cyan-500 hover:text-cyan-300 transition-colors"
          >
            {escrow.txHashSettled.slice(0, 18)}&hellip; ↗
          </a>
        </div>
      )}

      {/* 3-column layout */}
      <main className="grid grid-cols-[260px_1fr_240px] h-[calc(100vh-52px-88px-56px)] overflow-hidden">

        {/* Left panel */}
        <aside className="border-r border-zinc-900 overflow-y-auto p-4 space-y-3 bg-[#07070f]">
          <EscrowStatus escrow={escrow ?? null} />
          <ReputationCard address={escrow?.payeeAddress ?? null} />

          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-3">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest">Contracts</p>
            <a href={`${BASESCAN}/address/${ESCROW_CONTRACT}`} target="_blank" rel="noreferrer"
              className="flex justify-between items-center text-xs text-zinc-500 hover:text-cyan-400 transition-colors group">
              <span>KroxyEscrow</span>
              <span className="font-mono">{ESCROW_CONTRACT.slice(0, 6)}&hellip;{ESCROW_CONTRACT.slice(-4)} ↗</span>
            </a>
          </div>

          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-2">
            <p className="text-[11px] font-semibold text-zinc-600 uppercase tracking-widest mb-2">Event legend</p>
            {[
              { type: 'CONTRACT_CREATED', dot: 'bg-blue-500' },
              { type: 'ESCROW_LOCKED', dot: 'bg-blue-400' },
              { type: 'CONDITION_CHECKED', dot: 'bg-amber-500' },
              { type: 'PAYMENT_RELEASED', dot: 'bg-green-500' },
              { type: 'DISPUTE_RAISED', dot: 'bg-red-500' },
              { type: 'CASE_OPENED', dot: 'bg-violet-500' },
              { type: 'JUDGE_REVEALED', dot: 'bg-cyan-500' },
              { type: 'CONSENSUS_REACHED', dot: 'bg-pink-500' },
            ].map(({ type, dot }) => (
              <div key={type} className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dot}`} />
                <span className="text-[10px] font-mono text-zinc-600">{type}</span>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Audit trail */}
        <section className="overflow-y-auto border-r border-zinc-900 bg-[#07070f]">
          <div className="p-5">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-bold text-white">Audit Trail</h2>
              <span className="text-zinc-600 text-xs font-mono">{events.length} events</span>
            </div>
            <AuditTrail events={events} connected={connected} />
          </div>
        </section>

        {/* Right: Hash chain */}
        <aside className="overflow-y-auto bg-[#07070f] border-l border-zinc-900/50">
          <div className="p-4">
            <h2 className="text-sm font-bold text-white mb-4">Hash Chain</h2>
            <HashChainVisualizer events={events} />
          </div>
        </aside>
      </main>
    </div>
  );
}
