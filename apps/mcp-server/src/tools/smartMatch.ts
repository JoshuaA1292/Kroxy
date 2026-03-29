import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerTool } from '../utils/registerTool';
import { z } from 'zod';
import { fetchWithRetry } from '../utils/fetchWithRetry';
import { lavaAnthropic, lavaAvailable } from '../utils/lava';

/**
 * smartMatch — Lava-powered intelligent agent selection.
 *
 * Given a natural-language task description, this tool:
 *   1. Fetches all available agents from the Kroxy registry
 *   2. Calls Claude (via Lava's forward proxy) to reason about which agent
 *      is the best fit given capability, price, reputation, and task semantics
 *   3. Returns the ranked recommendation with an explanation
 *
 * This is the showcase integration for the Lava Agent MCP bonus track:
 * every recommendation call flows through Lava's AI gateway.
 */

interface Agent {
  walletAddress: string;
  name?: string;
  capability?: string;
  priceUsdc?: number | string;
  reputationScore?: number;
  endpoint?: string;
}

function isAgent(value: unknown): value is Agent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.walletAddress === 'string';
}

export function registerSmartMatch(server: McpServer, apiUrl: string) {
  const inputSchema: Record<string, z.ZodTypeAny> = {
    task: z.string().min(10).describe(
      'Natural-language description of the task you want completed, e.g. "Summarize this 50-page PDF into bullet points"'
    ),
    maxBudgetUsdc: z.number().positive().optional().describe(
      'Maximum budget in USDC. Agents above this price will be excluded.'
    ),
  };

  registerTool(
    server,
    'smartMatch',
    `Intelligently match a task to the best available agent using AI reasoning via Lava's gateway.
Describe your task in plain English — the tool fetches all agents and uses Claude (routed through Lava)
to pick the most suitable provider based on capability, price, reputation, and task semantics.
Returns a ranked recommendation with a clear explanation.`,
    inputSchema,
    async (input) => {
      const { task, maxBudgetUsdc } = input as { task: string; maxBudgetUsdc?: number };
      // ── 1. Fetch available agents ─────────────────────────────────────────
      const params = new URLSearchParams();
      if (maxBudgetUsdc !== undefined) params.set('maxPrice', String(maxBudgetUsdc));

      const resp = await fetchWithRetry(`${apiUrl}/api/agents/find?${params}`);
      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Failed to fetch agents: ${resp.status} ${text}`);
      }

      const rawAgents: unknown = await resp.json();
      if (!Array.isArray(rawAgents)) {
        throw new Error('Failed to fetch agents: API returned a non-array response');
      }
      const agents = rawAgents.filter(isAgent);

      if (agents.length === 0) {
        return {
          content: [{
            type: 'text' as const,
            text: 'No agents are currently available on the Kroxy network. Try again later or broaden your budget.',
          }],
        };
      }

      // ── 2. Ask Claude (via Lava) to rank agents for this task ─────────────
      const via = lavaAvailable() ? 'Lava gateway' : 'direct Anthropic';

      const agentSummary = agents.slice(0, 20).map((a, i) => (
        `[${i + 1}] address=${a.walletAddress} capability=${a.capability ?? 'general'} ` +
        `price=${a.priceUsdc ?? '?'} USDC reputation=${a.reputationScore ?? 'unrated'} ` +
        `name=${a.name ?? 'unnamed'}`
      )).join('\n');

      const systemPrompt =
        `You are an intelligent agent broker for the Kroxy AI payment network. ` +
        `Given a task and a list of available agents, select the single best match. ` +
        `Weigh: (1) capability alignment, (2) reputation score (higher = more reliable), ` +
        `(3) price (lower is better when capability is equal). ` +
        `Respond ONLY with JSON: ` +
        `{"agentIndex":1,"walletAddress":"0x...","reasoning":"2-3 sentences","confidence":0.0-1.0,"alternatives":[1,2]}`;

      const userPrompt =
        `Task: ${task}\n\nAvailable agents:\n${agentSummary}`;

      let recommendation: {
        agentIndex: number;
        walletAddress: string;
        reasoning: string;
        confidence: number;
        alternatives?: number[];
      };

      try {
        const raw = await lavaAnthropic({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 256,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        });
        const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
        recommendation = JSON.parse(cleaned);
      } catch {
        // LLM unavailable — fall back to highest-reputation agent
        const best = [...agents].sort(
          (a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0)
        )[0];
        recommendation = {
          agentIndex: 1,
          walletAddress: best.walletAddress,
          reasoning: 'LLM matching unavailable — selected highest-reputation agent as fallback.',
          confidence: 0.5,
        };
      }

      // ── 3. Build output ───────────────────────────────────────────────────
      const picked = agents.find(a => a.walletAddress === recommendation.walletAddress)
        ?? agents[recommendation.agentIndex - 1]
        ?? agents[0];

      const lines = [
        `Smart Match Result  (AI via ${via})`,
        `${'─'.repeat(52)}`,
        `Task:         ${task.slice(0, 80)}`,
        ``,
        `Best Agent:   ${picked.name ?? picked.walletAddress}`,
        `Address:      ${picked.walletAddress}`,
        `Capability:   ${picked.capability ?? 'general'}`,
        `Price:        ${picked.priceUsdc ?? '?'} USDC`,
        `Reputation:   ${picked.reputationScore ?? 'unrated'}`,
        `Confidence:   ${Math.round((recommendation.confidence ?? 0) * 100)}%`,
        ``,
        `Reasoning:    ${recommendation.reasoning}`,
      ];

      if (recommendation.alternatives?.length) {
        const altNames = recommendation.alternatives
          .map(i => agents[i - 1])
          .filter(Boolean)
          .map(a => a.name ?? a.walletAddress.slice(0, 10) + '…');
        if (altNames.length) lines.push(``, `Alternatives: ${altNames.join(', ')}`);
      }

      lines.push(
        ``,
        `Next step: call kroxy_hire with task="${task}" and the agent address above.`
      );

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') }],
      };
    }
  );
}
