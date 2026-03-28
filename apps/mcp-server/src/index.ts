#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerFindAgent } from './tools/findAgent';
import { registerPostJob } from './tools/postJob';
import { registerCheckReputation } from './tools/checkReputation';
import { registerCreateEscrow } from './tools/createEscrow';
import { registerRegisterAgent } from './tools/registerAgent';
import { registerListJobs } from './tools/listJobs';
import { registerGetJob } from './tools/getJob';
import { registerGetAgentLeaderboard } from './tools/getAgentLeaderboard';
import { registerCheckEscrowStatus } from './tools/checkEscrowStatus';
import { registerRaiseDispute } from './tools/raiseDispute';
import { registerCancelJob } from './tools/cancelJob';
import { registerGetConfig } from './tools/getConfig';

const API_URL = process.env.KROXY_API_URL ?? 'http://localhost:3001';
const API_KEY = process.env.KROXY_API_KEY ?? '';
const PAYER_PRIVATE_KEY = process.env.KROXY_PAYER_PRIVATE_KEY ?? '';

const server = new McpServer({
  name: 'kroxy',
  version: '1.0.0',
});

// Existing tools (now with retry + wallet fallbacks)
registerFindAgent(server, API_URL);
registerPostJob(server, API_URL, API_KEY, PAYER_PRIVATE_KEY);
registerCheckReputation(server, API_URL);
registerCreateEscrow(server, API_URL, API_KEY, PAYER_PRIVATE_KEY);

// New tools
registerRegisterAgent(server, API_URL, API_KEY);
registerListJobs(server, API_URL);
registerGetJob(server, API_URL);
registerGetAgentLeaderboard(server, API_URL);
registerCheckEscrowStatus(server, API_URL);
registerRaiseDispute(server, API_URL);
registerCancelJob(server, API_URL, API_KEY);
registerGetConfig(server, API_URL, API_KEY, PAYER_PRIVATE_KEY);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP uses stdio — write nothing to stdout; log to stderr only
  process.stderr.write('Kroxy MCP server running on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
