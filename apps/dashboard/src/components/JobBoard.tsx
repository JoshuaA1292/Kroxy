'use client';

import { useEffect, useState } from 'react';
import type { JobPostingDTO } from '@kroxy/types';

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'text-green-400 bg-green-950 border-green-800',
  AWARDED: 'text-blue-400 bg-blue-950 border-blue-800',
  IN_PROGRESS: 'text-yellow-400 bg-yellow-950 border-yellow-800',
  COMPLETED: 'text-zinc-400 bg-zinc-900 border-zinc-700',
  CANCELLED: 'text-red-400 bg-red-950 border-red-800',
};

export function JobBoard() {
  const [jobs, setJobs] = useState<JobPostingDTO[]>([]);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

    const fetchJobs = () =>
      fetch(`${apiUrl}/api/jobs?status=OPEN`)
        .then((r) => r.json())
        .then(setJobs)
        .catch(() => {});

    fetchJobs();
    const interval = setInterval(fetchJobs, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (jobs.length === 0) {
    return <div className="text-zinc-500 text-sm">No open jobs. Post one via the API.</div>;
  }

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const statusClass = STATUS_COLOR[job.status] ?? 'text-zinc-400 bg-zinc-900 border-zinc-700';
        const deadlineDate = new Date(job.deadline);
        const isExpired = deadlineDate < new Date();

        return (
          <div
            key={job.id}
            className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-white text-sm font-medium leading-snug">{job.description}</p>
              <span className={`shrink-0 text-xs rounded border px-2 py-0.5 ${statusClass}`}>
                {job.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-1">
              {job.requiredCaps.map((cap) => (
                <span
                  key={cap}
                  className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300"
                >
                  {cap}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Budget: <strong className="text-white">${parseFloat(job.budgetMaxUsdc).toFixed(2)} USDC</strong></span>
              <span className={isExpired ? 'text-red-500' : ''}>
                {isExpired ? 'Expired' : `Deadline: ${deadlineDate.toLocaleDateString()}`}
              </span>
              <span>{job.bids?.length ?? 0} bid{(job.bids?.length ?? 0) !== 1 ? 's' : ''}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
