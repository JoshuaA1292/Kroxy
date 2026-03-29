#!/usr/bin/env node
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerPostJob } from './tools/postJob';
import { registerSmartMatch } from './tools/smartMatch';
import { registerCreateEscrow } from './tools/createEscrow';
import { registerCheckEscrowStatus } from './tools/checkEscrowStatus';

const API_URL = process.env.KROXY_API_URL ?? 'http://localhost:3001';
const API_KEY = process.env.KROXY_API_KEY ?? '';
const PAYER_PRIVATE_KEY = process.env.KROXY_PAYER_PRIVATE_KEY ?? '';

const server = new McpServer({
  name: 'kroxy',
  version: '1.0.0',
});

registerPostJob(server, API_URL, API_KEY, PAYER_PRIVATE_KEY);
registerSmartMatch(server, API_URL);
registerCreateEscrow(server, API_URL, API_KEY, PAYER_PRIVATE_KEY);
registerCheckEscrowStatus(server, API_URL);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('Kroxy MCP server running on stdio\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
