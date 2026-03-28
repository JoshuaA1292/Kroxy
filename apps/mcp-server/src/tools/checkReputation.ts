import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerCheckReputation(server: McpServer, apiUrl: string) {
  server.tool(
    'checkReputation',
    'Check the on-chain reputation score for a wallet address on the Kroxy network.',
    {
      address: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('Ethereum wallet address to check'),
    },
    async ({ address }) => {
      const resp = await fetchWithRetry(`${apiUrl}/api/reputation/${address}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`checkReputation failed: ${resp.status} ${text}`);
      }
      const rep = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(rep, null, 2) }],
      };
    }
  );
}
