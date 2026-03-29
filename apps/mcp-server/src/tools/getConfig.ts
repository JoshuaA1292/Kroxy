import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { computeAddressFromPrivateKey } from '../utils/ethersAddress';

export function registerGetConfig(
  server: McpServer,
  apiUrl: string,
  apiKey: string,
  payerPrivateKey: string
) {
  registerTool(
    server,
    'getConfig',
    'Show the current Kroxy MCP server configuration — which environment variables are set and what wallet address is active.',
    {},
    async () => {
      const apiKeyStatus = apiKey ? '[SET]' : '[NOT SET]';

      let keyStatus: string;
      if (!payerPrivateKey) {
        keyStatus = '[NOT SET]';
      } else {
        try {
          const address = computeAddressFromPrivateKey(payerPrivateKey);
          // Show first 6 chars (0x + 4) and last 4 chars
          const masked = `${address.slice(0, 6)}...${address.slice(-4)}`;
          keyStatus = `[SET — wallet: ${masked}]`;
        } catch {
          keyStatus = '[SET — invalid key format]';
        }
      }

      const lines = [
        'Kroxy MCP Configuration',
        '=======================',
        `KROXY_API_URL:           ${apiUrl}`,
        `KROXY_API_KEY:           ${apiKeyStatus}`,
        `KROXY_PAYER_PRIVATE_KEY: ${keyStatus}`,
        '',
      ];

      const missing: string[] = [];
      if (!apiKey) missing.push('KROXY_API_KEY (required for postJob, createEscrow, registerAgent, cancelJob)');
      if (!payerPrivateKey) missing.push('KROXY_PAYER_PRIVATE_KEY (enables wallet-free calls to postJob and createEscrow)');

      if (missing.length === 0) {
        lines.push('Status: Ready — all configuration is set.');
      } else {
        lines.push('Missing:');
        for (const m of missing) lines.push(`  • ${m}`);
      }

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    }
  );
}
