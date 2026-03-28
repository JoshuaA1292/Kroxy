import { Type } from '@sinclair/typebox';
import { getAgents, listJobs } from '../client.js';

export const browseParams = Type.Object({
  mode: Type.Union(
    [Type.Literal('agents'), Type.Literal('jobs')],
    { description: '"agents" to browse available providers, "jobs" to see the open job board.' },
  ),
  capability: Type.Optional(
    Type.String({ description: 'Filter agents/jobs by capability: research, writing, coding, etc.' }),
  ),
  maxPrice: Type.Optional(
    Type.Number({ minimum: 0.01, description: 'Maximum price per job in USDC.' }),
  ),
  limit: Type.Optional(
    Type.Integer({ minimum: 1, maximum: 50, description: 'Max results to return. Default 10.' }),
  ),
});

function pad(str: string, len: number): string {
  return str.length >= len ? str.slice(0, len) : str + ' '.repeat(len - str.length);
}

export async function executeBrowse(
  params: { mode: 'agents' | 'jobs'; capability?: string; maxPrice?: number; limit?: number },
): Promise<{ content: [{ type: 'text'; text: string }]; details: unknown }> {
  const limit = params.limit ?? 10;

  if (params.mode === 'agents') {
    const agents = await getAgents({
      capability: params.capability,
      maxPrice: params.maxPrice,
    });

    const sliced = agents.slice(0, limit);

    if (sliced.length === 0) {
      const filterDesc = [
        params.capability && `capability="${params.capability}"`,
        params.maxPrice !== undefined && `maxPrice=$${params.maxPrice}`,
      ].filter(Boolean).join(', ');
      return {
        content: [{ type: 'text', text: `No agents found${filterDesc ? ` for ${filterDesc}` : ''}.` }],
        details: { agents: [] },
      };
    }

    const header = params.capability
      ? `Available Agents (${params.capability}${params.maxPrice ? `, ≤$${params.maxPrice}` : ''})`
      : 'Available Agents';

    const lines = [header, '─'.repeat(60)];
    sliced.forEach((agent, i) => {
      const rep = agent.reputationScore !== undefined ? `rep: ${agent.reputationScore}` : 'rep: —';
      const price = `$${parseFloat(agent.pricingUsdc).toFixed(2)} USDC`;
      const caps = agent.capabilities.join(', ');
      lines.push(
        `${i + 1}. ${pad(agent.name, 16)} ${pad(price, 12)} ${pad(rep, 10)} ${caps}`,
      );
    });

    lines.push('', `Showing ${sliced.length} of ${agents.length} agents.`);
    if (sliced.length < agents.length) {
      lines.push('Use limit param or add filters to narrow results.');
    }

    return {
      content: [{ type: 'text', text: lines.join('\n') }],
      details: { agents: sliced },
    };
  }

  // mode === 'jobs'
  const jobs = await listJobs({ status: 'OPEN' });
  const filtered = params.capability
    ? jobs.filter((j) => (j as any).requiredCaps?.includes(params.capability))
    : jobs;
  const sliced = filtered.slice(0, limit);

  if (sliced.length === 0) {
    return {
      content: [{ type: 'text', text: 'No open jobs found.' }],
      details: { jobs: [] },
    };
  }

  const lines = ['Open Job Board', '─'.repeat(60)];
  sliced.forEach((job, i) => {
    const budget = job.budgetMaxUsdc ? `$${parseFloat(job.budgetMaxUsdc).toFixed(2)}` : '?';
    const desc = job.description.slice(0, 60);
    const bids = job.bids?.length ?? 0;
    lines.push(`${i + 1}. [${budget}] ${desc}${job.description.length > 60 ? '…' : ''}  (${bids} bid${bids === 1 ? '' : 's'})`);
    lines.push(`   ID: ${job.id}`);
  });

  lines.push('', `Showing ${sliced.length} of ${filtered.length} open jobs.`);

  return {
    content: [{ type: 'text', text: lines.join('\n') }],
    details: { jobs: sliced },
  };
}
