import { CourtVerdictFeed } from '../../../components/CourtVerdictFeed';
import Link from 'next/link';

export default function CourtPage() {
  return (
    <main className="min-h-screen bg-[#07070f] text-white p-6">
      <div className="border-b border-zinc-900 pb-6 mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
          <h1 className="text-2xl font-bold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
            Arbitration Court
          </h1>
        </div>
        <p className="text-zinc-500 text-sm">
          3 independent Gemini AI judges deliberate disputes via commit-reveal protocol
        </p>
        <div className="mt-4 flex items-center gap-3 text-xs text-zinc-600">
          <span className="rounded-full border border-zinc-800 px-3 py-1">Gemini 1.5 Flash × 3</span>
          <span className="rounded-full border border-zinc-800 px-3 py-1">Commit-reveal</span>
          <span className="rounded-full border border-zinc-800 px-3 py-1">2/3 majority</span>
        </div>
      </div>

      <section>
        <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">
          Recent Verdicts
        </h2>
        <CourtVerdictFeed />
      </section>
    </main>
  );
}
