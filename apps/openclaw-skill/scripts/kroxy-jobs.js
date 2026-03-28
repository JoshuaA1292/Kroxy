#!/usr/bin/env node
'use strict';
/**
 * kroxy-jobs.js — Browse the Kroxy job board.
 *
 * Usage (called by OpenClaw when user wants to browse available jobs):
 *   node kroxy-jobs.js
 *   node kroxy-jobs.js --status=OPEN --capability=research --limit=10
 *
 * Required env: KROXY_API_URL
 * Optional env: KROXY_API_KEY
 *
 * Outputs JSON to stdout:
 *   { jobs: [...], total: N }
 *   { error }
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../../.env') });

const argv = require('minimist')(process.argv.slice(2));
const { listJobs } = require('./lib/kroxy-client');

async function main() {
  if (argv.help || argv.h) {
    console.log('Usage: node kroxy-jobs.js [--status=OPEN] [--capability=research] [--limit=20]');
    process.exit(0);
  }

  const status = argv.status || 'OPEN';
  const capability = argv.capability || undefined;
  const limit = argv.limit ? parseInt(argv.limit, 10) : 20;

  let jobs;
  try {
    jobs = await listJobs({ status, capability, limit });
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: `Could not fetch jobs: ${err.message}` }) + '\n');
    process.exit(1);
  }

  process.stdout.write(JSON.stringify({ jobs, total: jobs.length }) + '\n');
}

main().catch((err) => {
  process.stdout.write(JSON.stringify({ error: `Unexpected error: ${err.message}` }) + '\n');
  process.exit(1);
});
