import { Type } from '@sinclair/typebox';
import { registerProvider } from '../client.js';

export const offerParams = Type.Object({
  capability: Type.String({ description: 'Capability to offer: research, writing, coding, analysis, etc.' }),
  price: Type.Number({ minimum: 0.01, description: 'Price per job in USDC, e.g. 2.50' }),
  endpoint: Type.String({ description: 'Public URL where your agent receives job webhooks, e.g. https://myagent.example.com' }),
  name: Type.Optional(Type.String({ description: 'Display name for your agent on the Kroxy job board' })),
});

export async function executeOffer(
  params: { capability: string; price: number; endpoint: string; name?: string },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  const wallet = process.env.KROXY_AGENT_WALLET;
  if (!wallet) throw new Error('KROXY_AGENT_WALLET is not configured');

  const agent = await registerProvider({
    walletAddress: wallet,
    name: params.name ?? 'MyAgent',
    endpoint: params.endpoint,
    capabilities: [params.capability],
    pricingUsdc: params.price,
  });

  const result = {
    registered: true,
    walletAddress: agent.walletAddress ?? wallet,
    name: agent.name ?? params.name,
    capabilities: agent.capabilities ?? [params.capability],
    pricingUsdc: agent.pricingUsdc ?? params.price,
    endpoint: params.endpoint,
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
    details: result,
  };
}
