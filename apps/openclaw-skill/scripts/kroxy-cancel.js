#!/usr/bin/env node
'use strict';
/**
 * kroxy-cancel.js — Cancel an open job on Kroxy.
 *
 * Usage (called by OpenClaw when user wants to cancel a job they posted):
 *   node kroxy-cancel.js --jobId=job_abc123
 *
 * Required env: KROXY_API_KEY, KROXY_API_URL
 *
 * Outputs JSON to stdout:
 *   { cancelled: true, jobId, status }
 *   { cancelled: false, error }
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const argv = require('minimist')(process.argv.slice(2));
const { cancelJob } = require('./lib/kroxy-client');

function fail(error) {
  process.stdout.write(JSON.stringify({ cancelled: false, error }) + '\n');
  process.exit(1);
}

async function main() {
  if (argv.help || argv.h) {
    console.log('Usage: node kroxy-cancel.js --jobId=<job-id>');
    process.exit(0);
  }

  const jobId = argv.jobId || argv._[0];
  if (!jobId) fail('--jobId is required');

  process.stderr.write(`[kroxy-cancel] Cancelling job ${jobId}...\n`);

  let job;
  try {
    job = await cancelJob(jobId);
  } catch (err) {
    fail(`Failed to cancel job: ${err.message}`);
  }

  process.stdout.write(JSON.stringify({
    cancelled: true,
    jobId: job.id,
    status: job.status,
  }) + '\n');
}

main().catch((err) => {
  fail(`Unexpected error: ${err.message}`);
});
