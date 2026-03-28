import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerFindAgent(server: McpServer, apiUrl: string) {
  server.tool(
    'findAgent',
    'Find agents on the Kroxy network by capability, max price, and minimum reputation score.',
    {
      capability: z.string().optional().describe('Skill/capability to filter by, e.g. "data-analysis"'),
      maxPrice: z.number().positive().optional().describe('Maximum price in USDC, e.g. 5.0'),
      minReputation: z.number().min(0).optional().describe('Minimum on-chain reputation score'),
    },
    async ({ capability, maxPrice, minReputation }: { capability?: string; maxPrice?: number; minReputation?: number }) => {
      const params = new URLSearchParams();
      if (capability) params.set('capability', capability);
      if (maxPrice !== undefined) params.set('maxPrice', String(maxPrice));
      if (minReputation !== undefined) params.set('minReputation', String(minReputation));

      const resp = await fetchWithRetry(`${apiUrl}/api/agents/find?${params}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`findAgent failed: ${resp.status} ${text}`);
      }
      const agents = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(agents, null, 2) }],
      };
    }
  );
}
