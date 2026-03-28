import { Type } from '@sinclair/typebox';
import { listJobs } from '../client.js';

export const historyParams = Type.Object({
  wallet: Type.Optional(
    Type.String({
      description: 'Wallet address to fetch history for. Defaults to KROXY_AGENT_WALLET.',
      pattern: '^0x[0-9a-fA-F]{40}$',
    }),
  ),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 50, description: 'Number of jobs to return. Default 10.' }),
  ),
});

const STATUS_ICONS: Record<string, string> = {
  COMPLETED: '✅',
  IN_PROGRESS: '🔵',
  AWARDED: '🟠',
  OPEN: '🟡',
  CANCELLED: '⛔',
  DISPUTED: '⚖️ ',
};

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

export async function executeHistory(
  params: { wallet?: string; limit?: number },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  const wallet = params.wallet ?? process.env.KROXY_AGENT_WALLET;
  if (!wallet) {
    throw new Error(
      'No wallet address provided and KROXY_AGENT_WALLET is not configured. ' +
      'Pass a wallet address or set KROXY_AGENT_WALLET in plugin config.',
    );
  }

  const limit = params.limit ?? 10;
  const jobs = await listJobs({ posterWallet: wallet, limit });

  const displayWallet = `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;

  if (jobs.length === 0) {
    return {
      content: [{ type: 'text', text: `No job history found for ${displayWallet}.` }],
      details: { wallet, jobs: [] },
    };
  }

  const lines = [`Job History — ${displayWallet} (last ${jobs.length})`, '─'.repeat(70)];

  jobs.forEach((job, i) => {
    const icon = STATUS_ICONS[job.status] ?? '  ';
    const desc = job.description.slice(0, 45);
    const budget = job.budgetMaxUsdc ? `$${parseFloat(job.budgetMaxUsdc).toFixed(2)}` : '  —  ';
    const escrow = job.escrowId ? `  escrow: ${job.escrowId.slice(0, 16)}...` : '';

    lines.push(`${i + 1}. ${icon} ${pad(job.status, 12)} ${pad(desc, 47)}${budget}${escrow}`);
    lines.push(`   ID: ${job.id}${job.escrowId ? '' : ''}`);
  });

  lines.push('');
  const completed = jobs.filter((j) => j.status === 'COMPLETED').length;
  const disputed = jobs.filter((j) => (j.status as string) === 'DISPUTED').length;
  lines.push(`Summary: ${completed} completed, ${disputed} disputed, ${jobs.length} total shown`);

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: { wallet, jobs },
  };
}
