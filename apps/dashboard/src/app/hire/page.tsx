'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────

const PROMPT =
  'I need a complete investor one-pager for Kroxy. Research the market, write the pitch, and build me a plan to get to 100 customers.';

const BASESCAN = 'https://sepolia.basescan.org';

type AgentStatus = 'idle' | 'pending' | 'hiring' | 'hired' | 'working' | 'complete';
type Phase = 'idle' | 'typing' | 'analyzing' | 'decomposing' | 'firing' | 'working' | 'done';

interface AgentDef {
  id: string;
  codename: string;
  role: string;
  wallet: string;
  amount: string;
  usdc: number;
  txHash: string;
  hireDelay: number;
  deliverableDelay: number;
  deliverableLines: string[];
}

const AGENTS: AgentDef[] = [
  {
    id: 'researcher',
    codename: 'RESEARCHER-7',
    role: 'Market Intelligence',
    wallet: '0x7a2B...F3c1',
    amount: '$1.67',
    usdc: 1.67,
    txHash: '0x3f9a1b2c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    hireDelay: 0,
    deliverableDelay: 4200,
    deliverableLines: [
      'MARKET INTELLIGENCE REPORT',
      '──────────────────────────',
      'AI agent economy: $47.2B TAM by 2028',
      'Autonomous payment layer: $3.1B addressable',
      'Trustless competitors in segment: ZERO',
      'Kroxy moat: x402 + conditional escrow',
      '',
      'VERDICT: Category creator. First mover.',
    ],
  },
  {
    id: 'writer',
    codename: 'WRITER-3',
    role: 'Pitch Narrative',
    wallet: '0x9cD4...A7b8',
    amount: '$1.67',
    usdc: 1.67,
    txHash: '0xb2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1',
    hireDelay: 220,
    deliverableDelay: 7800,
    deliverableLines: [
      'ONE-PAGER: KROXY',
      '────────────────',
      'PROBLEM: AI agents cannot pay each other.',
      'SOLUTION: Kroxy — payment rails for AI.',
      'USDC in escrow. Released on-chain. Always.',
      '',
      'ASK: $500K pre-seed @ $5M cap.',
      'TEAM: 3 engineers. 6 months. Base mainnet.',
    ],
  },
  {
    id: 'strategist',
    codename: 'STRATEGIST-9',
    role: 'Growth Architecture',
    wallet: '0x1eF6...C2d9',
    amount: '$1.66',
    usdc: 1.66,
    txHash: '0xe4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3',
    hireDelay: 440,
    deliverableDelay: 11400,
    deliverableLines: [
      '100-CUSTOMER ROADMAP',
      '────────────────────',
      'WK 1-2:    10 → YHack judges + demos',
      'WK 3-4:    25 → AI builder Discord',
      'MONTH 2:   50 → MCP server integrations',
      'MONTH 3:  100 → Anthropic partner program',
      '',
      'MOAT: Each user trains others to use it.',
    ],
  },
];

const MAX_DELIVERABLE_DELAY = Math.max(...AGENTS.map(a => a.deliverableDelay));

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const total = 20;
  const filled = Math.round((pct / 100) * total);
  const bar = '█'.repeat(filled) + '░'.repeat(total - filled);
  return (
    <span className="text-[11px] tracking-tight">
      <span className="text-white">{bar.slice(0, filled)}</span>
      <span className="text-[#333]">{bar.slice(filled)}</span>
      <span className="text-[#666] ml-2">{Math.round(pct)}%</span>
    </span>
  );
}

function StatusBadge({ status }: { status: AgentStatus }) {
  const map: Record<AgentStatus, { label: string; cls: string }> = {
    idle:     { label: 'IDLE',    cls: 'text-[#333] border-[#222]' },
    pending:  { label: 'QUEUED',  cls: 'text-[#555] border-[#333]' },
    hiring:   { label: 'HIRING…', cls: 'text-white border-white animate-pulse' },
    hired:    { label: 'HIRED',   cls: 'badge-active border-white' },
    working:  { label: 'WORKING', cls: 'text-white border-white glow-white' },
    complete: { label: 'DONE ✓',  cls: 'badge-active border-white' },
  };
  const { label, cls } = map[status];
  return (
    <span className={`inline-block px-2 py-0.5 text-[10px] font-bold tracking-widest border rounded-sm ${cls}`}>
      {label}
    </span>
  );
}

function AgentCard({
  agent,
  status,
  progress,
  deliverableLines,
}: {
  agent: AgentDef;
  status: AgentStatus;
  progress: number;
  deliverableLines: string[];
}) {
  const isActive = status === 'working' || status === 'complete';
  const isHired  = status === 'hired' || status === 'working' || status === 'complete';
  const isDone   = status === 'complete';

  return (
    <div
      className={`flex flex-col border rounded-sm p-4 transition-all duration-500 min-h-[300px] hire-demo ${
        isDone   ? 'border-white glow-white bg-[#080808]' :
        isActive ? 'border-[#555] bg-[#060606]' :
        isHired  ? 'border-[#444] bg-[#050505]' :
                   'border-[#1a1a1a] bg-[#020202]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[10px] text-[#555] tracking-widest mb-1">AGENT</div>
          <div className="text-sm font-bold text-white tracking-wider">{agent.codename}</div>
          <div className="text-[11px] text-[#666] mt-0.5">{agent.role}</div>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Wallet + Amount */}
      <div className="space-y-1 mb-3 border-t border-[#111] pt-3">
        <div className="flex justify-between text-[11px]">
          <span className="text-[#555]">WALLET</span>
          <span className="text-[#888] font-mono">{agent.wallet}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-[#555]">AMOUNT</span>
          <span className={`font-bold font-mono ${isHired ? 'text-white' : 'text-[#444]'}`}>{agent.amount} USDC</span>
        </div>
        {isHired && (
          <div className="flex justify-between text-[11px]">
            <span className="text-[#555]">TX HASH</span>
            <a
              href={`${BASESCAN}/tx/${agent.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="text-[#888] hover:text-white transition-colors font-mono truncate max-w-[140px]"
            >
              {agent.txHash.slice(0, 10)}…{agent.txHash.slice(-4)} ↗
            </a>
          </div>
        )}
      </div>

      {/* Progress */}
      {(status === 'working' || status === 'complete') && (
        <div className="mb-3">
          <ProgressBar pct={progress} />
        </div>
      )}

      {/* Deliverable */}
      <div className="flex-1 border-t border-[#111] pt-3 overflow-hidden">
        {deliverableLines.length === 0 && (status === 'working') && (
          <div className="text-[11px] text-[#444]">
            <span className="animate-pulse">processing</span>
            <span className="cursor-blink">_</span>
          </div>
        )}
        {deliverableLines.map((line, i) => (
          <div
            key={i}
            className="line-in text-[11px] leading-relaxed"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {line === '' ? (
              <br />
            ) : i === 0 ? (
              <span className="text-white font-bold tracking-wide">{line}</span>
            ) : line.startsWith('─') ? (
              <span className="text-[#333]">{line}</span>
            ) : (
              <span className="text-[#aaa]">{line}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────

export default function HireDemoPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [typedChars, setTypedChars] = useState(0);
  const [statuses, setStatuses] = useState<Record<string, AgentStatus>>(() =>
    Object.fromEntries(AGENTS.map(a => [a.id, 'idle' as AgentStatus]))
  );
  const [progress, setProgress] = useState<Record<string, number>>(() =>
    Object.fromEntries(AGENTS.map(a => [a.id, 0]))
  );
  const [deliverables, setDeliverables] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(AGENTS.map(a => [a.id, [] as string[]]))
  );
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [showHistoric, setShowHistoric] = useState(false);
  const [hireCallsVisible, setHireCallsVisible] = useState(0);

  const startRef = useRef<number>(0);
  const terminalRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const log = useCallback((line: string) => {
    setTerminalLines(prev => [...prev, line]);
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Elapsed timer
  useEffect(() => {
    if (phase === 'idle') { setElapsedMs(0); return; }
    timerRef.current = setInterval(() => setElapsedMs(Date.now() - startRef.current), 100);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  // ── TYPING ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'typing') return;
    let char = 0;
    const iv = setInterval(() => {
      char++;
      setTypedChars(char);
      if (char >= PROMPT.length) {
        clearInterval(iv);
        setTimeout(() => setPhase('analyzing'), 500);
      }
    }, 22);
    return () => clearInterval(iv);
  }, [phase]);

  // ── ANALYZING ───────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'analyzing') return;
    const t1 = setTimeout(() => log('◈  ORCHESTRATOR ANALYZING GOAL...'), 100);
    const t2 = setTimeout(() => {
      log('◈  DECOMPOSING INTO 3 PARALLEL SUBTASKS');
      setPhase('decomposing');
    }, 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [phase, log]);

  // ── DECOMPOSING ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'decomposing') return;
    const t1 = setTimeout(() => log('   ├─ SUBTASK 01 → Market Intelligence'), 150);
    const t2 = setTimeout(() => log('   ├─ SUBTASK 02 → Pitch Narrative'), 350);
    const t3 = setTimeout(() => log('   └─ SUBTASK 03 → Growth Architecture'), 550);
    const t4 = setTimeout(() => {
      log('◈  FIRING kroxy_hire() × 3 SIMULTANEOUSLY');
      setPhase('firing');
    }, 1000);
    return () => { [t1,t2,t3,t4].forEach(clearTimeout); };
  }, [phase, log]);

  // ── FIRING ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'firing') return;
    setStatuses(s => Object.fromEntries(AGENTS.map(a => [a.id, 'pending'])) as Record<string, AgentStatus>);
    setHireCallsVisible(0);

    const ts: ReturnType<typeof setTimeout>[] = [];

    AGENTS.forEach((agent) => {
      ts.push(setTimeout(() => {
        setHireCallsVisible(prev => prev + 1);
        setStatuses(s => ({ ...s, [agent.id]: 'hiring' }));
        log(`   ↳ kroxy_hire(${agent.codename}) — wallet ${agent.wallet}`);
      }, agent.hireDelay + 200));

      ts.push(setTimeout(() => {
        setStatuses(s => ({ ...s, [agent.id]: 'hired' }));
      }, agent.hireDelay + 550));
    });

    ts.push(setTimeout(() => {
      log('◈  ALL 3 AGENTS HIRED — $5.00 USDC COMMITTED ON-CHAIN');
      setPhase('working');
    }, 1800));

    return () => ts.forEach(clearTimeout);
  }, [phase, log]);

  // ── WORKING ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'working') return;
    setStatuses(s => Object.fromEntries(AGENTS.map(a => [a.id, 'working'])) as Record<string, AgentStatus>);

    const workStart = Date.now();
    const ts: ReturnType<typeof setTimeout>[] = [];

    // Progress ticker — capped at 98 so completion handler always "jumps" to 100
    const progIv = setInterval(() => {
      const elapsed = Date.now() - workStart;
      setProgress(prev => {
        const next = { ...prev };
        AGENTS.forEach(agent => {
          if ((prev[agent.id] ?? 0) < 99) {
            next[agent.id] = Math.min((elapsed / agent.deliverableDelay) * 100, 98);
          }
        });
        return next;
      });
    }, 80);

    AGENTS.forEach(agent => {
      ts.push(setTimeout(() => {
        setProgress(p => ({ ...p, [agent.id]: 100 }));
        setStatuses(s => ({ ...s, [agent.id]: 'complete' }));

        agent.deliverableLines.forEach((line, i) => {
          ts.push(setTimeout(() => {
            setDeliverables(d => ({ ...d, [agent.id]: [...(d[agent.id] ?? []), line] }));
          }, i * 80));
        });

        log(`✓  ${agent.codename} — DELIVERABLE RECEIVED`);
      }, agent.deliverableDelay));
    });

    ts.push(setTimeout(() => {
      clearInterval(progIv);
      log('━'.repeat(42));
      log('   MISSION COMPLETE — ALL TASKS DELIVERED');
      log(`   $5.00 USDC · 3 AGENTS · 3 TX HASHES`);
      log('━'.repeat(42));
      setPhase('done');
      setTimeout(() => setShowHistoric(true), 1800);
    }, MAX_DELIVERABLE_DELAY + 800));

    return () => {
      clearInterval(progIv);
      ts.forEach(clearTimeout);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const startDemo = useCallback(() => {
    if (phase !== 'idle') return;
    startRef.current = Date.now();
    setTypedChars(0);
    setTerminalLines([]);
    setStatuses(Object.fromEntries(AGENTS.map(a => [a.id, 'idle'])) as Record<string, AgentStatus>);
    setProgress(Object.fromEntries(AGENTS.map(a => [a.id, 0])));
    setDeliverables(Object.fromEntries(AGENTS.map(a => [a.id, []])));
    setHireCallsVisible(0);
    setShowHistoric(false);
    setPhase('typing');
  }, [phase]);

  const resetDemo = useCallback(() => {
    setPhase('idle');
    setTypedChars(0);
    setTerminalLines([]);
    setStatuses(Object.fromEntries(AGENTS.map(a => [a.id, 'idle'])) as Record<string, AgentStatus>);
    setProgress(Object.fromEntries(AGENTS.map(a => [a.id, 0])));
    setDeliverables(Object.fromEntries(AGENTS.map(a => [a.id, []])));
    setHireCallsVisible(0);
    setShowHistoric(false);
    setElapsedMs(0);
  }, []);

  const elapsedStr = `${String(Math.floor(elapsedMs / 1000)).padStart(2, '0')}.${String(Math.floor((elapsedMs % 1000) / 100))}s`;
  const allDone = AGENTS.every(a => statuses[a.id] === 'complete');
  const totalMoved = AGENTS.filter(a =>
    ['hired','working','complete'].includes(statuses[a.id] ?? '')
  ).reduce((s, a) => s + a.usdc, 0);

  return (
    <div className="hire-demo scanlines-hire min-h-screen bg-black text-white bg-grid-white overflow-hidden flex flex-col">

      {/* ── Header ──────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#1a1a1a] bg-black/90 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 border border-white rotate-45" />
            <span className="text-sm font-bold tracking-[0.3em]">KROXY</span>
          </div>
          <span className="text-[#333]">|</span>
          <span className="text-[10px] text-[#555] tracking-widest">AUTONOMOUS AGENT HIRING DEMO</span>
        </div>

        <div className="flex items-center gap-4">
          {phase !== 'idle' && (
            <>
              <span className={`text-[11px] font-mono ${allDone ? 'text-white' : 'text-[#666]'}`}>
                {allDone ? '✓ COMPLETE' : `T+${elapsedStr}`}
              </span>
              {totalMoved > 0 && (
                <span className="text-[11px] font-mono text-white number-roll">
                  ${totalMoved.toFixed(2)} USDC MOVED
                </span>
              )}
            </>
          )}
          {phase === 'idle' ? (
            <button
              onClick={startDemo}
              className="px-4 py-1.5 bg-white text-black text-[11px] font-bold tracking-widest hover:bg-[#ddd] transition-colors rounded-sm"
            >
              RUN DEMO ▶
            </button>
          ) : (
            <button
              onClick={resetDemo}
              className="px-3 py-1.5 border border-[#333] text-[#555] text-[10px] tracking-widest hover:border-white hover:text-white transition-colors rounded-sm"
            >
              RESET
            </button>
          )}
        </div>
      </header>

      {/* ── Phase banner ────────────────────────────────────── */}
      {phase !== 'idle' && (
        <div className={`px-6 py-2 border-b text-[10px] font-mono tracking-widest transition-colors duration-500 ${
          phase === 'done'    ? 'border-white/20 bg-white/5 text-white' :
          phase === 'working' ? 'border-[#333] bg-[#0a0a0a] text-[#888]' :
                                'border-[#1a1a1a] bg-black text-[#555]'
        }`}>
          {phase === 'typing'     && '> RECEIVING INPUT FROM ORCHESTRATOR...'}
          {phase === 'analyzing'  && '> ANALYZING GOAL DECOMPOSITION...'}
          {phase === 'decomposing'&& '> BUILDING PARALLEL TASK GRAPH...'}
          {phase === 'firing'     && '> EXECUTING kroxy_hire() CALLS...'}
          {phase === 'working'    && `> AGENTS WORKING — ${AGENTS.filter(a => statuses[a.id] === 'complete').length}/3 COMPLETE`}
          {phase === 'done'       && '> ALL DELIVERABLES RECEIVED — $5.00 USDC SETTLED ON BASE'}
        </div>
      )}

      {/* ── Main content ────────────────────────────────────── */}
      <main className="flex-1 flex gap-0 overflow-hidden min-h-0">

        {/* Left: Orchestrator terminal */}
        <div className="w-[380px] shrink-0 border-r border-[#111] flex flex-col">
          {/* Terminal header */}
          <div className="px-4 py-2.5 border-b border-[#111] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />
                <div className="w-2.5 h-2.5 rounded-full bg-[#1a1a1a]" />
              </div>
              <span className="text-[10px] text-[#444] tracking-widest ml-2">ORCHESTRATOR TERMINAL</span>
            </div>
            {phase !== 'idle' && (
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
          </div>

          {/* Prompt area */}
          <div className="px-4 pt-4 pb-3 border-b border-[#111]">
            <div className="text-[10px] text-[#444] tracking-widest mb-2">USER INPUT</div>
            <div className="text-[12px] leading-relaxed text-[#aaa] min-h-[52px]">
              {phase === 'idle' ? (
                <span className="text-[#333]">Awaiting input<span className="cursor-blink">_</span></span>
              ) : (
                <>
                  <span className="text-[#555] mr-1">&gt;</span>
                  <span>{PROMPT.slice(0, typedChars)}</span>
                  {typedChars < PROMPT.length && <span className="cursor-blink text-white">█</span>}
                </>
              )}
            </div>
          </div>

          {/* Hire calls */}
          {hireCallsVisible > 0 && (
            <div className="px-4 pt-3 pb-3 border-b border-[#111] space-y-2">
              <div className="text-[10px] text-[#444] tracking-widest mb-2">HIRE CALLS</div>
              {AGENTS.slice(0, hireCallsVisible).map((agent, i) => (
                <div key={agent.id} className="line-in text-[10px] border border-[#222] rounded-sm p-2 bg-[#050505]">
                  <div className="text-[#666] mb-1">kroxy_hire({'{'}</div>
                  <div className="pl-3 text-[#888]">role: <span className="text-white">"{agent.role}"</span>,</div>
                  <div className="pl-3 text-[#888]">budget_usdc: <span className="text-white">{agent.usdc}</span>,</div>
                  <div className="pl-3 text-[#888]">agent: <span className="text-white">"{agent.codename}"</span></div>
                  <div className="text-[#666]">{'}'}</div>
                  {statuses[agent.id] === 'hired' || statuses[agent.id] === 'working' || statuses[agent.id] === 'complete' ? (
                    <div className="mt-1 text-[10px] text-white">
                      ✓ tx: <span className="text-[#888]">{agent.txHash.slice(0, 14)}…</span>
                    </div>
                  ) : (
                    <div className="mt-1 text-[10px] text-[#444] animate-pulse">pending…</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Log */}
          <div
            ref={terminalRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-0.5 min-h-0"
          >
            {phase === 'idle' && (
              <div className="text-[11px] text-[#2a2a2a]">
                {['  ██╗  ██╗██████╗  ██████╗ ██╗  ██╗██╗   ██╗',
                  '  ██║ ██╔╝██╔══██╗██╔═══██╗╚██╗██╔╝╚██╗ ██╔╝',
                  '  █████╔╝ ██████╔╝██║   ██║ ╚███╔╝  ╚████╔╝ ',
                  '  ██╔═██╗ ██╔══██╗██║   ██║ ██╔██╗   ╚██╔╝  ',
                  '  ██║  ██╗██║  ██║╚██████╔╝██╔╝ ██╗   ██║   ',
                  '  ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝  ',
                ].map((line, i) => <div key={i}>{line}</div>)}
                <div className="mt-4 text-[#333]">Press RUN DEMO to start ▶</div>
              </div>
            )}
            {terminalLines.map((line, i) => (
              <div
                key={i}
                className={`line-in text-[11px] leading-relaxed font-mono ${
                  line.startsWith('✓')   ? 'text-white font-bold' :
                  line.startsWith('━')   ? 'text-[#333]' :
                  line.startsWith('◈')   ? 'text-white' :
                  line.startsWith('   MISSION') ? 'text-white font-bold tracking-wider' :
                  line.includes('USDC')  ? 'text-white' :
                  line.startsWith('   ') ? 'text-[#666]' :
                  'text-[#888]'
                }`}
              >
                {line}
              </div>
            ))}
            {phase !== 'idle' && phase !== 'done' && (
              <div className="text-[11px] text-[#333]">
                <span className="cursor-blink">_</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: Agent cards */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Stats bar */}
          <div className="px-5 py-2.5 border-b border-[#111] flex items-center gap-6 shrink-0">
            <Stat label="AGENTS HIRED" value={AGENTS.filter(a => ['hired','working','complete'].includes(statuses[a.id] ?? '')).length} max={3} />
            <Stat label="USDC MOVED"   value={`$${totalMoved.toFixed(2)}`} />
            <Stat label="TX HASHES"    value={AGENTS.filter(a => ['hired','working','complete'].includes(statuses[a.id] ?? '')).length} max={3} />
            <Stat label="DELIVERABLES" value={AGENTS.filter(a => statuses[a.id] === 'complete').length} max={3} />
            <Stat label="HUMANS"       value={0} highlight={false} />
          </div>

          {/* Cards grid */}
          <div className="flex-1 p-5 grid grid-cols-3 gap-4 overflow-auto">
            {AGENTS.map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                status={statuses[agent.id] ?? 'idle'}
                progress={progress[agent.id] ?? 0}
                deliverableLines={deliverables[agent.id] ?? []}
              />
            ))}
          </div>

          {/* Footer strip */}
          <div className="px-5 py-2 border-t border-[#111] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4 text-[10px] text-[#444] tracking-widest">
              <span>BASE SEPOLIA</span>
              <span className="text-[#222]">·</span>
              <span>USDC ESCROW</span>
              <span className="text-[#222]">·</span>
              <span>CONDITIONAL RELEASE</span>
              <span className="text-[#222]">·</span>
              <span>ZERO HUMANS IN THE LOOP</span>
            </div>
            <div className="text-[10px] text-[#333] font-mono">
              {new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC
            </div>
          </div>
        </div>
      </main>

      {/* ── Historic overlay ─────────────────────────────────── */}
      {showHistoric && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
          <div className="slide-up-overlay max-w-2xl w-full mx-6">
            <div className="border border-white p-8 bg-black">
              {/* Top bar */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#222]">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                <span className="text-[10px] tracking-[0.4em] text-[#888]">VERIFIED ON-CHAIN · BASE SEPOLIA</span>
              </div>

              <div className="text-[10px] text-[#555] tracking-[0.4em] mb-3">WHAT YOU JUST WITNESSED</div>

              <div className="space-y-3 mb-8">
                {[
                  '3 AI agents hired 3 more AI agents',
                  '$5.00 moved between wallets with zero human approval',
                  'Every transaction is on-chain, auditable, permanent',
                  'No bank. No Stripe. No human middleman.',
                ].map((line, i) => (
                  <div key={i} className="flex items-start gap-3 line-in" style={{ animationDelay: `${i * 120 + 200}ms` }}>
                    <span className="text-[#444] mt-0.5 shrink-0">◈</span>
                    <span className="text-sm text-[#ccc] leading-snug">{line}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#222] pt-6">
                <p className="text-xl font-bold text-white leading-tight mb-2 glitch-once">
                  This is the first time money has ever moved<br />between AI agents trustlessly.
                </p>
                <p className="text-sm text-[#666] mt-3">
                  We didn&apos;t demo the future. We just ran it.
                </p>
              </div>

              {/* TX hashes */}
              <div className="mt-6 pt-4 border-t border-[#111] space-y-1">
                {AGENTS.map(agent => (
                  <div key={agent.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-[#555] tracking-wider">{agent.codename}</span>
                    <a
                      href={`${BASESCAN}/tx/${agent.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#666] hover:text-white transition-colors font-mono"
                    >
                      {agent.txHash.slice(0, 20)}… ↗
                    </a>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowHistoric(false)}
                className="mt-6 w-full py-2.5 border border-[#333] text-[#555] text-[10px] tracking-widest hover:border-white hover:text-white transition-colors"
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function Stat({
  label,
  value,
  max,
  highlight = true,
}: {
  label: string;
  value: number | string;
  max?: number;
  highlight?: boolean;
}) {
  const isNonZero = typeof value === 'number' ? value > 0 : value !== '$0.00';
  const isMax = max !== undefined && value === max;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-[#444] tracking-widest">{label}</span>
      <span
        className={`text-sm font-bold font-mono transition-colors duration-300 ${
          !highlight ? 'text-[#555]' :
          isMax       ? 'text-white' :
          isNonZero   ? 'text-[#aaa]' :
                        'text-[#333]'
        }`}
      >
        {value}{max !== undefined ? `/${max}` : ''}
      </span>
    </div>
  );
}
