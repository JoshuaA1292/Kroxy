'use client';

import type { AuditEventDTO } from '@kroxy/types';
import { useState } from 'react';

const EVENT_CONFIG: Record<string, { dot: string; badge: string; text: string; label: string }> = {
  CONTRACT_CREATED:   { dot: 'bg-blue-500',   badge: 'bg-blue-50 border-blue-200',   text: 'text-blue-700',   label: 'Contract Created'   },
  ESCROW_LOCKED:      { dot: 'bg-blue-400',   badge: 'bg-blue-50 border-blue-200',   text: 'text-blue-600',   label: 'Escrow Locked'      },
  CONDITION_CHECKED:  { dot: 'bg-amber-500',  badge: 'bg-amber-50 border-amber-200', text: 'text-amber-700',  label: 'Condition Checked'  },
  PAYMENT_RELEASED:   { dot: 'bg-green-500',  badge: 'bg-green-50 border-green-200', text: 'text-green-700',  label: 'Payment Released'   },
  DISPUTE_RAISED:     { dot: 'bg-red-500',    badge: 'bg-red-50 border-red-200',     text: 'text-red-700',    label: 'Dispute Raised'     },
  REFUND_ISSUED:      { dot: 'bg-amber-400',  badge: 'bg-amber-50 border-amber-200', text: 'text-amber-600',  label: 'Refund Issued'      },
  REPUTATION_UPDATED: { dot: 'bg-violet-500', badge: 'bg-violet-50 border-violet-200', text: 'text-violet-700', label: 'Reputation Updated' },
};

function EventRow({ event, isLast }: { event: AuditEventDTO; isLast: boolean }) {
  const [open, setOpen] = useState(false);
  const cfg = EVENT_CONFIG[event.eventType] ?? { dot: 'bg-gray-400', badge: 'bg-gray-50 border-gray-200', text: 'text-gray-600', label: event.eventType };

  const passed = event.eventType === 'CONDITION_CHECKED'
    ? (event.rawData as Record<string, unknown>).passed
    : null;

  return (
    <div className="flex gap-3 animate-slide-in-right">
      {/* Spine */}
      <div className="flex flex-col items-center shrink-0">
        <span className={`mt-1.5 h-2 w-2 rounded-full ${cfg.dot} ring-4 ring-white shrink-0`} />
        {!isLast && <span className="w-px flex-1 bg-gray-100 mt-1" />}
      </div>

      {/* Content */}
      <div className={`pb-4 flex-1 min-w-0 ${isLast ? 'pb-0' : ''}`}>
        <button onClick={() => setOpen(!open)}
          className="w-full text-left group rounded-lg hover:bg-gray-50 transition-colors p-2 -ml-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cfg.badge} ${cfg.text}`}>
              {passed === true  && <span>&#10003;</span>}
              {passed === false && <span>&#10007;</span>}
              {cfg.label}
            </span>
            <span className="text-gray-400 text-xs font-mono">#{event.sequence}</span>
            <span className="text-gray-400 text-xs ml-auto font-mono">
              {new Date(event.createdAt).toLocaleTimeString()}
            </span>
            <span className="text-gray-300 text-xs group-hover:text-gray-400 transition-colors">
              {open ? '\u2191' : '\u2193'}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-gray-400">
            <span className="text-gray-300">{event.actorRole}</span>
            <span className="text-gray-200">&middot;</span>
            <span>{event.thisHash.slice(0, 12)}&hellip;</span>
          </div>
        </button>

        {open && (
          <div className="animate-expand-down mt-1 ml-2 rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2 text-xs font-mono">
            {event.txHash && (
              <div className="flex gap-2">
                <span className="text-gray-400 shrink-0 w-10">tx</span>
                <a href={`https://basescan.org/tx/${event.txHash}`} target="_blank" rel="noreferrer"
                  className="text-blue-600 hover:text-blue-800 truncate font-medium transition-colors">
                  {event.txHash}&uarr;
                </a>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-10">prev</span>
              <span className="text-gray-500 break-all">{event.previousHash}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-400 shrink-0 w-10">hash</span>
              <span className="text-gray-700 font-semibold break-all">{event.thisHash}</span>
            </div>
            <div>
              <span className="text-gray-400">data</span>
              <pre className="text-gray-600 mt-1.5 whitespace-pre-wrap break-all leading-relaxed bg-white rounded-lg border border-gray-200 p-2">
                {JSON.stringify(event.rawData, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AuditTrail({ events, connected }: { events: AuditEventDTO[]; connected: boolean }) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <span className="text-2xl">&#9935;</span>
        </div>
        <p className="text-gray-500 text-sm font-medium">No events yet</p>
        <p className="text-gray-400 text-xs mt-1">
          {connected ? 'Run Agent A to start the demo' : 'Connecting to stream...'}
        </p>
      </div>
    );
  }

  return (
    <div>
      {events.map((event, i) => (
        <EventRow key={event.id} event={event} isLast={i === events.length - 1} />
      ))}
    </div>
  );
}
