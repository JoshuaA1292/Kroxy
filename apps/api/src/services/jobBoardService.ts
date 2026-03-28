import { prisma, Prisma } from '@kroxy/db';
import { JobPostingDTO, BidDTO, ConditionsDefinition } from '@kroxy/types';
import { KroxySDK } from '@kroxy/sdk';
import { logger } from '../lib/logger';
import { triggerImmediateEvaluation, registerPoller } from './verifierService';
import { registerEscrow } from './escrowService';
import { randomBytes } from 'crypto';

// ─── DTO mappers ──────────────────────────────────────────────────────────────

function bidToDTO(bid: {
  id: string;
  jobId: string;
  providerWallet: string;
  priceUsdc: { toString(): string };
  etaSeconds: number;
  conditionsAccepted: boolean;
  message: string | null;
  status: string;
  createdAt: Date;
}): BidDTO {
  return {
    id: bid.id,
    jobId: bid.jobId,
    providerWallet: bid.providerWallet,
    priceUsdc: bid.priceUsdc.toString(),
    etaSeconds: bid.etaSeconds,
    conditionsAccepted: bid.conditionsAccepted,
    message: bid.message,
    status: bid.status as BidDTO['status'],
    createdAt: bid.createdAt.toISOString(),
  };
}

function jobToDTO(
  job: {
    id: string;
    posterWallet: string;
    description: string;
    budgetMaxUsdc: { toString(): string };
    requiredCaps: string[];
    deadline: Date;
    conditionsJson: unknown;
    status: string;
    winningBidId: string | null;
    escrowId: string | null;
    deliverable?: unknown;
    createdAt: Date;
    updatedAt: Date;
    bids?: Parameters<typeof bidToDTO>[0][];
  }
): JobPostingDTO {
  return {
    id: job.id,
    posterWallet: job.posterWallet,
    description: job.description,
    budgetMaxUsdc: job.budgetMaxUsdc.toString(),
    requiredCaps: job.requiredCaps,
    deadline: job.deadline.toISOString(),
    conditionsJson: (job.conditionsJson as ConditionsDefinition | null) ?? null,
    status: job.status as JobPostingDTO['status'],
    winningBidId: job.winningBidId,
    escrowId: job.escrowId,
    deliverable: (job.deliverable as Record<string, unknown> | null) ?? null,
    bids: job.bids?.map(bidToDTO),
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

export interface CreateJobParams {
  id?: string;
  posterWallet: string;
  description: string;
  budgetMaxUsdc: number;
  requiredCaps: string[];
  deadline: string; // ISO string
  conditionsJson?: ConditionsDefinition;
}

export async function createJob(params: CreateJobParams): Promise<JobPostingDTO> {
  const job = await prisma.jobPosting.create({
    data: {
      id: params.id,
      posterWallet: params.posterWallet,
      description: params.description,
      budgetMaxUsdc: params.budgetMaxUsdc,
      requiredCaps: params.requiredCaps,
      deadline: new Date(params.deadline),
      conditionsJson: params.conditionsJson ? (params.conditionsJson as unknown as Prisma.InputJsonValue) : undefined,
    },
  });

  logger.info({ jobId: job.id, posterWallet: params.posterWallet }, 'Job created');

  // Fire-and-forget: notify matching agents
  notifyMatchingAgents(job).catch((err) =>
    logger.warn({ err, jobId: job.id }, 'Agent notification failed')
  );

  return jobToDTO(job);
}

export interface SubmitBidParams {
  providerWallet: string;
  priceUsdc: number;
  etaSeconds: number;
  conditionsAccepted?: boolean;
  message?: string;
}

export async function submitBid(jobId: string, params: SubmitBidParams): Promise<BidDTO> {
  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (job.status !== 'OPEN') {
    throw Object.assign(new Error(`Job is not open (status: ${job.status})`), { statusCode: 409 });
  }

  const bid = await prisma.bid.create({
    data: {
      jobId,
      providerWallet: params.providerWallet,
      priceUsdc: params.priceUsdc,
      etaSeconds: params.etaSeconds,
      conditionsAccepted: params.conditionsAccepted ?? true,
      message: params.message ?? null,
    },
  });

  logger.info({ bidId: bid.id, jobId, providerWallet: params.providerWallet }, 'Bid submitted');
  return bidToDTO(bid);
}

export interface AcceptBidResult {
  jobId: string;
  bidId: string;
  escrowId: string;
  txHash: string;
}

export async function acceptBid(
  jobId: string,
  bidId: string,
  payerPrivateKey: string
): Promise<AcceptBidResult> {
  const [job, bid] = await Promise.all([
    prisma.jobPosting.findUnique({ where: { id: jobId }, include: { bids: true } }),
    prisma.bid.findUnique({ where: { id: bidId } }),
  ]);

  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (!bid || bid.jobId !== jobId) {
    throw Object.assign(new Error('Bid not found for this job'), { statusCode: 404 });
  }
  if (job.status !== 'OPEN') {
    throw Object.assign(new Error(`Job is not open (status: ${job.status})`), { statusCode: 409 });
  }
  if (bid.status !== 'PENDING') {
    throw Object.assign(new Error(`Bid is not pending (status: ${bid.status})`), { statusCode: 409 });
  }

  // Build conditions from job's conditionsJson if present
  const conditions = job.conditionsJson as ConditionsDefinition | null;
  const demoMode = process.env.KROXY_DEMO_MODE === '1';

  const baseConditions = conditions ?? {
    version: '1.0',
    escrowId: '',
    conditions: [],
    windowSeconds: 3600,
    checkIntervalSeconds: 60,
    requiredPassRate: 1.0,
  };

  const result = demoMode
    ? await (async () => {
        const escrowId = `0x${randomBytes(32).toString('hex')}`;
        const txHash = `0x${randomBytes(32).toString('hex')}`;
        const conditionsWithId: ConditionsDefinition = { ...baseConditions, escrowId };
        const durationSeconds = Math.max(baseConditions.windowSeconds, 30);
        await registerEscrow({
          escrowId,
          payerAddress: job.posterWallet,
          payeeAddress: bid.providerWallet,
          amountUsdc: Number(bid.priceUsdc.toString()),
          conditionsJson: conditionsWithId,
          conditionsHash: `0x${randomBytes(32).toString('hex')}`,
          x402Reference: `job:${jobId}:bid:${bidId}`,
          escrowDurationSeconds: durationSeconds,
          txHash,
          blockNumber: 0,
        });
        registerPoller(
          escrowId,
          conditionsWithId,
          new Date(Date.now() + durationSeconds * 1000),
          bid.providerWallet,
          BigInt(Math.round(Number(bid.priceUsdc.toString()) * 1_000_000))
        );
        return { escrowId, txHash };
      })()
    : await (async () => {
        const sdk = new KroxySDK();
        return sdk.createEscrow({
          payerPrivateKey,
          payeeAddress: bid.providerWallet,
          amountUsdc: Number(bid.priceUsdc.toString()),
          conditions: baseConditions,
          x402Reference: `job:${jobId}:bid:${bidId}`,
        });
      })();

  // In production, KroxySDK.createEscrow() already registers escrow + poller via API.

  // Update DB atomically
  await prisma.$transaction([
    prisma.bid.update({ where: { id: bidId }, data: { status: 'ACCEPTED' } }),
    // Reject all other bids
    prisma.bid.updateMany({
      where: { jobId, id: { not: bidId }, status: 'PENDING' },
      data: { status: 'REJECTED' },
    }),
    prisma.jobPosting.update({
      where: { id: jobId },
      data: {
        status: 'IN_PROGRESS',
        winningBidId: bidId,
        escrowId: result.escrowId,
      },
    }),
  ]);

  logger.info({ jobId, bidId, escrowId: result.escrowId, txHash: result.txHash }, 'Bid accepted, escrow created');

  return { jobId, bidId, escrowId: result.escrowId, txHash: result.txHash };
}

export async function listJobs(filters: {
  status?: string;
  capability?: string;
  posterWallet?: string;
  limit?: number;
}): Promise<JobPostingDTO[]> {
  const where: Prisma.JobPostingWhereInput = {};

  if (filters.status) {
    where.status = filters.status as Prisma.EnumJobStatusFilter;
  }
  if (filters.capability) {
    where.requiredCaps = { hasSome: [filters.capability] };
  }
  if (filters.posterWallet) {
    where.posterWallet = { equals: filters.posterWallet, mode: 'insensitive' };
  }

  const jobs = await prisma.jobPosting.findMany({
    where,
    include: { bids: true },
    orderBy: { createdAt: 'desc' },
    take: Math.min(filters.limit ?? 50, 200),
  });

  return jobs.map(jobToDTO);
}

export async function getJob(jobId: string): Promise<JobPostingDTO | null> {
  const job = await prisma.jobPosting.findUnique({
    where: { id: jobId },
    include: { bids: true },
  });
  return job ? jobToDTO(job) : null;
}

// ─── Deliver job ─────────────────────────────────────────────────────────────

export interface DeliverJobParams {
  providerWallet: string;
  deliverable: Record<string, unknown>;
}

export async function deliverJob(jobId: string, params: DeliverJobParams): Promise<JobPostingDTO> {
  const job = await prisma.jobPosting.findUnique({ where: { id: jobId }, include: { bids: true } });
  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (job.status !== 'IN_PROGRESS') {
    throw Object.assign(new Error(`Job is not in progress (status: ${job.status})`), { statusCode: 409 });
  }

  const winningBid = job.bids.find((b) => b.id === job.winningBidId);
  if (!winningBid || winningBid.providerWallet.toLowerCase() !== params.providerWallet.toLowerCase()) {
    throw Object.assign(new Error('Only the winning provider can deliver'), { statusCode: 403 });
  }

  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: {
      status: 'COMPLETED',
      deliverable: params.deliverable as Prisma.InputJsonValue,
    },
    include: { bids: true },
  });

  logger.info({ jobId, providerWallet: params.providerWallet }, 'Job delivered');

  // Trigger immediate escrow evaluation (fire-and-forget)
  if (job.escrowId) {
    triggerImmediateEvaluation(job.escrowId).catch((err) =>
      logger.warn({ err, escrowId: job.escrowId }, 'triggerImmediateEvaluation after delivery failed')
    );
  }

  return jobToDTO(updated);
}

// ─── Cancel job ──────────────────────────────────────────────────────────────

export async function cancelJob(jobId: string): Promise<JobPostingDTO> {
  const job = await prisma.jobPosting.findUnique({ where: { id: jobId } });
  if (!job) throw Object.assign(new Error('Job not found'), { statusCode: 404 });
  if (job.status !== 'OPEN') {
    throw Object.assign(
      new Error(`Only OPEN jobs can be cancelled (current status: ${job.status})`),
      { statusCode: 409 }
    );
  }
  const updated = await prisma.jobPosting.update({
    where: { id: jobId },
    data: { status: 'CANCELLED' },
    include: { bids: true },
  });
  logger.info({ jobId }, 'Job cancelled');
  return jobToDTO(updated);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function notifyMatchingAgents(job: { id: string; requiredCaps: string[]; description: string }): Promise<void> {
  if (job.requiredCaps.length === 0) return;

  const agents = await prisma.agentProfile.findMany({
    where: {
      active: true,
      capabilities: { hasSome: job.requiredCaps },
    },
    select: { walletAddress: true, endpoint: true },
  });

  const payload = JSON.stringify({ type: 'JOB_POSTED', jobId: job.id, description: job.description });

  await Promise.allSettled(
    agents.map(async (agent) => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        await fetch(agent.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          signal: controller.signal,
        });
        clearTimeout(timeout);
      } catch (err) {
        logger.debug({ err, wallet: agent.walletAddress }, 'Job notification to agent failed');
      }
    })
  );
}
