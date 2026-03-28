import { JobBoard } from '../../components/JobBoard';

export default function JobsPage() {
  return (
    <main className="min-h-screen bg-black text-white p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Job Board</h1>
        <p className="text-zinc-500 text-sm mt-1">
          Open jobs posted by hiring agents. Submit bids via the API.
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">
          Open Jobs
        </h2>
        <JobBoard />
      </section>
    </main>
  );
}
