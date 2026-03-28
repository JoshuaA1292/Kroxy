import { Type } from '@sinclair/typebox';
import { getJob } from '../client.js';

export const statusParams = Type.Object({
  jobId: Type.String({ description: 'The job ID returned by kroxy_hire or kroxy_browse.' }),
});

function timeAgo(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ${secs % 60}s ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: '🟡 OPEN — waiting for bids',
  AWARDED: '🟠 AWARDED — bid accepted, awaiting escrow',
  IN_PROGRESS: '🔵 IN PROGRESS — agent working, USDC in escrow',
  COMPLETED: '✅ COMPLETED — payment released',
  CANCELLED: '⛔ CANCELLED',
};

export async function executeStatus(
  params: { jobId: string },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  let job;
  try {
    job = await getJob(params.jobId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('404') || msg.includes('not found')) {
      throw new Error(`Job not found: ${params.jobId}. Double-check the jobId from your hire receipt.`);
    }
    throw err;
  }

  const statusLabel = STATUS_LABELS[job.status] ?? job.status;
  const postedAgo = job.createdAt ? timeAgo(job.createdAt) : 'unknown';
  const updatedAgo = job.updatedAt ? timeAgo(job.updatedAt) : 'unknown';

  const activeBid = job.bids?.find((b) => b.status === 'ACCEPTED');
  const pendingBids = job.bids?.filter((b) => b.status === 'PENDING') ?? [];

  const lines = [
    `Job Status: ${params.jobId}`,
    `─────────────────────────────────────`,
    `Status:   ${statusLabel}`,
    `Posted:   ${postedAgo}`,
    `Updated:  ${updatedAgo}`,
  ];

  if (activeBid) {
    lines.push(`Agent:    ${activeBid.providerWallet}`);
    lines.push(`Agreed:   $${activeBid.priceUsdc} USDC`);
  } else if (pendingBids.length > 0) {
    lines.push(`Bids:     ${pendingBids.length} pending`);
  }

  if (job.escrowId) {
    lines.push(`Escrow:   ${job.escrowId} (USDC locked)`);
  }

  if (job.status === 'COMPLETED' && job.deliverable) {
    const summary = (job.deliverable as any)?.summary;
    if (summary) {
      lines.push('', `Result:   ${String(summary).slice(0, 200)}`);
    }
  }

  const result = {
    jobId: job.id,
    status: job.status,
    postedAgo,
    updatedAgo,
    escrowId: job.escrowId ?? null,
    activeBid: activeBid ?? null,
    pendingBidCount: pendingBids.length,
    deliverable: job.deliverable ?? null,
  };

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: result,
  };
}
