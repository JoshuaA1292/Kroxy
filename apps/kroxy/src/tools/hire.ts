import { randomBytes } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { ConditionsDefinition } from '../client.js';
import {
  findAgents,
  postJob,
  acceptBid,
  pollJob,
} from '../client.js';

export const hireParams = Type.Object({
  task: Type.String({ description: 'What you want the hired agent to do, e.g. "Research the top AI payment startups"' }),
  maxPrice: Type.Optional(Type.Number({ minimum: 0.01, description: 'Maximum USDC budget, default 5.00' })),
  capability: Type.Optional(Type.String({ description: 'Agent capability to match: research, writing, coding. Auto-detected from task if omitted.' })),
  minRep: Type.Optional(Type.Number({ minimum: 0, maximum: 100, description: 'Minimum reputation score (0–100) required. Default: 0 (any agent accepted).' })),
});

function detectCapability(task: string): string {
  if (/research|find|search|analyz|summariz|look up/i.test(task)) return 'research';
  if (/write|draft|essay|blog|article|copy/i.test(task)) return 'writing';
  if (/code|script|function|implement|build|program/i.test(task)) return 'coding';
  return 'research';
}

function buildConditions(nexusUrl: string, jobId: string): ConditionsDefinition {
  return {
    version: '1.0',
    escrowId: '',
    conditions: [
      { type: 'http_status', endpoint: `${nexusUrl}/health`, operator: 'eq', expected: 200 },
      {
        type: 'json_field',
        endpoint: `${nexusUrl}/quality-check?jobId=${encodeURIComponent(jobId)}`,
        field: 'wordCount',
        operator: 'gte',
        expected: 100,
      },
      {
        type: 'json_field',
        endpoint: `${nexusUrl}/quality-check?jobId=${encodeURIComponent(jobId)}`,
        field: 'confidence',
        operator: 'gte',
        expected: 0.7,
      },
    ],
    windowSeconds: 120,
    checkIntervalSeconds: 10,
    requiredPassRate: 0.8,
  };
}

function formatDuration(startMs: number): string {
  const secs = Math.floor((Date.now() - startMs) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ${secs % 60}s`;
}

function buildReceipt(opts: {
  task: string;
  agentWallet: string;
  agentRep?: number;
  amountPaid: string;
  duration: string;
  escrowId: string;
  txHash?: string;
  summary?: string;
  keyFindings?: string[];
}): string {
  const lines = [
    `✅ Job Complete — ${opts.task.slice(0, 60)}${opts.task.length > 60 ? '…' : ''}`,
    ``,
    `Agent:     ${opts.agentWallet}${opts.agentRep !== undefined ? ` (rep: ${opts.agentRep})` : ''}`,
    `Task:      ${opts.task}`,
    `Duration:  ${opts.duration}`,
    `Paid:      $${opts.amountPaid} USDC`,
    opts.txHash ? `Escrow tx: ${opts.txHash}` : `Escrow ID: ${opts.escrowId}`,
    `Audit:     https://kroxy.ai/audit/${opts.escrowId}`,
  ];

  if (opts.summary) {
    lines.push('', `--- Deliverable Summary ---`, opts.summary);
  }
  if (opts.keyFindings?.length) {
    lines.push('', `Key findings:`);
    opts.keyFindings.slice(0, 5).forEach((f, i) => lines.push(`  ${i + 1}. ${f}`));
  }

  return lines.join('\n');
}

export async function executeHire(
  params: { task: string; maxPrice?: number; capability?: string; minRep?: number },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  const wallet = process.env.KROXY_AGENT_WALLET;
  const privateKey = process.env.KROXY_AGENT_PRIVATE_KEY;
  const demoMode = process.env.KROXY_DEMO_MODE === '1';
  const apiBase = process.env.KROXY_API_URL ?? 'http://localhost:3001';
  // In demo mode, point at the embedded demo agent in the API if NEXUS_URL not explicitly set
  const nexusUrl = process.env.NEXUS_URL ?? (demoMode ? `${apiBase}/demo-agent` : 'http://localhost:3003');

  if (!wallet) throw new Error('KROXY_AGENT_WALLET is not configured. Run kroxy_setup to diagnose.');
  if (!demoMode && !privateKey) throw new Error('KROXY_AGENT_PRIVATE_KEY is not configured. Set KROXY_DEMO_MODE=1 to use demo mode without a real private key.');

  const task = params.task;
  const maxPrice = params.maxPrice ?? 5.0;
  const minRep = params.minRep ?? 0;
  const capability = params.capability ?? detectCapability(task);
  const payerPrivateKey = privateKey ?? 'demo-private-key';
  const jobId = `job_${Date.now()}_${randomBytes(3).toString('hex')}`;
  const startMs = Date.now();

  // 1. Find matching agents
  const agents = await findAgents(capability, maxPrice);
  if (!agents.length) {
    throw new Error(
      `No agents available for "${capability}" within $${maxPrice} USDC. ` +
      `Try kroxy_browse to see available agents, or increase maxPrice.`,
    );
  }

  // 2. Enforce rep threshold
  if (minRep > 0) {
    const qualified = agents.filter((a) => (a.reputationScore ?? 0) >= minRep);
    if (!qualified.length) {
      throw new Error(
        `No agents meet the minimum reputation score of ${minRep}. ` +
        `Found ${agents.length} agent${agents.length === 1 ? '' : 's'} below threshold. ` +
        `Lower minRep or remove it to accept any agent.`,
      );
    }
  }

  // 3. Post job with verifier conditions pointing at Nexus
  const conditions = buildConditions(nexusUrl, jobId);
  const job = await postJob(jobId, task, capability, maxPrice, conditions, wallet);

  // 4. Wait for a bid (up to 60s)
  const jobWithBid = await pollJob(job.id, (j) => Boolean(j.bids?.length), 60_000);
  if (!jobWithBid?.bids?.length) {
    throw new Error(
      `No bids received within 60 seconds (jobId: ${job.id}). ` +
      `The agent may be offline — use kroxy_browse to check availability.`,
    );
  }

  const bid = jobWithBid.bids[0];

  // 5. Budget guardrail before accepting
  const bidPrice = parseFloat(bid.priceUsdc);
  if (bidPrice > maxPrice) {
    throw new Error(
      `Bid of $${bid.priceUsdc} USDC exceeds your budget of $${maxPrice} USDC. ` +
      `Increase maxPrice to $${bidPrice} or higher to accept this bid.`,
    );
  }

  // 6. Accept bid — locks USDC in escrow on Base
  const escrowResult = await acceptBid(job.id, bid.id, payerPrivateKey);

  // 7. Poll for completion (up to 5 minutes)
  const completed = await pollJob(job.id, (j) => j.status === 'COMPLETED', 300_000);
  if (!completed) {
    throw new Error(
      `Job timed out after 5 minutes (jobId: ${job.id}, escrowId: ${escrowResult.escrowId}). ` +
      `Funds are still in escrow — use kroxy_status to monitor or kroxy_dispute to raise a dispute.`,
    );
  }

  const deliverable = completed.deliverable as any;
  const bidAgent = agents.find((a) => a.walletAddress === bid.providerWallet);
  const duration = formatDuration(startMs);

  const receipt = buildReceipt({
    task,
    agentWallet: bid.providerWallet,
    agentRep: bidAgent?.reputationScore,
    amountPaid: bid.priceUsdc,
    duration,
    escrowId: escrowResult.escrowId,
    txHash: escrowResult.txHash,
    summary: deliverable?.summary,
    keyFindings: deliverable?.keyFindings,
  });

  const details = {
    jobId: completed.id,
    escrowId: escrowResult.escrowId,
    txHash: escrowResult.txHash,
    agent: bid.providerWallet,
    agentRep: bidAgent?.reputationScore,
    amountPaid: `${bid.priceUsdc} USDC`,
    duration,
    auditTrail: `https://kroxy.ai/audit/${escrowResult.escrowId}`,
    deliverable: {
      summary: deliverable?.summary ?? '(no summary)',
      keyFindings: deliverable?.keyFindings ?? [],
      sources: deliverable?.sources ?? [],
    },
  };

  return {
    content: [{ type: 'text', text: receipt }],
    details,
  };
}
