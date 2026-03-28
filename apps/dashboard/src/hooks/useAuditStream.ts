'use client';

import { useEffect, useState } from 'react';
import type { AuditEventDTO } from '@kroxy/types';

export function useAuditStream(escrowId?: string) {
  const [events, setEvents] = useState<AuditEventDTO[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const url = escrowId
      ? `/api/events?escrowId=${encodeURIComponent(escrowId)}`
      : '/api/events';

    const es = new EventSource(url);

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (e: MessageEvent<string>) => {
      try {
        const event = JSON.parse(e.data) as AuditEventDTO;
        setEvents((prev) => [...prev, event]);
      } catch {
        // Ignore non-JSON messages (e.g. heartbeats)
      }
    };

    return () => {
      es.close();
      setConnected(false);
    };
  }, [escrowId]);

  return { events, connected };
}
