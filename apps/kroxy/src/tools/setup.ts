import { Type } from '@sinclair/typebox';
import { createHash } from 'node:crypto';
import { pingApi } from '../client.js';

export const setupParams = Type.Object({});

type CheckStatus = 'ok' | 'warn' | 'error';

interface CheckItem {
  item: string;
  status: CheckStatus;
  value?: string;
  hint?: string;
}

function icon(s: CheckStatus): string {
  return s === 'ok' ? '✅' : s === 'warn' ? '⚠️ ' : '❌';
}

function maskKey(key: string): string {
  if (key.length <= 8) return '***';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function maskWallet(wallet: string): string {
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

/** Generate a deterministic demo wallet address from a seed. Not a real key. */
function demoDerivedAddress(): string {
  const hash = createHash('sha256').update('kroxy-demo-wallet').digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

export async function executeSetup(
  _params: Record<string, never>,
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  const apiUrl = process.env.KROXY_API_URL ?? 'http://localhost:3001';
  const apiKey = process.env.KROXY_API_KEY;
  const wallet = process.env.KROXY_AGENT_WALLET;
  const privateKey = process.env.KROXY_AGENT_PRIVATE_KEY;
  const demoMode = process.env.KROXY_DEMO_MODE === '1';
  const nexusUrl = process.env.NEXUS_URL;

  const checks: CheckItem[] = [];
  let blockingIssues = 0;

  // 1. API connectivity
  const apiReachable = await pingApi();
  checks.push({
    item: 'API connectivity',
    status: apiReachable ? 'ok' : 'error',
    value: apiUrl,
    hint: apiReachable
      ? undefined
      : `Cannot reach ${apiUrl}. Start the API or set KROXY_API_URL to a running instance.`,
  });
  if (!apiReachable) blockingIssues++;

  // 2. Demo mode
  checks.push({
    item: 'Demo mode',
    status: demoMode ? 'warn' : 'ok',
    value: demoMode ? 'ON (no real USDC will move)' : 'OFF (live Base mainnet)',
    hint: demoMode
      ? 'Demo mode active — fake tx hashes, no real wallet needed. Set KROXY_DEMO_MODE=1 to enable.'
      : 'Set KROXY_DEMO_MODE=1 for a sandbox demo without real money.',
  });

  // 3. API key
  if (apiKey) {
    checks.push({ item: 'API key (KROXY_API_KEY)', status: 'ok', value: maskKey(apiKey) });
  } else {
    checks.push({
      item: 'API key (KROXY_API_KEY)',
      status: 'error',
      hint: 'Required for posting jobs and hiring agents. Set in plugin config.',
    });
    blockingIssues++;
  }

  // 4. Agent wallet
  let suggestedWallet: string | undefined;
  if (wallet) {
    checks.push({ item: 'Agent wallet (KROXY_AGENT_WALLET)', status: 'ok', value: maskWallet(wallet) });
  } else if (demoMode) {
    suggestedWallet = demoDerivedAddress();
    checks.push({
      item: 'Agent wallet (KROXY_AGENT_WALLET)',
      status: 'warn',
      value: `auto-generated for demo: ${maskWallet(suggestedWallet)}`,
      hint: `In demo mode a wallet is auto-generated. Set KROXY_AGENT_WALLET=${suggestedWallet} to make it permanent.`,
    });
  } else {
    checks.push({
      item: 'Agent wallet (KROXY_AGENT_WALLET)',
      status: 'error',
      hint: 'Required to post jobs and receive payments. Provide a Base mainnet wallet address.',
    });
    blockingIssues++;
  }

  // 5. Private key (only needed in live mode for hiring)
  if (demoMode) {
    checks.push({ item: 'Private key (KROXY_AGENT_PRIVATE_KEY)', status: 'ok', value: 'not needed in demo mode' });
  } else if (privateKey) {
    checks.push({ item: 'Private key (KROXY_AGENT_PRIVATE_KEY)', status: 'ok', value: '******* (set)' });
  } else {
    checks.push({
      item: 'Private key (KROXY_AGENT_PRIVATE_KEY)',
      status: 'warn',
      hint: 'Needed to hire agents (sign escrow tx). Not required for read-only tools.',
    });
  }

  // 6. Nexus URL (optional)
  checks.push({
    item: 'Nexus URL (NEXUS_URL)',
    status: nexusUrl ? 'ok' : 'warn',
    value: nexusUrl ?? 'http://localhost:3003 (default)',
    hint: nexusUrl ? undefined : 'Using default. Set NEXUS_URL if your provider agent is on a different host.',
  });

  // Determine overall status
  let overallStatus: 'ready' | 'demo_ready' | 'needs_config';
  let nextStep: string;

  if (blockingIssues === 0) {
    overallStatus = demoMode ? 'demo_ready' : 'ready';
    nextStep = demoMode
      ? 'All good! Try: kroxy_hire with task="Research top AI startups" and maxPrice=2.5'
      : 'All good! Use kroxy_hire to post your first job.';
  } else {
    overallStatus = 'needs_config';
    const firstError = checks.find((c) => c.status === 'error');
    nextStep = firstError?.hint ?? 'Fix the errors above to get started.';
  }

  const lines = [
    `Kroxy Setup — ${overallStatus === 'ready' ? '✅ Ready' : overallStatus === 'demo_ready' ? '✅ Demo Ready' : '❌ Needs Config'}`,
    '',
    ...checks.map((c) => `${icon(c.status)} ${c.item}${c.value ? `: ${c.value}` : ''}${c.hint ? `\n     ${c.hint}` : ''}`),
    '',
    `Next step: ${nextStep}`,
  ];

  if (suggestedWallet) {
    lines.push('', `💡 Suggested wallet for demo: ${suggestedWallet}`);
  }

  const result = {
    status: overallStatus,
    checklist: checks,
    nextStep,
    suggestedDemoWallet: suggestedWallet,
  };

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: result,
  };
}
