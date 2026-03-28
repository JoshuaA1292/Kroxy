'use client';

import { useCourtCase } from '../hooks/useCourtCase';
import type { AuditEventDTO } from '@kroxy/types';

const JUDGES = ['gemini-1', 'gemini-2', 'gemini-3'] as const;

const VERDICT_STYLE: Record<string, string> = {
  PLAINTIFF_WINS: 'bg-red-900 text-red-200 border-red-700',
  DEFENDANT_WINS: 'bg-emerald-900 text-emerald-200 border-emerald-700',
  SPLIT: 'bg-amber-900 text-amber-200 border-amber-700',
};

function JudgeColumn({
  name,
  commit,
  reveal,
}: {
  name: string;
  commit: AuditEventDTO | null;
  reveal: AuditEventDTO | null;
}) {
  const revealData = reveal?.rawData as Record<string, unknown> | undefined;
  const verdict = revealData?.verdict as string | undefined;
  const confidence = revealData?.confidence as number | undefined;
  const reasoning = revealData?.reasoning as string | undefined;

  return (
    <div className="flex-1 rounded-lg border border-zinc-800 p-4 bg-zinc-950">
      <div className="text-sm font-bold text-white capitalize mb-3">{name}</div>

      {/* Commit */}
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`w-2 h-2 rounded-full ${commit ? 'bg-blue-400' : 'bg-zinc-700'}`}
        />
        <span className={`text-xs ${commit ? 'text-blue-300' : 'text-zinc-600'}`}>
          {commit ? 'Committed' : 'Waiting…'}
        </span>
      </div>

      {/* Reveal */}
      <div className="flex items-center gap-2 mb-3">
        <div
          className={`w-2 h-2 rounded-full ${reveal ? 'bg-yellow-400' : 'bg-zinc-700'}`}
        />
        <span className={`text-xs ${reveal ? 'text-yellow-300' : 'text-zinc-600'}`}>
          {reveal ? 'Revealed' : 'Pending'}
        </span>
      </div>

      {/* Verdict badge */}
      {verdict && (
        <div
          className={`rounded border px-2 py-1 text-xs font-bold text-center ${VERDICT_STYLE[verdict] ?? 'bg-zinc-800 text-zinc-300 border-zinc-700'}`}
        >
          {verdict.replace('_', ' ')}
          {confidence !== undefined && (
            <span className="ml-1 opacity-60 font-normal">{(confidence * 100).toFixed(0)}%</span>
          )}
        </div>
      )}

      {/* Reasoning */}
      {reasoning && (
        <p className="mt-2 text-xs text-zinc-500 line-clamp-3">{reasoning}</p>
      )}
    </div>
  );
}

export function ArbitrationViewer({ escrowId }: { escrowId: string }) {
  const { caseEvents, connected } = useCourtCase(escrowId);

  const getJudgeCommit = (judgeName: string) =>
    caseEvents.judgeCommits.find((e) => {
      const d = e.rawData as Record<string, unknown>;
      return d.judge === judgeName;
    }) ?? null;

  const getJudgeReveal = (judgeName: string) =>
    caseEvents.judgeReveals.find((e) => {
      const d = e.rawData as Record<string, unknown>;
      return d.judge === judgeName;
    }) ?? null;

  const consensusData = caseEvents.consensus?.rawData as Record<string, unknown> | undefined;
  const finalVerdict = consensusData?.verdict as string | undefined;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
        <span className="text-zinc-400">
          {connected ? 'Live' : 'Disconnected'}
          {caseEvents.caseOpened && ' · Case open'}
          {caseEvents.evidencePosted && ' · Evidence posted'}
          {caseEvents.judgeCommits.length > 0 && ` · ${caseEvents.judgeCommits.length}/3 committed`}
          {caseEvents.judgeReveals.length > 0 && ` · ${caseEvents.judgeReveals.length}/3 revealed`}
          {finalVerdict && ' · Resolved'}
        </span>
      </div>

      {/* Judge columns */}
      <div className="flex gap-3">
        {JUDGES.map((name) => (
          <JudgeColumn
            key={name}
            name={name}
            commit={getJudgeCommit(name)}
            reveal={getJudgeReveal(name)}
          />
        ))}
      </div>

      {/* Final verdict banner */}
      {finalVerdict && (
        <div
          className={`rounded-lg border-2 p-4 text-center text-lg font-bold ${VERDICT_STYLE[finalVerdict] ?? 'bg-zinc-800 text-white border-zinc-700'}`}
        >
          Final Verdict: {finalVerdict.replace(/_/g, ' ')}
        </div>
      )}
    </div>
  );
}
