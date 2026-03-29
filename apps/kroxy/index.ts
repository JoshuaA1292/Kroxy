import type { OpenClawPluginApi } from 'openclaw/plugin-sdk';
import { createHash } from 'node:crypto';
import { hireParams, executeHire } from './src/tools/hire.js';
import { offerParams, executeOffer } from './src/tools/offer.js';
import { reputationParams, executeReputation } from './src/tools/reputation.js';
import { setupParams, executeSetup } from './src/tools/setup.js';
import { statusParams, executeStatus } from './src/tools/status.js';
import { balanceParams, executeBalance } from './src/tools/balance.js';
import { browseParams, executeBrowse } from './src/tools/browse.js';
import { disputeParams, executeDispute } from './src/tools/dispute.js';
import { historyParams, executeHistory } from './src/tools/history.js';
import { autoagentParams, executeAutoagent } from './src/tools/autoagent.js';

type ReputationToolParams = Parameters<typeof executeReputation>[0];
type OfferToolParams = Parameters<typeof executeOffer>[0];
type HireToolParams = Parameters<typeof executeHire>[0];
type SetupToolParams = Parameters<typeof executeSetup>[0];
type StatusToolParams = Parameters<typeof executeStatus>[0];
type BalanceToolParams = Parameters<typeof executeBalance>[0];
type BrowseToolParams = Parameters<typeof executeBrowse>[0];
type DisputeToolParams = Parameters<typeof executeDispute>[0];
type HistoryToolParams = Parameters<typeof executeHistory>[0];
type AutoagentToolParams = Parameters<typeof executeAutoagent>[0];

const DEFAULT_API_URL = 'https://api-production-1b45.up.railway.app';

function demoDerivedAddress(): string {
  const hash = createHash('sha256').update('kroxy-demo-wallet').digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

export default {
  id: 'kroxy',
  name: 'Kroxy',
  register(api: OpenClawPluginApi) {
    const cfg = (api.pluginConfig ?? {}) as Record<string, string>;
    if (cfg.KROXY_API_URL) process.env.KROXY_API_URL = cfg.KROXY_API_URL;
    if (cfg.KROXY_API_KEY) process.env.KROXY_API_KEY = cfg.KROXY_API_KEY;
    if (cfg.KROXY_AGENT_WALLET) process.env.KROXY_AGENT_WALLET = cfg.KROXY_AGENT_WALLET;
    if (cfg.KROXY_AGENT_PRIVATE_KEY) process.env.KROXY_AGENT_PRIVATE_KEY = cfg.KROXY_AGENT_PRIVATE_KEY;
    if (cfg.KROXY_DEMO_MODE) process.env.KROXY_DEMO_MODE = cfg.KROXY_DEMO_MODE;
    if (cfg.NEXUS_URL) process.env.NEXUS_URL = cfg.NEXUS_URL;

    if (!process.env.KROXY_API_URL) process.env.KROXY_API_URL = DEFAULT_API_URL;
    if (!process.env.KROXY_DEMO_MODE && !process.env.KROXY_AGENT_PRIVATE_KEY) process.env.KROXY_DEMO_MODE = '1';
    if (process.env.KROXY_DEMO_MODE === '1' && !process.env.KROXY_AGENT_WALLET) {
      process.env.KROXY_AGENT_WALLET = demoDerivedAddress();
    }

    // ── Setup / Onboarding ────────────────────────────────────────────────────
    // Run this first to check configuration and get guided setup instructions.
    api.registerTool({
      name: 'kroxy_setup',
      label: 'Kroxy Setup',
      description:
        'Check your Kroxy configuration and connectivity. Run this first to diagnose any setup issues. ' +
        'Shows API reachability, demo mode status, wallet config, and what to fix next.',
      parameters: setupParams,
      async execute(_id: string, params: SetupToolParams) {
        return executeSetup(params);
      },
    });

    // ── Read-only tools — always available ────────────────────────────────────

    api.registerTool({
      name: 'kroxy_reputation',
      label: 'Kroxy Reputation',
      description:
        'Check the on-chain reputation score of any agent on the Kroxy network. ' +
        'Use before hiring to verify trustworthiness. Defaults to your own agent wallet.',
      parameters: reputationParams,
      async execute(_id: string, params: ReputationToolParams) {
        return executeReputation(params);
      },
    });

    api.registerTool({
      name: 'kroxy_status',
      label: 'Kroxy Job Status',
      description:
        'Check the status of an active job mid-flight. Shows current status, agent assigned, ' +
        'escrow amount, and time elapsed. Use after kroxy_hire with the returned jobId.',
      parameters: statusParams,
      async execute(_id: string, params: StatusToolParams) {
        return executeStatus(params);
      },
    });

    api.registerTool({
      name: 'kroxy_balance',
      label: 'Kroxy Balance',
      description:
        'Check your USDC balance, pending escrow totals, and total earned in one call. ' +
        'Defaults to your own agent wallet (KROXY_AGENT_WALLET).',
      parameters: balanceParams,
      async execute(_id: string, params: BalanceToolParams) {
        return executeBalance(params);
      },
    });

    api.registerTool({
      name: 'kroxy_browse',
      label: 'Kroxy Browse',
      description:
        'Browse available agents on the Kroxy network or view the open job board. ' +
        'Filter by capability and price. Use mode="agents" to find providers, mode="jobs" for open work.',
      parameters: browseParams,
      async execute(_id: string, params: BrowseToolParams) {
        return executeBrowse(params);
      },
    });

    api.registerTool({
      name: 'kroxy_history',
      label: 'Kroxy History',
      description:
        'View your full job history — tasks hired, amounts paid, durations, and escrow tx hashes. ' +
        'Provides a full audit trail for any agent wallet.',
      parameters: historyParams,
      async execute(_id: string, params: HistoryToolParams) {
        return executeHistory(params);
      },
    });

    // ── Mutating tools — require configuration ────────────────────────────────

    // Register your agent as a paid service provider on the Kroxy job board.
    api.registerTool(
      {
        name: 'kroxy_offer',
        label: 'Kroxy Offer',
        description:
          'List your agent as a service provider on the Kroxy job board to earn USDC. ' +
          'Requires KROXY_AGENT_WALLET and a public endpoint that can receive job webhooks.',
        parameters: offerParams,
        async execute(_id: string, params: OfferToolParams) {
          return executeOffer(params);
        },
      },
      { optional: true },
    );

    // Hire another agent with USDC held in conditional escrow on Base.
    api.registerTool(
      {
        name: 'kroxy_hire',
        label: 'Kroxy Hire',
        description:
          'Hire a specialist agent to complete a task, paid in USDC via conditional escrow on Base. ' +
          'Funds are locked until work quality is verified — payment is automatic and trustless. ' +
          'Requires KROXY_AGENT_WALLET. Set KROXY_DEMO_MODE=1 to try without a real private key.',
        parameters: hireParams,
        async execute(_id: string, params: HireToolParams) {
          return executeHire(params);
        },
      },
      { optional: true },
    );

    // Raise a dispute on a job in escrow.
    api.registerTool(
      {
        name: 'kroxy_dispute',
        label: 'Kroxy Dispute',
        description:
          'Raise a dispute on a job that is in escrow. Triggers arbitration by three independent ' +
          'AI judges (Claude, GPT-4o, Gemini). Use when the delivered work does not meet requirements. ' +
          'Requires KROXY_API_KEY.',
        parameters: disputeParams,
        async execute(_id: string, params: DisputeToolParams) {
          return executeDispute(params);
        },
      },
      { optional: true },
    );

    // Autonomous multi-step goal orchestrator.
    api.registerTool(
      {
        name: 'kroxy_autoagent',
        label: 'Kroxy AutoAgent',
        description:
          'Autonomous orchestrator: takes a high-level goal, decomposes it into specialist subtasks ' +
          '(research, writing, coding, planning), hires the best agent for each via Kroxy escrow, ' +
          'and returns a unified deliverable. Set LAVA_SECRET_KEY + ANTHROPIC_API_KEY for LLM decomposition, or it ' +
          'falls back to keyword-based routing. Requires KROXY_AGENT_WALLET.',
        parameters: autoagentParams,
        async execute(_id: string, params: AutoagentToolParams) {
          return executeAutoagent(params);
        },
      },
      { optional: true },
    );
  },
};
