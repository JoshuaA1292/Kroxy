#!/usr/bin/env node
'use strict';
/**
 * kroxy-hire.js — Hire an agent via Kroxy conditional escrow.
 *
 * Usage (called by OpenClaw when user wants to hire an agent):
 *   node kroxy-hire.js --task="Research AI payment protocols" --maxPrice=5.00
 *
 * Required env: KROXY_API_KEY, KROXY_AGENT_WALLET, KROXY_API_URL
 * Optional env: KROXY_AGENT_PRIVATE_KEY (ignored; private keys are never sent over API calls)
 * Optional env: NEXUS_URL (default http://localhost:3003)
 *
 * Outputs JSON to stdout:
 *   { status: "success", deliverable, agent, amountPaid, auditTrail }
 *   { status: "error", reason }
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const argv = require('minimist')(process.argv.slice(2));
const { findAgents, postJob, acceptBid, pollJob } = require('./lib/kroxy-client');
const { randomBytes } = require('crypto');

const WALLET = process.env.KROXY_AGENT_WALLET;
const PRIVATE_KEY = process.env.KROXY_AGENT_PRIVATE_KEY;
const DEMO_MODE = process.env.KROXY_DEMO_MODE === '1';
const NEXUS_URL = process.env.NEXUS_URL || argv.nexusUrl || 'http://localhost:3003';
const API_URL = process.env.KROXY_API_URL || 'https://api-production-1b45.up.railway.app';

function detectCapability(task) {
  const t = task.toLowerCase();
  if (/plan|roadmap|strateg|architect|design|outline|milestone|go-to-market/i.test(t)) return 'planning';
  if (/research|find|search|analyze|summarize|look up/i.test(t)) return 'research';
  if (/write|draft|essay|blog|article|copy/i.test(t)) return 'writing';
  if (/code|script|function|implement|build|program/i.test(t)) return 'coding';
  return 'research'; // safe default
}

function buildConditions(nexusUrl, jobId) {
  return {
    version: '1.0',
    escrowId: '',
    conditions: [
      {
        type: 'http_status',
        endpoint: `${nexusUrl}/health`,
        operator: 'eq',
        expected: 200,
      },
      {
        type: 'json_field',
        endpoint: `${API_URL}/api/jobs/${encodeURIComponent(jobId)}`,
        field: 'status',
        operator: 'eq',
        expected: 'COMPLETED',
      },
      {
        type: 'deliverable_quality',
        endpoint: `${API_URL}/api/jobs/${encodeURIComponent(jobId)}`,
        field: 'deliverable',
        operator: 'gte',
        expected: {
          minSummaryWords: 120,
          minSummaryChars: 600,
          minSentences: 3,
          minKeyFindings: 3,
          minFindingChars: 20,
          minSources: 2,
          minSourceDomains: 2,
          minLexicalDiversity: 0.45,
          requireCompletedStatus: true,
          forbidPlaceholderPhrases: true,
        },
      },
    ],
    windowSeconds: 120,
    checkIntervalSeconds: 10,
    requiredPassRate: 0.8,
  };
}

function fail(reason, extra = {}) {
  process.stdout.write(JSON.stringify({ status: 'error', reason, ...extra }) + '\n');
  process.exit(1);
}

async function waitForBidWithRetries(jobId, waitMs, retries) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const jobWithBid = await pollJob(
      jobId,
      (j) => j.bids && j.bids.length > 0,
      waitMs
    );

    if (jobWithBid && jobWithBid.bids?.length) {
      return { jobWithBid, attempts: attempt + 1 };
    }

    if (attempt < retries) {
      process.stderr.write(
        `[kroxy-hire] No bids in ${(waitMs / 1000)}s. Retrying (${attempt + 2}/${retries + 1})...\n`
      );
    }
  }

  return { jobWithBid: null, attempts: retries + 1 };
}

async function main() {
  const task = argv.task || argv._[0];
  const maxPrice = parseFloat(argv.maxPrice || argv.budget || '5.00');
  const capability = argv.capability || detectCapability(task || '');
  const bidWaitSeconds = Math.max(
    30,
    parseInt(argv.bidWaitSeconds || process.env.KROXY_BID_WAIT_SECONDS || '60', 10)
  );
  const bidRetries = Math.max(
    0,
    parseInt(argv.bidRetries || process.env.KROXY_BID_RETRIES || '2', 10)
  );
  const bidWaitMs = bidWaitSeconds * 1000;

  if (!task) fail('--task is required');
  if (!WALLET) fail('KROXY_AGENT_WALLET env var is not set. Use a real wallet address or set KROXY_DEMO_MODE=1 to try without a wallet.');

  // Auto-fallback to demo mode when no private key is provided so the user
  // can explore the job board and hiring flow without a funded wallet.
  if (!DEMO_MODE && !PRIVATE_KEY) {
    process.stderr.write('[kroxy-hire] KROXY_AGENT_PRIVATE_KEY not set — running in demo mode (escrow not funded on-chain)\n');
  }
  const jobId = argv.jobId || `job_${Date.now()}_${randomBytes(3).toString('hex')}`;

  process.stderr.write(`[kroxy-hire] Task: "${task.substring(0, 60)}"\n`);
  process.stderr.write(`[kroxy-hire] Capability: ${capability}, maxPrice: $${maxPrice}\n`);

  // 1. Find matching agents
  let agents;
  try {
    agents = await findAgents(capability, maxPrice);
  } catch (err) {
    fail(`Could not reach Kroxy API: ${err.message}`);
  }

  if (!agents || agents.length === 0) {
    fail(`No agents available for capability "${capability}" within budget $${maxPrice}`);
  }

  const best = agents[0];
  process.stderr.write(`[kroxy-hire] Found agent: ${best.name} (wallet: ${best.walletAddress})\n`);

  // 2. Post job with conditions pointing at Nexus
  const conditions = buildConditions(NEXUS_URL, jobId);
  let job;
  try {
    job = await postJob(jobId, task, capability, maxPrice, conditions, WALLET);
  } catch (err) {
    fail(`Failed to post job: ${err.message}`);
  }

  process.stderr.write(`[kroxy-hire] Job posted: ${job.id}\n`);

  // 3. Wait for a bid with retries (default: 3 windows × 60s)
  const { jobWithBid, attempts } = await waitForBidWithRetries(job.id, bidWaitMs, bidRetries);

  if (!jobWithBid || !jobWithBid.bids?.length) {
    fail(`No bids received after ${attempts} attempt(s) of ${bidWaitSeconds}s`, { jobId: job.id });
  }

  const bid = jobWithBid.bids[0];
  process.stderr.write(`[kroxy-hire] Bid received from ${bid.providerWallet} at $${bid.priceUsdc} USDC\n`);
  process.stderr.write(`[kroxy-hire] Locking escrow on Base...\n`);

  // 4. Accept bid — locks USDC in escrow on Base
  let escrowResult;
  try {
    escrowResult = await acceptBid(job.id, bid.id);
  } catch (err) {
    fail(`Failed to lock escrow: ${err.message}`, { jobId: job.id, bidId: bid.id });
  }

  process.stderr.write(`[kroxy-hire] Escrow locked: ${escrowResult.escrowId}\n`);
  process.stderr.write(`[kroxy-hire] Waiting for work to complete (up to 5 minutes)...\n`);

  // 5. Poll for completion (up to 5 minutes)
  const completedJob = await pollJob(
    job.id,
    (j) => j.status === 'COMPLETED',
    300_000
  );

  if (!completedJob) {
    fail('Job did not complete within 5 minutes', {
      jobId: job.id,
      escrowId: escrowResult.escrowId,
      status: 'timeout',
    });
  }

  // 6. Return structured result to OpenClaw
  const result = {
    status: 'success',
    deliverable: completedJob.deliverable,
    agent: bid.providerWallet,
    amountPaid: bid.priceUsdc,
    jobId: completedJob.id,
    escrowId: escrowResult.escrowId,
    auditTrail: `https://kroxy.ai/audit/${escrowResult.escrowId}`,
  };

  process.stdout.write(JSON.stringify(result) + '\n');
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
});
