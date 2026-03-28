import { Type } from '@sinclair/typebox';
import { getWalletBalance } from '../client.js';

export const balanceParams = Type.Object({
  wallet: Type.Optional(
    Type.String({
      description: 'Wallet address to check. Defaults to KROXY_AGENT_WALLET (your own agent).',
      pattern: '^0x[0-9a-fA-F]{40}$',
    }),
  ),
});

export async function executeBalance(
  params: { wallet?: string },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  const walletAddress = params.wallet ?? process.env.KROXY_AGENT_WALLET;
  if (!walletAddress) {
    throw new Error(
      'No wallet address provided and KROXY_AGENT_WALLET is not configured. ' +
      'Pass a wallet address or set KROXY_AGENT_WALLET in plugin config.',
    );
  }

  if (!/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
    throw new Error(`Invalid wallet address: ${walletAddress}. Must be 0x + 40 hex chars.`);
  }

  const balance = await getWalletBalance(walletAddress);

  const escrowLine = balance.pendingEscrowCount > 0
    ? `$${balance.pendingEscrow} USDC  (${balance.pendingEscrowCount} active job${balance.pendingEscrowCount === 1 ? '' : 's'})`
    : '$0.00  (no active jobs)';

  const lines = [
    `Balance: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}${balance.demo ? ' (demo)' : ''}`,
    `─────────────────────────────────────`,
    `USDC Balance:   $${balance.usdcBalance}`,
    `Pending Escrow: ${escrowLine}`,
    `Total Earned:   $${balance.totalEarned} USDC`,
  ];

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: balance,
  };
}
