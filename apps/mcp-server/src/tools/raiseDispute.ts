import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerRaiseDispute(server: McpServer, apiUrl: string) {
  server.tool(
    'raiseDispute',
    'Raise a dispute on an active Kroxy escrow. Funds are frozen on-chain pending arbitration.',
    {
      escrowId: z.string().min(1).describe('Escrow ID to dispute (hex string starting with 0x)'),
      reason: z.string().min(1).describe('Human-readable reason for the dispute'),
      evidenceData: z
        .record(z.unknown())
        .optional()
        .describe('Optional structured evidence (JSON object with any fields)'),
    },
    async ({ escrowId, reason, evidenceData }) => {
      const resp = await fetchWithRetry(
        `${apiUrl}/api/escrows/${encodeURIComponent(escrowId)}/dispute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason, evidenceData }),
        }
      );
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`raiseDispute failed: ${resp.status} ${text}`);
      }
      const result = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
