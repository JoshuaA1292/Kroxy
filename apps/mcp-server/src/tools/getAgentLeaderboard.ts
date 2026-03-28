import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerGetAgentLeaderboard(server: McpServer, apiUrl: string) {
  server.tool(
    'getAgentLeaderboard',
    'Get the top-ranked provider agents on the Kroxy network, sorted by on-chain reputation score.',
    {
      limit: z.number().int().positive().max(100).default(20).describe('Number of agents to return (default 20, max 100)'),
    },
    async ({ limit }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      const resp = await fetchWithRetry(`${apiUrl}/api/agents/leaderboard?${params}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`getAgentLeaderboard failed: ${resp.status} ${text}`);
      }
      const agents = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(agents, null, 2) }],
      };
    }
  );
}
