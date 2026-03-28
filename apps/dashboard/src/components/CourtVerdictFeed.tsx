'use client';

import { useEffect, useState } from 'react';
import { useAuditStream } from '../hooks/useAuditStream';
import type { AuditEventDTO } from '@kroxy/types';

interface CourtCase {
  id: string;
  escrowId: string;
  plaintiffWallet: string;
  defendantWallet: string;
  status: string;
  verdict: string | null;
  openedAt: string;
  resolvedAt: string | null;
  judgeCommits: unknown[];
}

const VERDICT_STYLE = {
  PLAINTIFF_WINS: { bg: 'bg-red-950/40', border: 'border-red-800/50', text: 'text-red-400', label: 'Plaintiff Wins' },
  DEFENDANT_WINS: { bg: 'bg-green-950/40', border: 'border-green-800/50', text: 'text-green-400', label: 'Defendant Wins' },
  SPLIT: { bg: 'bg-amber-950/40', border: 'border-amber-800/50', text: 'text-amber-400', label: 'Split' },
};

function CaseCard({ c, latestJudgeEvents }: { c: CourtCase; latestJudgeEvents: AuditEventDTO[] }) {
  const style = c.verdict ? VERDICT_STYLE[c.verdict as keyof typeof VERDICT_STYLE] : null;
  const judges = latestJudgeEvents.filter(e => e.escrowId === c.escrowId && e.eventType === 'JUDGE_REVEALED');

  return (
    <div className={`rounded-xl border p-4 transition-all ${
      style ? `${style.bg} ${style.border}` : 'border-zinc-800 bg-zinc-950/50'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] font-mono text-zinc-600">{c.escrowId.slice(0, 20)}&hellip;</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${
              c.status === 'RESOLVED'
                ? (style ? `${style.bg} ${style.text}` : 'bg-zinc-800 text-zinc-400')
                : 'bg-violet-950/50 text-violet-400 animate-pulse'
            }`}>
              {c.status === 'RESOLVED' && style ? style.label : c.status}
            </span>
          </div>
        </div>
        {c.resolvedAt && (
          <span className="text-[10px] text-zinc-600">{new Date(c.resolvedAt).toLocaleTimeString()}</span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-500 mb-3">
        <div>
          <span className="text-zinc-700">Plaintiff</span>
          <p className="font-mono text-zinc-400">{c.plaintiffWallet.slice(0, 8)}&hellip;{c.plaintiffWallet.slice(-4)}</p>
        </div>
        <div>
          <span className="text-zinc-700">Defendant</span>
          <p className="font-mono text-zinc-400">{c.defendantWallet.slice(0, 8)}&hellip;{c.defendantWallet.slice(-4)}</p>
        </div>
      </div>

      {judges.length > 0 && (
        <div className="border-t border-zinc-800/50 pt-3 space-y-2">
          {judges.map((e, i) => {
            const d = e.rawData as Record<string, unknown>;
            const v = d.verdict as string;
            const vs = v ? VERDICT_STYLE[v as keyof typeof VERDICT_STYLE] : null;
            return (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[10px] text-cyan-600 font-mono shrink-0">{d.judge as string}</span>
                {vs && <span className={`text-[10px] font-bold ${vs.text} shrink-0`}>{vs.label}</span>}
                {!!d.reasoning && (
                  <span className="text-[10px] text-zinc-600 line-clamp-2">
                    {String(d.reasoning).slice(0, 100)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function CourtVerdictFeed() {
  const [cases, setCases] = useState<CourtCase[]>([]);
  const { events } = useAuditStream();

  const judgeRevealEvents = events.filter(e => e.eventType === 'JUDGE_REVEALED');

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const fetch_ = () =>
      fetch(`${apiUrl}/api/court/cases?limit=10`)
        .then(r => r.json())
        .then(d => Array.isArray(d) && setCases(d))
        .catch(() => {});
    fetch_();
    const iv = setInterval(fetch_, 15_000);
    return () => clearInterval(iv);
  }, []);

  // Re-fetch when new consensus event arrives
  useEffect(() => {
    const consensus = events.filter(e => e.eventType === 'CONSENSUS_REACHED');
    if (consensus.length > 0) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
      fetch(`${apiUrl}/api/court/cases?limit=10`)
        .then(r => r.json())
        .then(d => Array.isArray(d) && setCases(d))
        .catch(() => {});
    }
  }, [events]);

  if (cases.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-8 text-center">
        <p className="text-zinc-600 text-sm">No court cases yet</p>
        <p className="text-zinc-700 text-xs mt-1">Run <code className="bg-zinc-800 px-1 rounded">node demo.js</code> to trigger a dispute</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {cases.map(c => (
        <CaseCard key={c.id} c={c} latestJudgeEvents={judgeRevealEvents} />
      ))}
    </div>
  );
}
