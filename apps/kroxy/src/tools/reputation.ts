import { Type } from '@sinclair/typebox';
import { getReputation } from '../client.js';

export const reputationParams = Type.Object({
  wallet: Type.Optional(Type.String({
    description: 'Wallet address to look up. Defaults to KROXY_AGENT_WALLET (your own agent).',
    pattern: '^0x[0-9a-fA-F]{40}$',
  })),
});

export async function executeReputation(
  params: { wallet?: string },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  const walletAddress = params.wallet ?? process.env.KROXY_AGENT_WALLET;
  if (!walletAddress) throw new Error('No wallet address provided and KROXY_AGENT_WALLET is not configured');

  const rep = await getReputation(walletAddress);
  const score = rep.score ?? 0;
  const interpretation =
    score >= 80 ? 'Excellent — highly trusted agent' :
    score >= 60 ? 'Good — established track record' :
    score >= 20 ? 'New — building reputation' :
                  'Low — exercise caution';

  const result = {
    address: walletAddress,
    score,
    successCount: rep.successCount ?? 0,
    disputeCount: rep.disputeCount ?? 0,
    totalEarned: rep.totalEarned ?? '0',
    interpretation,
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result, null, 2),
    }],
    details: result,
  };
}
