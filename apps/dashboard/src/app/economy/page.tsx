import { EconomyStats } from '../../components/EconomyStats';
import { AgentLeaderboard } from '../../components/AgentLeaderboard';
import { CourtVerdictFeed } from '../../components/CourtVerdictFeed';

export default function EconomyPage() {
  return (
    <main className="min-h-screen bg-[#07070f] text-white p-6 space-y-8">
      <div className="border-b border-zinc-900 pb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
          Agent Economy
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          Live metrics for autonomous AI agent transactions on Base
        </p>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
          Economy Metrics
        </h2>
        <EconomyStats />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Agent Leaderboard
          </h2>
          <AgentLeaderboard />
        </section>
        <section>
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Court Verdicts
          </h2>
          <CourtVerdictFeed />
        </section>
      </div>
    </main>
  );
}
