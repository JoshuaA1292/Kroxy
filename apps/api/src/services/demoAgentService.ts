/**
 * Embedded Demo Agent
 *
 * When KROXY_DEMO_AGENT_ENABLED=1, this module registers a fake "Nexus (Demo)"
 * provider agent in the database and auto-processes any open research jobs.
 *
 * This lets the full hire → escrow → deliver → pay loop run end-to-end with
 * zero external services or private keys. Perfect for hackathon demos.
 */

import { submitBid, getJob, deliverJob, listJobs } from './jobBoardService';
import { registerAgent } from './agentRegistryService';
import { logger } from '../lib/logger';

// ─── Config ───────────────────────────────────────────────────────────────────

export const DEMO_AGENT_WALLET =
  process.env.KROXY_DEMO_AGENT_WALLET ?? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

const DEMO_PRICE_USDC = 2.50;
const DEMO_CAPABILITIES = ['research', 'analysis', 'writing', 'coding'];

// ─── In-memory state ──────────────────────────────────────────────────────────

/** jobId/escrowId → quality metrics for verifier */
export const resultMap = new Map<string, { wordCount: number; confidence: number }>();

/** jobIds already queued to avoid double-processing */
const seenJobs = new Set<string>();

/** jobIds currently being processed */
const activeJobs = new Set<string>();

// ─── Registration ─────────────────────────────────────────────────────────────

export async function registerDemoAgent(): Promise<void> {
  const apiUrl = process.env.KROXY_API_URL ?? 'http://localhost:3001';
  const endpoint = `${apiUrl}/demo-agent/jobs`;

  try {
    await registerAgent({
      walletAddress: DEMO_AGENT_WALLET,
      name: 'Nexus (Demo)',
      endpoint,
      modelName: 'demo',
      capabilities: DEMO_CAPABILITIES,
      pricingUsdc: DEMO_PRICE_USDC,
      slaUptimePct: 99,
      slaResponseMs: 5000,
    });
    logger.info({ wallet: DEMO_AGENT_WALLET, endpoint }, '[DemoAgent] Registered on Kroxy');
  } catch (err) {
    logger.warn({ err }, '[DemoAgent] Registration failed (will retry on next restart)');
  }
}

// ─── Job processing ───────────────────────────────────────────────────────────

function cannedDeliverable(description: string): Record<string, unknown> {
  return {
    summary:
      `Demo research completed for "${description.slice(0, 80)}". ` +
      `This demonstrates the full Kroxy payment flow: USDC was locked in escrow on Base, ` +
      `work quality was verified via on-chain conditions, and payment was released ` +
      `automatically without any human intervention.`,
    keyFindings: [
      'Escrow locked $2.50 USDC on Base before work began — trustless by design',
      'Three on-chain conditions verified: HTTP health, word count ≥100, confidence ≥0.7',
      'Payment released automatically upon verification — zero human coordination required',
    ],
    sources: ['https://kroxy.ai', 'https://base.org/ecosystem'],
    wordCount: 500,
    confidence: 0.95,
  };
}

async function pollJobUntil(
  jobId: string,
  condition: (j: Awaited<ReturnType<typeof getJob>>) => boolean,
  maxMs: number,
  intervalMs = 5_000,
): Promise<Awaited<ReturnType<typeof getJob>>> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const job = await getJob(jobId);
    if (job && condition(job)) return job;
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export async function processJob(jobId: string): Promise<void> {
  if (seenJobs.has(jobId) || activeJobs.has(jobId)) return;
  seenJobs.add(jobId);
  activeJobs.add(jobId);

  try {
    // 1. Verify job is still open
    const job = await getJob(jobId);
    if (!job || job.status !== 'OPEN') {
      logger.debug({ jobId, status: job?.status }, '[DemoAgent] Skipping non-OPEN job');
      return;
    }

    logger.info({ jobId, description: job.description.slice(0, 60) }, '[DemoAgent] Processing job');

    // 2. Submit bid (may fail if already bid — tolerate gracefully)
    try {
      await submitBid(jobId, {
        providerWallet: DEMO_AGENT_WALLET,
        priceUsdc: DEMO_PRICE_USDC,
        etaSeconds: 120,
        conditionsAccepted: true,
        message: 'Nexus demo agent — instant delivery for hackathon demo',
      });
      logger.info({ jobId }, '[DemoAgent] Bid submitted');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn({ jobId, msg }, '[DemoAgent] Bid failed — skipping');
      return;
    }

    // 3. Wait for bid acceptance (up to 90s)
    const accepted = await pollJobUntil(
      jobId,
      (j) =>
        j?.status === 'IN_PROGRESS' &&
        Boolean(
          j.bids?.some(
            (b) =>
              b.providerWallet.toLowerCase() === DEMO_AGENT_WALLET.toLowerCase() &&
              b.status === 'ACCEPTED',
          ),
        ),
      90_000,
    );

    if (!accepted) {
      logger.warn({ jobId }, '[DemoAgent] Bid not accepted within 90s');
      return;
    }

    logger.info({ jobId }, '[DemoAgent] Bid accepted — delivering work');

    // 4. Store quality metrics for verifier to read
    const metrics = { wordCount: 500, confidence: 0.95 };
    resultMap.set(jobId, metrics);
    if (accepted.escrowId) resultMap.set(accepted.escrowId, metrics);

    // 5. Small delay to simulate "work" (makes the demo feel real)
    await new Promise<void>((r) => setTimeout(r, 2_000));

    // 6. Deliver
    const deliverable = cannedDeliverable(job.description);
    await deliverJob(jobId, { providerWallet: DEMO_AGENT_WALLET, deliverable });

    logger.info({ jobId, escrowId: accepted.escrowId }, '[DemoAgent] Job delivered — awaiting escrow release');
  } catch (err) {
    logger.error({ err, jobId }, '[DemoAgent] processJob failed');
  } finally {
    activeJobs.delete(jobId);
  }
}

// ─── Fallback poller ──────────────────────────────────────────────────────────

async function pollForOpenJobs(): Promise<void> {
  try {
    const jobs = await listJobs({ status: 'OPEN', limit: 20 });
    for (const job of jobs) {
      const caps = (job as any).requiredCaps as string[] | undefined;
      const matches = !caps || caps.some((c) => DEMO_CAPABILITIES.includes(c));
      if (matches && !seenJobs.has(job.id)) {
        void processJob(job.id);
      }
    }
  } catch (err) {
    logger.debug({ err }, '[DemoAgent] Fallback poll failed');
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

export async function startDemoAgent(): Promise<void> {
  logger.info('[DemoAgent] Starting embedded demo agent');

  await registerDemoAgent();

  // Fallback poller — runs every 30s in case webhooks miss a job
  setInterval(() => {
    void pollForOpenJobs();
  }, 30_000);

  // Initial poll after 2s (let API finish booting)
  setTimeout(() => void pollForOpenJobs(), 2_000);
}
