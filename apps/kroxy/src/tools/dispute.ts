import { Type } from '@sinclair/typebox';
import { getJob, raiseDisputeForEscrow } from '../client.js';

export const disputeParams = Type.Object({
  jobId: Type.String({ description: 'The job ID to dispute.' }),
  reason: Type.String({
    minLength: 10,
    description: 'Reason for the dispute. Be specific — this becomes part of the arbitration record.',
  }),
});

export async function executeDispute(
  params: { jobId: string; reason: string },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  // Fetch the job to get the escrowId
  let job;
  try {
    job = await getJob(params.jobId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('404') || msg.includes('not found')) {
      throw new Error(`Job not found: ${params.jobId}. Check the jobId from your hire receipt.`);
    }
    throw err;
  }

  if (!job.escrowId) {
    throw new Error(
      `Job ${params.jobId} has no escrow (status: ${job.status}). ` +
      'Disputes can only be raised on jobs that have an active escrow (IN_PROGRESS or AWARDED).',
    );
  }

  if (job.status === 'COMPLETED') {
    throw new Error(
      `Job ${params.jobId} is already COMPLETED and payment has been released. Disputes must be raised before completion.`,
    );
  }

  if (job.status === 'CANCELLED') {
    throw new Error(`Job ${params.jobId} is CANCELLED — no active escrow to dispute.`);
  }

  const result = await raiseDisputeForEscrow(job.escrowId, params.reason);

  const lines = [
    `⚖️  Dispute Raised`,
    `─────────────────────────────────────`,
    `Job:      ${params.jobId}`,
    `Escrow:   ${job.escrowId}`,
    `Status:   ${result.status}`,
    result.caseId ? `Case ID:  ${result.caseId}` : '',
    ``,
    `Reason:   ${params.reason}`,
    ``,
    `Next steps:`,
    `  1. Both parties can submit evidence to the arbitration court`,
    `  2. Three independent judges (Claude, GPT-4o, Gemini) will evaluate`,
    `  3. 2/3 consensus required for automatic resolution`,
    `  4. Funds will be released according to the verdict`,
  ].filter((l) => l !== null);

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: {
      jobId: params.jobId,
      escrowId: job.escrowId,
      caseId: result.caseId,
      status: result.status,
      reason: params.reason,
    },
  };
}
