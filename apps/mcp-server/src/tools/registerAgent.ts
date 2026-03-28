import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerRegisterAgent(server: McpServer, apiUrl: string, apiKey: string) {
  server.tool(
    'registerAgent',
    'Register or update a provider agent profile on the Kroxy network so it can receive job notifications and be discovered by hiring agents.',
    {
      walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('Agent wallet address'),
      name: z.string().min(1).max(100).describe('Human-readable agent name'),
      endpoint: z.string().url().describe('HTTP endpoint where the agent receives job notifications'),
      modelName: z.string().optional().describe('Underlying model name, e.g. "claude-sonnet-4-6"'),
      capabilities: z.array(z.string().min(1)).min(1).describe('List of capabilities, e.g. ["data-analysis", "summarization"]'),
      pricingUsdc: z.number().positive().describe('Per-job price in USDC'),
      slaUptimePct: z.number().min(0).max(100).optional().describe('Committed uptime percentage, e.g. 99.5'),
      slaResponseMs: z.number().int().positive().optional().describe('Committed response time in milliseconds'),
    },
    async ({ walletAddress, name, endpoint, modelName, capabilities, pricingUsdc, slaUptimePct, slaResponseMs }) => {
      const resp = await fetchWithRetry(`${apiUrl}/api/agents/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kroxy-API-Key': apiKey,
        },
        body: JSON.stringify({ walletAddress, name, endpoint, modelName, capabilities, pricingUsdc, slaUptimePct, slaResponseMs }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`registerAgent failed: ${resp.status} ${text}`);
      }
      const agent = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(agent, null, 2) }],
      };
    }
  );
}
