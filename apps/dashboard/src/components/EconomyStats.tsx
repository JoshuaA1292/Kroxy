'use client';

import { useEffect, useState } from 'react';

interface Stats {
  totalUsdcInEscrow: string;
  activeEscrowCount: number;
  settled24h: string;
  settled24hCount: number;
  activeJobs: number;
  activeDisputes: number;
  activeCases: number;
  asOf: string;
}

function formatUsdc(raw: string): string {
  const micro = BigInt(raw || '0');
  return (Number(micro) / 1_000_000).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function MetricCard({
  label,
  value,
  sub,
  color = 'white',
  pulse = false,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  pulse?: boolean;
}) {
  const colorClass =
    color === 'green'  ? 'text-green-400'  :
    color === 'cyan'   ? 'text-cyan-400'   :
    color === 'violet' ? 'text-violet-400' :
    color === 'yellow' ? 'text-yellow-400' :
    color === 'red'    ? 'text-red-400'    :
    'text-white';

  return (
    <div className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-5 relative overflow-hidden group hover:border-zinc-700 transition-colors">
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
        color === 'green' ? 'bg-green-950/20' :
        color === 'cyan'  ? 'bg-cyan-950/20'  :
        color === 'violet'? 'bg-violet-950/20':
        ''
      }`} />
      <p className="text-[11px] text-zinc-500 uppercase tracking-widest font-semibold">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${colorClass} ${pulse ? 'animate-pulse' : ''}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-600 mt-1">{sub}</p>}
    </div>
  );
}

export function EconomyStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
    const fetchStats = () =>
      fetch(`${apiUrl}/api/stats`)
        .then(r => r.json())
        .then(s => { setStats(s); setLastUpdate(new Date()); })
        .catch(() => {});
    fetchStats();
    const iv = setInterval(fetchStats, 10_000);
    return () => clearInterval(iv);
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-900 bg-zinc-950/50 p-5 animate-pulse">
            <div className="h-3 bg-zinc-800 rounded w-2/3 mb-3" />
            <div className="h-7 bg-zinc-800 rounded w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <MetricCard
          label="USDC in Escrow"
          value={formatUsdc(stats.totalUsdcInEscrow)}
          sub={`${stats.activeEscrowCount} active escrow${stats.activeEscrowCount !== 1 ? 's' : ''}`}
          color="cyan"
        />
        <MetricCard
          label="Settled (24h)"
          value={formatUsdc(stats.settled24h)}
          sub={`${stats.settled24hCount ?? 0} transactions`}
          color="green"
        />
        <MetricCard
          label="Active Jobs"
          value={stats.activeJobs}
          color="violet"
        />
        <MetricCard
          label="Active Disputes"
          value={stats.activeDisputes}
          color={stats.activeDisputes > 0 ? 'yellow' : 'white'}
          pulse={stats.activeDisputes > 0}
        />
        <MetricCard
          label="Court Cases"
          value={stats.activeCases}
          color={stats.activeCases > 0 ? 'red' : 'white'}
          pulse={stats.activeCases > 0}
        />
      </div>
      {lastUpdate && (
        <p className="text-[11px] text-zinc-700 text-right">
          Updated {lastUpdate.toLocaleTimeString()} · auto-refreshes every 10s
        </p>
      )}
    </div>
  );
}
