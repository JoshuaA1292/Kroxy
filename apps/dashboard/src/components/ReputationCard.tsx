'use client';

import { useEffect, useState } from 'react';
import type { ReputationDTO } from '@kroxy/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export function ReputationCard({ address }: { address: string | null }) {
  const [rep, setRep] = useState<ReputationDTO | null>(null);

  useEffect(() => {
    if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/reputation/${address}`);
        if (res.ok) setRep(await res.json() as ReputationDTO);
      } catch { /* ignore */ }
    };
    void load();
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [address]);

  if (!address) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-card p-4">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Reputation</p>
        <p className="text-gray-400 text-sm">No payee address</p>
      </div>
    );
  }

  const score = rep?.score ?? null;
  const scoreColor = score === null ? 'text-gray-300' : score >= 5 ? 'text-green-600' : score >= 0 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-card p-4 space-y-4 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Reputation</p>
        <span className="text-[10px] text-gray-400 font-mono">Agent B</span>
      </div>

      <div className="flex items-end gap-2">
        <span className={`text-4xl font-bold tracking-tight ${scoreColor}`}>{score ?? '\u2014'}</span>
        <div className="mb-1 text-xs text-gray-400 leading-tight">
          <div>Kroxy score</div>
          <div className="text-gray-300">S &minus; D&times;2</div>
        </div>
      </div>

      {rep && (
        <div className="space-y-2.5 pt-3 border-t border-gray-100">
          <div className="flex justify-between">
            <span className="text-xs text-gray-400">Successful</span>
            <span className="text-xs font-mono font-semibold text-green-600">{rep.successCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-400">Disputed</span>
            <span className="text-xs font-mono font-semibold text-red-600">{rep.disputeCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-xs text-gray-400">Total earned</span>
            <span className="text-xs font-mono font-semibold text-gray-700">
              ${(Number(BigInt(rep.totalEarned)) / 1_000_000).toFixed(2)} USDC
            </span>
          </div>
        </div>
      )}

      <p className="text-gray-300 font-mono text-[9px] break-all pt-1">{address}</p>
    </div>
  );
}
