'use client';

import type { EscrowRecordDTO } from '@kroxy/types';
import { useEffect, useState } from 'react';

function ExpiryCountdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const s = Math.floor(diff / 1000);
      setRemaining(`${s}s`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span className="font-mono text-xs font-medium text-amber-600">{remaining}</span>;
}

const STATE_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string; border: string }> = {
  ACTIVE:   { label: 'Active',   dot: 'bg-blue-500',  bg: 'bg-blue-50',  text: 'text-blue-700',  border: 'border-blue-200' },
  RELEASED: { label: 'Released', dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
  REFUNDED: { label: 'Refunded', dot: 'bg-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  DISPUTED: { label: 'Disputed', dot: 'bg-red-500',   bg: 'bg-red-50',   text: 'text-red-700',   border: 'border-red-200' },
};

export function EscrowStatus({ escrow }: { escrow: EscrowRecordDTO | null }) {
  if (!escrow) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-card p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Escrow</p>
        <p className="text-gray-400 text-sm">Waiting for escrow...</p>
      </div>
    );
  }

  const cfg = STATE_CONFIG[escrow.state] ?? STATE_CONFIG['ACTIVE'];
  const amountUsdc = (Number(BigInt(escrow.amountUsdc)) / 1_000_000).toFixed(2);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card p-4 space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Escrow</p>
        <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>

      <div className="animate-fade-in-up">
        <span className="text-3xl font-bold text-gray-900 tracking-tight">${amountUsdc}</span>
        <span className="text-gray-400 text-sm font-medium ml-1.5">USDC</span>
      </div>

      <div className="space-y-2.5 pt-3 border-t border-gray-100">
        <Row label="Payer" value={`${escrow.payerAddress.slice(0,6)}\u2026${escrow.payerAddress.slice(-4)}`} mono />
        <Row label="Payee" value={`${escrow.payeeAddress.slice(0,6)}\u2026${escrow.payeeAddress.slice(-4)}`} mono />
        {escrow.state === 'ACTIVE' && escrow.expiresAt && (
          <Row label="Expires" value={<ExpiryCountdown expiresAt={escrow.expiresAt} />} />
        )}
        {escrow.txHashCreated && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Create TX</span>
            <a href={`https://basescan.org/tx/${escrow.txHashCreated}`} target="_blank" rel="noreferrer"
              className="text-xs font-mono text-blue-600 hover:text-blue-800 transition-colors font-medium">
              {escrow.txHashCreated.slice(0,8)}&hellip;&uarr;
            </a>
          </div>
        )}
        {escrow.txHashSettled && (
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">Settle TX</span>
            <a href={`https://basescan.org/tx/${escrow.txHashSettled}`} target="_blank" rel="noreferrer"
              className={`text-xs font-mono font-medium hover:opacity-70 transition-opacity ${escrow.state === 'RELEASED' ? 'text-green-600' : 'text-red-600'}`}>
              {escrow.txHashSettled.slice(0,8)}&hellip;&uarr;
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-gray-400">{label}</span>
      <span className={`text-xs text-gray-700 font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}
