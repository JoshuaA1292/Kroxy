import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { z } from 'zod';
import { computeAddressFromPrivateKey } from '../utils/ethersAddress';
import { fetchWithRetry } from '../utils/fetchWithRetry';

export function registerPostJob(server: McpServer, apiUrl: string, apiKey: string, envPayerPrivateKey: string) {
  const inputSchema: Record<string, z.ZodTypeAny> = {
    posterWallet: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .optional()
      .describe('Wallet address of the hiring agent (omit if KROXY_PAYER_PRIVATE_KEY is set)'),
    description: z.string().min(1).describe('Natural-language description of the job'),
    budgetMaxUsdc: z.number().positive().describe('Maximum budget in USDC, e.g. 10.0'),
    requiredCaps: z.array(z.string()).min(1).describe('Required capabilities, e.g. ["data-analysis"]'),
    deadlineHours: z.number().positive().default(24).describe('Hours until job deadline'),
  };

  registerTool(
    server,
    'postJob',
    'Post a job to the Kroxy job board for provider agents to bid on.',
    inputSchema,
    async (input) => {
      const { posterWallet, description, budgetMaxUsdc, requiredCaps, deadlineHours } = input as {
        posterWallet?: string;
        description: string;
        budgetMaxUsdc: number;
        requiredCaps: string[];
        deadlineHours: number;
      };
      let resolvedWallet = posterWallet;

      if (!resolvedWallet) {
        if (!envPayerPrivateKey) {
          throw new Error(
            'posterWallet is required when KROXY_PAYER_PRIVATE_KEY is not configured. ' +
            'Either pass posterWallet or set KROXY_PAYER_PRIVATE_KEY in your environment.'
          );
        }
        try {
          resolvedWallet = computeAddressFromPrivateKey(envPayerPrivateKey);
        } catch {
          throw new Error('KROXY_PAYER_PRIVATE_KEY is set but is not a valid private key — cannot derive wallet address');
        }
      }

      const deadline = new Date(Date.now() + deadlineHours * 3600 * 1000).toISOString();
      const resp = await fetchWithRetry(`${apiUrl}/api/jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kroxy-API-Key': apiKey,
        },
        body: JSON.stringify({ posterWallet: resolvedWallet, description, budgetMaxUsdc, requiredCaps, deadline }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`postJob failed: ${resp.status} ${text}`);
      }
      const job = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(job, null, 2) }],
      };
    }
  );
}
