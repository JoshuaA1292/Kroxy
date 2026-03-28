import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerGetJob(server: McpServer, apiUrl: string) {
  server.tool(
    'getJob',
    'Get full details for a single job on the Kroxy job board, including all bids.',
    {
      jobId: z.string().min(1).describe('Job ID to retrieve'),
    },
    async ({ jobId }) => {
      const resp = await fetchWithRetry(`${apiUrl}/api/jobs/${encodeURIComponent(jobId)}`);
      if (resp.status === 404) {
        return { content: [{ type: 'text' as const, text: 'Job not found' }] };
      }
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`getJob failed: ${resp.status} ${text}`);
      }
      const job = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(job, null, 2) }],
      };
    }
  );
}
