'use client';

import { useEffect, useState } from 'react';

interface AgentProfile {
  id: string;
  walletAddress: string;
  name: string;
  pricingUsdc: string;
  capabilities: string[];
  slaUptimePct: number;
  reputationScore?: number;
  active: boolean;
}

export function AgentLeaderboard() {
  const [agents, setAgents] = useState<AgentProfile[]>([]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const fetch_ = () =>
      fetch(`${apiUrl}/api/agents/leaderboard?limit=10`)
        .then(r => r.json())
        .then(d => Array.isArray(d) && setAgents(d))
        .catch(() => {});
    fetch_();
    const iv = setInterval(fetch_, 30_000);
    return () => clearInterval(iv);
  }, []);

  if (agents.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-8 text-center">
        <p className="text-zinc-600 text-sm">No agents registered yet</p>
        <p className="text-zinc-700 text-xs mt-1">Run <code className="bg-zinc-800 px-1 rounded">node demo.js</code> to register agents</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/50 overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-900 text-zinc-600 uppercase tracking-widest text-[10px]">
            <th className="text-left px-4 py-3 font-semibold">#</th>
            <th className="text-left px-4 py-3 font-semibold">Agent</th>
            <th className="text-right px-4 py-3 font-semibold">Score</th>
            <th className="text-right px-4 py-3 font-semibold">Price</th>
            <th className="text-right px-4 py-3 font-semibold hidden md:table-cell">SLA</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a, i) => (
            <tr
              key={a.id}
              className="border-b border-zinc-900/50 hover:bg-zinc-900/30 transition-colors"
            >
              <td className="px-4 py-3 text-zinc-600 font-mono">{i + 1}</td>
              <td className="px-4 py-3">
                <div>
                  <p className="font-semibold text-white">{a.name}</p>
                  <p className="font-mono text-zinc-600 text-[10px]">{a.walletAddress.slice(0,6)}&hellip;{a.walletAddress.slice(-4)}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {a.capabilities.slice(0, 3).map(c => (
                      <span key={c} className="text-[9px] bg-zinc-800 text-zinc-500 rounded px-1.5 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <span className={`font-bold ${
                  (a.reputationScore ?? 0) > 80 ? 'text-green-400' :
                  (a.reputationScore ?? 0) > 50 ? 'text-yellow-400' :
                  'text-zinc-500'
                }`}>
                  {a.reputationScore ?? '—'}
                </span>
              </td>
              <td className="px-4 py-3 text-right text-violet-400 font-bold">
                ${parseFloat(a.pricingUsdc).toFixed(2)}
              </td>
              <td className="px-4 py-3 text-right hidden md:table-cell text-zinc-500">
                {a.slaUptimePct}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
