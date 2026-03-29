import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerListJobs(server: McpServer, apiUrl: string) {
  registerTool(
    server,
    'listJobs',
    'Browse jobs on the Kroxy job board. Filter by status, capability, or limit the number of results.',
    {
      status: z.string().optional().describe('Filter by status: OPEN, AWARDED, IN_PROGRESS, COMPLETED, CANCELLED'),
      capability: z.string().optional().describe('Filter by required capability, e.g. "data-analysis"'),
      limit: z.number().int().positive().max(200).optional().describe('Maximum results to return (default 50, max 200)'),
    },
    async ({ status, capability, limit }) => {
      const params = new URLSearchParams();
      if (status) params.set('status', status);
      if (capability) params.set('capability', capability);
      if (limit !== undefined) params.set('limit', String(limit));

      const resp = await fetchWithRetry(`${apiUrl}/api/jobs?${params}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`listJobs failed: ${resp.status} ${text}`);
      }
      const jobs = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(jobs, null, 2) }],
      };
    }
  );
}
