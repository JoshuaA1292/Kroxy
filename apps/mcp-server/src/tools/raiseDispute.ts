import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerRaiseDispute(server: McpServer, apiUrl: string) {
  const inputSchema: Record<string, z.ZodTypeAny> = {
    escrowId: z.string().min(1).describe('Escrow ID to dispute (hex string starting with 0x)'),
    reason: z.string().min(1).describe('Human-readable reason for the dispute'),
    evidenceData: z
      .object({})
      .passthrough()
      .optional()
      .describe('Optional structured evidence (JSON object with any fields)'),
  };

  registerTool(
    server,
    'raiseDispute',
    'Raise a dispute on an active Kroxy escrow. Funds are frozen on-chain pending arbitration.',
    inputSchema,
    async (input) => {
      const { escrowId, reason, evidenceData } = input as {
        escrowId: string;
        reason: string;
        evidenceData?: Record<string, unknown>;
      };
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
