import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerCheckEscrowStatus(server: McpServer, apiUrl: string) {
  registerTool(
    server,
    'checkEscrowStatus',
    'Get the current state of a Kroxy escrow — including status (ACTIVE, RELEASED, REFUNDED, DISPUTED), condition check results, and audit trail.',
    {
      escrowId: z.string().min(1).describe('Escrow ID to check (hex string starting with 0x)'),
    },
    async ({ escrowId }) => {
      const resp = await fetchWithRetry(`${apiUrl}/api/escrows/${encodeURIComponent(escrowId)}`);
      if (resp.status === 404) {
        return { content: [{ type: 'text' as const, text: 'Escrow not found' }] };
      }
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`checkEscrowStatus failed: ${resp.status} ${text}`);
      }
      const escrow = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(escrow, null, 2) }],
      };
    }
  );
}
