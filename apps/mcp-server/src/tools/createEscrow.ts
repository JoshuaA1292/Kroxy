import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';

const ConditionSchema = z.object({
  type: z.enum(['http_status', 'json_field', 'latency_ms', 'uptime_percent', 'deliverable_quality']),
  endpoint: z.string().url(),
  field: z.string().optional(),
  operator: z.enum(['eq', 'gte', 'lte', 'gt', 'lt', 'contains']),
  expected: z.union([z.string(), z.number(), z.boolean(), z.object({}).passthrough()]),
});

// Full ConditionsDefinition shape matching the API (escrowId is filled by the SDK,
// pass an empty string here).
const ConditionsDefinitionSchema = z.object({
  version: z.literal('1.0'),
  escrowId: z.string().default(''),
  conditions: z.array(ConditionSchema).min(1),
  windowSeconds: z.number().int().positive(),
  checkIntervalSeconds: z.number().int().positive(),
  requiredPassRate: z.number().min(0).max(1),
});

export function registerCreateEscrow(server: McpServer, apiUrl: string, apiKey: string, envPayerPrivateKey: string) {
  const inputSchema: Record<string, z.ZodTypeAny> = {
    payerPrivateKey: z
      .string()
      .optional()
      .describe('Private key of the paying agent (omit if KROXY_PAYER_PRIVATE_KEY is set; kept server-side, TLS-protected)'),
    payeeAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/).describe('Recipient wallet address'),
    amountUsdc: z.number().positive().describe('Amount in USDC, e.g. 5.0'),
    conditions: ConditionsDefinitionSchema.describe('Full conditions definition — version, conditions array, window, interval, passRate'),
    x402Reference: z.string().describe('Payment reference string for the x402 protocol'),
  };

  registerTool(
    server,
    'createEscrow',
    'Create a conditional USDC escrow on the Kroxy network. Funds are released when HTTP conditions pass.',
    inputSchema,
    async (input) => {
      const { payerPrivateKey, payeeAddress, amountUsdc, conditions, x402Reference } = input as {
        payerPrivateKey?: string;
        payeeAddress: string;
        amountUsdc: number;
        conditions: unknown;
        x402Reference: string;
      };
      const resolvedKey = payerPrivateKey ?? envPayerPrivateKey;
      if (!resolvedKey) {
        throw new Error(
          'payerPrivateKey is required. Either pass it in the tool call or set KROXY_PAYER_PRIVATE_KEY in your environment.'
        );
      }

      const resp = await fetchWithRetry(`${apiUrl}/api/escrows/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Kroxy-API-Key': apiKey,
        },
        body: JSON.stringify({
          payerPrivateKey: resolvedKey,
          payeeAddress,
          amountUsdc,
          conditions,
          x402Reference,
        }),
      });
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`createEscrow failed: ${resp.status} ${text}`);
      }
      const result = await resp.json();
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      };
    }
  );
}
