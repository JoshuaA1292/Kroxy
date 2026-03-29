import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerCancelJob(server: McpServer, apiUrl: string, apiKey: string) {
  registerTool(
    server,
    'cancelJob',
    'Cancel an OPEN job on the Kroxy job board. Only jobs in OPEN status (no accepted bid) can be cancelled.',
    {
      jobId: z.string().min(1).describe('ID of the OPEN job to cancel'),
    },
    async ({ jobId }) => {
      const resp = await fetchWithRetry(
        `${apiUrl}/api/jobs/${encodeURIComponent(jobId)}/cancel`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Kroxy-API-Key': apiKey,
          },
        }
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`cancelJob failed: ${resp.status} ${text}`);
      }
      const job = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(job, null, 2) }],
      };
    }
  );
}
