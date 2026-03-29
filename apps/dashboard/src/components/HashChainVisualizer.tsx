'use client';

import type { AuditEventDTO } from '@kroxy/types';
import { useState } from 'react';

const GENESIS_HASH = '0'.repeat(64);

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

const SHORT: Record<string, string> = {
  CONTRACT_CREATED:   'CREATED',
  ESCROW_LOCKED:      'LOCKED',
  CONDITION_CHECKED:  'CHECK',
  PAYMENT_RELEASED:   'RELEASED',
  DISPUTE_RAISED:     'DISPUTE',
  REPUTATION_UPDATED: 'REPUTATION',
  REFUND_ISSUED:      'REFUND',
};

const DOT: Record<string, string> = {
  CONTRACT_CREATED:   'bg-blue-500',
  ESCROW_LOCKED:      'bg-blue-400',
  CONDITION_CHECKED:  'bg-amber-500',
  PAYMENT_RELEASED:   'bg-green-500',
  DISPUTE_RAISED:     'bg-red-500',
  REPUTATION_UPDATED: 'bg-violet-500',
  REFUND_ISSUED:      'bg-amber-400',
};

export function HashChainVisualizer({ events }: { events: AuditEventDTO[] }) {
  const [verifying, setVerifying] = useState(false);
  const [results, setResults] = useState<boolean[] | null>(null);
  const [summary, setSummary] = useState<{ ok: boolean; msg: string } | null>(null);

  async function verifyChain() {
    setVerifying(true);
    setResults(null);
    setSummary(null);
    const checks: boolean[] = [];
    let prev = GENESIS_HASH;
    for (const e of events) {
      const input = [prev, e.id, e.escrowId, e.eventType, e.actorAddress, JSON.stringify(e.rawData), e.createdAt].join('|');
      const computed = await sha256(input);
      checks.push(computed === e.thisHash && e.previousHash === prev);
      prev = e.thisHash ?? e.hash;
    }
    setResults(checks);
    const allOk = checks.every(Boolean);
    setSummary({ ok: allOk, msg: allOk ? `All ${checks.length} hashes valid` : `${checks.filter(v=>!v).length} invalid` });
    setVerifying(false);
  }

  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4 text-2xl">&#128279;</div>
        <p className="text-gray-500 text-sm font-medium">No chain yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400 font-mono">{events.length} block{events.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => void verifyChain()}
          disabled={verifying}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {verifying ? 'Verifying\u2026' : 'Verify all'}
        </button>
      </div>

      {summary && (
        <div className={`animate-scale-in text-xs font-mono font-semibold px-3 py-2 rounded-lg border ${
          summary.ok
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {summary.ok ? '&#10003;' : '&#10007;'} {summary.msg}
        </div>
      )}

      {/* Genesis */}
      <div className="chain-block animate-fade-in-up">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-mono">
          <div className="text-gray-400 text-[10px] font-medium mb-0.5">GENESIS</div>
          <div className="text-gray-500">{GENESIS_HASH.slice(0, 16)}&hellip;</div>
        </div>
        <div className="w-px h-2 bg-gray-200 ml-4" />
      </div>

      {/* Blocks */}
      {events.map((event, i) => {
        const ok = results?.[i];
        const borderClass = results === null
          ? 'border-gray-200'
          : ok ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50';
        const label = SHORT[event.eventType] ?? event.eventType;
        const dot = DOT[event.eventType] ?? 'bg-gray-400';

        return (
          <div key={event.id} className="chain-block animate-fade-in-up">
            <div className={`rounded-lg border ${borderClass} bg-white px-3 py-2 text-xs font-mono shadow-subtle transition-all duration-300`}>
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                  <span className="text-gray-700 font-semibold text-[11px]">{label}</span>
                </div>
                <span className={`text-[10px] font-semibold ${results === null ? 'text-gray-400' : ok ? 'text-green-600' : 'text-red-600'}`}>
                  {results === null ? `#${event.sequence}` : ok ? '\u2713 valid' : '\u2717 invalid'}
                </span>
              </div>
              <div className="text-gray-400">{(event.thisHash ?? event.hash).slice(0, 14)}&hellip;{(event.thisHash ?? event.hash).slice(-6)}</div>
            </div>
            {i < events.length - 1 && <div className="w-px h-2 bg-gray-200 ml-4" />}
          </div>
        );
      })}
    </div>
  );
}
