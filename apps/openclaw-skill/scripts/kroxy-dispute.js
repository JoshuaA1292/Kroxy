#!/usr/bin/env node
'use strict';
/**
 * kroxy-dispute.js — Raise a dispute on a Kroxy escrow.
 *
 * Usage (called by OpenClaw when user wants to dispute a completed or in-progress job):
 *   node kroxy-dispute.js --escrowId=0xabc... --reason="Work was incomplete"
 *   node kroxy-dispute.js --jobId=job_abc123 --reason="Deliverable did not meet requirements"
 *
 * Either --escrowId or --jobId must be provided.
 * If --jobId is given, the script will look up the escrowId automatically.
 *
 * Required env: KROXY_API_KEY, KROXY_API_URL
 *
 * Outputs JSON to stdout:
 *   { disputed: true, escrowId, status, ... }
 *   { disputed: false, error }
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const argv = require('minimist')(process.argv.slice(2));
const { raiseDispute, getJob } = require('./lib/kroxy-client');

function fail(error) {
  process.stdout.write(JSON.stringify({ disputed: false, error }) + '\n');
  process.exit(1);
}

async function main() {
  if (argv.help || argv.h) {
    console.log('Usage: node kroxy-dispute.js (--escrowId=0x... | --jobId=<id>) --reason="<reason>"');
    process.exit(0);
  }

  const reason = argv.reason;
  if (!reason) fail('--reason is required (describe why you are disputing this job)');

  let escrowId = argv.escrowId;

  // Allow passing --jobId instead of --escrowId
  if (!escrowId && argv.jobId) {
    process.stderr.write(`[kroxy-dispute] Looking up escrowId for job ${argv.jobId}...\n`);
    let job;
    try {
      job = await getJob(argv.jobId);
    } catch (err) {
      fail(`Could not fetch job: ${err.message}`);
    }
    if (!job.escrowId) fail(`Job ${argv.jobId} has no associated escrow. Has a bid been accepted?`);
    escrowId = job.escrowId;
  }

  if (!escrowId) fail('--escrowId or --jobId is required');

  // Optional evidence key-value pairs: --evidence.key=value
  const evidenceData = argv.evidence && typeof argv.evidence === 'object' ? argv.evidence : {};

  process.stderr.write(`[kroxy-dispute] Raising dispute on escrow ${escrowId}: "${reason}"\n`);

  let result;
  try {
    result = await raiseDispute(escrowId, reason, evidenceData);
  } catch (err) {
    fail(`Failed to raise dispute: ${err.message}`);
  }

  process.stdout.write(JSON.stringify({
    disputed: true,
    escrowId,
    ...result,
  }) + '\n');
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
});
