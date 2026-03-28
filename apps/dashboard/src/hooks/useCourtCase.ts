'use client';

import { useMemo } from 'react';
import { useAuditStream } from './useAuditStream';
import type { AuditEventDTO } from '@kroxy/types';

export interface CourtCaseEvents {
  caseOpened: AuditEventDTO | null;
  evidencePosted: AuditEventDTO | null;
  judgeCommits: AuditEventDTO[];
  judgeReveals: AuditEventDTO[];
  consensus: AuditEventDTO | null;
}

export function useCourtCase(escrowId: string) {
  const { events, connected } = useAuditStream(escrowId);

  const caseEvents = useMemo<CourtCaseEvents>(() => {
    const courtEvents = events.filter((e) => e.actorRole === 'KROXY_COURT');
    return {
      caseOpened: courtEvents.find((e) => e.eventType === 'CASE_OPENED') ?? null,
      evidencePosted: courtEvents.find((e) => e.eventType === 'EVIDENCE_POSTED') ?? null,
      judgeCommits: courtEvents.filter((e) => e.eventType === 'JUDGE_COMMITTED'),
      judgeReveals: courtEvents.filter((e) => e.eventType === 'JUDGE_REVEALED'),
      consensus: courtEvents.find((e) => e.eventType === 'CONSENSUS_REACHED') ?? null,
    };
  }, [events]);

  return { caseEvents, connected };
}
