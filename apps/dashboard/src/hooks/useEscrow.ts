'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { EscrowRecordDTO } from '@kroxy/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

/** States that will never change again — no need to keep polling. */
const TERMINAL_STATES: ReadonlySet<string> = new Set(['RELEASED', 'REFUNDED', 'DISPUTED']);

export function useEscrow(escrowId: string | null) {
  const [escrow, setEscrow] = useState<EscrowRecordDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!escrowId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/escrows/${escrowId}`);
      if (res.ok) {
        const data = (await res.json()) as EscrowRecordDTO;
        setEscrow(data);

        // Stop polling once the escrow has reached a terminal state
        if (TERMINAL_STATES.has(data.state)) {
          stopPolling();
        }
      }
    } finally {
      setLoading(false);
    }
  }, [escrowId, stopPolling]);

  useEffect(() => {
    stopPolling(); // clear any existing interval when escrowId changes
    setEscrow(null);

    if (!escrowId) return;

    void refresh();
    intervalRef.current = setInterval(refresh, 5000);

    return stopPolling;
  }, [escrowId, refresh, stopPolling]);

  return { escrow, loading, refresh };
}
