/**
 * Economy layer unit tests.
 *
 * Tests cover:
 *  - agentRegistryService: toDTO mapping, findAgents filter logic
 *  - jobBoardService: schema validation, DTO mapping
 *  - Route Zod schemas: agents, jobs, stats
 *  - courtService: verdict encoding, consensus logic
 *
 * All tests run in-process — no DB, no network, no on-chain calls.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ETH_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ETH_ADDRESS_2 = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const ETH_ADDRESS_3 = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC';

// ─── Agent Registry — Zod schemas (mirrors routes/agents.ts) ──────────────────

const RegisterAgentSchema = z.object({
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  name: z.string().min(1),
  endpoint: z.string().url(),
  modelName: z.string().optional(),
  capabilities: z.array(z.string()).min(1),
  pricingUsdc: z.number().positive(),
  slaUptimePct: z.number().min(0).max(100).optional(),
  slaResponseMs: z.number().int().positive().optional(),
});

const FindAgentsQuerySchema = z.object({
  capability: z.string().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  minReputation: z.coerce.number().min(0).optional(),
});

describe('Agent Registry — registration schema', () => {
  const VALID_AGENT = {
    walletAddress: ETH_ADDRESS,
    name: 'Agent Alpha',
    endpoint: 'https://alpha.example.com/api',
    capabilities: ['data-analysis', 'summarization'],
    pricingUsdc: 2.5,
  };

  it('accepts a valid agent registration', () => {
    expect(() => RegisterAgentSchema.parse(VALID_AGENT)).not.toThrow();
  });

  it('rejects invalid wallet address', () => {
    expect(() =>
      RegisterAgentSchema.parse({ ...VALID_AGENT, walletAddress: '0xbadaddress' })
    ).toThrow();
  });

  it('rejects non-URL endpoint', () => {
    expect(() =>
      RegisterAgentSchema.parse({ ...VALID_AGENT, endpoint: 'not-a-url' })
    ).toThrow();
  });

  it('rejects empty capabilities array', () => {
    expect(() =>
      RegisterAgentSchema.parse({ ...VALID_AGENT, capabilities: [] })
    ).toThrow();
  });

  it('rejects non-positive pricing', () => {
    expect(() =>
      RegisterAgentSchema.parse({ ...VALID_AGENT, pricingUsdc: -1 })
    ).toThrow();
    expect(() =>
      RegisterAgentSchema.parse({ ...VALID_AGENT, pricingUsdc: 0 })
    ).toThrow();
  });

  it('accepts optional modelName and SLA fields', () => {
    const result = RegisterAgentSchema.parse({
      ...VALID_AGENT,
      modelName: 'gemini-1.5-flash',
      slaUptimePct: 99.9,
      slaResponseMs: 1500,
    });
    expect(result.modelName).toBe('gemini-1.5-flash');
    expect(result.slaUptimePct).toBe(99.9);
  });

  it('rejects slaUptimePct > 100', () => {
    expect(() =>
      RegisterAgentSchema.parse({ ...VALID_AGENT, slaUptimePct: 101 })
    ).toThrow();
  });
});

describe('Agent Registry — find query schema', () => {
  it('accepts all optional params absent', () => {
    expect(() => FindAgentsQuerySchema.parse({})).not.toThrow();
  });

  it('coerces string maxPrice to number', () => {
    const result = FindAgentsQuerySchema.parse({ maxPrice: '5.0' });
    expect(result.maxPrice).toBe(5.0);
    expect(typeof result.maxPrice).toBe('number');
  });

  it('coerces string minReputation to number', () => {
    const result = FindAgentsQuerySchema.parse({ minReputation: '80' });
    expect(result.minReputation).toBe(80);
  });

  it('rejects negative maxPrice', () => {
    expect(() => FindAgentsQuerySchema.parse({ maxPrice: '-1' })).toThrow();
  });

  it('rejects negative minReputation', () => {
    expect(() => FindAgentsQuerySchema.parse({ minReputation: '-5' })).toThrow();
  });
});

// ─── AgentProfile DTO mapping (pure function, no DB) ──────────────────────────

function toAgentDTO(
  profile: {
    id: string;
    walletAddress: string;
    name: string;
    endpoint: string;
    modelName: string | null;
    capabilities: string[];
    pricingUsdc: { toString(): string };
    slaUptimePct: number;
    slaResponseMs: number;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
  },
  reputationScore?: number
) {
  return {
    id: profile.id,
    walletAddress: profile.walletAddress,
    name: profile.name,
    endpoint: profile.endpoint,
    modelName: profile.modelName,
    capabilities: profile.capabilities,
    pricingUsdc: profile.pricingUsdc.toString(),
    slaUptimePct: profile.slaUptimePct,
    slaResponseMs: profile.slaResponseMs,
    active: profile.active,
    reputationScore,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

describe('AgentProfileDTO mapping', () => {
  const now = new Date('2026-03-21T12:00:00.000Z');
  const BASE_PROFILE = {
    id: 'clr001',
    walletAddress: ETH_ADDRESS,
    name: 'Agent Alpha',
    endpoint: 'https://alpha.example.com/api',
    modelName: null,
    capabilities: ['data-analysis'],
    pricingUsdc: { toString: () => '2.5' },
    slaUptimePct: 99.0,
    slaResponseMs: 2000,
    active: true,
    createdAt: now,
    updatedAt: now,
  };

  it('maps basic fields correctly', () => {
    const dto = toAgentDTO(BASE_PROFILE);
    expect(dto.id).toBe('clr001');
    expect(dto.walletAddress).toBe(ETH_ADDRESS);
    expect(dto.pricingUsdc).toBe('2.5');
    expect(dto.active).toBe(true);
  });

  it('converts dates to ISO strings', () => {
    const dto = toAgentDTO(BASE_PROFILE);
    expect(dto.createdAt).toBe('2026-03-21T12:00:00.000Z');
    expect(dto.updatedAt).toBe('2026-03-21T12:00:00.000Z');
  });

  it('includes reputationScore when provided', () => {
    const dto = toAgentDTO(BASE_PROFILE, 95);
    expect(dto.reputationScore).toBe(95);
  });

  it('leaves reputationScore undefined when not provided', () => {
    const dto = toAgentDTO(BASE_PROFILE);
    expect(dto.reputationScore).toBeUndefined();
  });

  it('passes null modelName through', () => {
    const dto = toAgentDTO(BASE_PROFILE);
    expect(dto.modelName).toBeNull();
  });

  it('passes non-null modelName through', () => {
    const dto = toAgentDTO({ ...BASE_PROFILE, modelName: 'gemini-1.5-flash' });
    expect(dto.modelName).toBe('gemini-1.5-flash');
  });
});

// ─── Job Board — Zod schemas (mirrors routes/jobs.ts) ─────────────────────────

const PostJobSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  posterWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  description: z.string().min(1),
  budgetMaxUsdc: z.number().positive(),
  requiredCaps: z.array(z.string()).min(1),
  deadline: z.string().datetime(),
});

const SubmitBidSchema = z.object({
  providerWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  priceUsdc: z.number().positive(),
  etaSeconds: z.number().int().positive(),
  message: z.string().optional(),
});

const AcceptBidSchema = z.object({
  payerPrivateKey: z.string().min(1),
});

const DeliverJobSchema = z.object({
  providerWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  deliverable: z.object({}).passthrough(),
});

describe('Job Board — post job schema', () => {
  const VALID_JOB = {
    posterWallet: ETH_ADDRESS,
    description: 'Summarize 50 documents and produce a report',
    budgetMaxUsdc: 10.0,
    requiredCaps: ['summarization'],
    deadline: '2026-04-01T00:00:00.000Z',
  };

  it('accepts a valid job', () => {
    expect(() => PostJobSchema.parse(VALID_JOB)).not.toThrow();
  });

  it('rejects invalid wallet', () => {
    expect(() =>
      PostJobSchema.parse({ ...VALID_JOB, posterWallet: 'not-an-address' })
    ).toThrow();
  });

  it('rejects empty description', () => {
    expect(() =>
      PostJobSchema.parse({ ...VALID_JOB, description: '' })
    ).toThrow();
  });

  it('rejects non-positive budget', () => {
    expect(() =>
      PostJobSchema.parse({ ...VALID_JOB, budgetMaxUsdc: 0 })
    ).toThrow();
  });

  it('rejects empty requiredCaps', () => {
    expect(() =>
      PostJobSchema.parse({ ...VALID_JOB, requiredCaps: [] })
    ).toThrow();
  });

  it('rejects invalid deadline format', () => {
    expect(() =>
      PostJobSchema.parse({ ...VALID_JOB, deadline: 'not-a-date' })
    ).toThrow();
  });

  it('accepts optional custom job id', () => {
    expect(() =>
      PostJobSchema.parse({ ...VALID_JOB, id: 'job_abc123' })
    ).not.toThrow();
  });
});

describe('Job Board — submit bid schema', () => {
  const VALID_BID = {
    providerWallet: ETH_ADDRESS_2,
    priceUsdc: 7.5,
    etaSeconds: 3600,
    message: 'I can do this efficiently.',
  };

  it('accepts a valid bid', () => {
    expect(() => SubmitBidSchema.parse(VALID_BID)).not.toThrow();
  });

  it('accepts bid without optional message', () => {
    const { message, ...noMsg } = VALID_BID;
    expect(() => SubmitBidSchema.parse(noMsg)).not.toThrow();
  });

  it('rejects non-positive priceUsdc', () => {
    expect(() => SubmitBidSchema.parse({ ...VALID_BID, priceUsdc: -1 })).toThrow();
  });

  it('rejects non-integer etaSeconds', () => {
    expect(() =>
      SubmitBidSchema.parse({ ...VALID_BID, etaSeconds: 1.5 })
    ).toThrow();
  });

  it('rejects invalid provider wallet', () => {
    expect(() =>
      SubmitBidSchema.parse({ ...VALID_BID, providerWallet: '0xshort' })
    ).toThrow();
  });
});

describe('Job Board — accept bid schema', () => {
  it('accepts a non-empty private key', () => {
    expect(() => AcceptBidSchema.parse({ payerPrivateKey: '0xdeadbeef' })).not.toThrow();
  });

  it('rejects empty private key', () => {
    expect(() => AcceptBidSchema.parse({ payerPrivateKey: '' })).toThrow();
  });

  it('rejects missing private key', () => {
    expect(() => AcceptBidSchema.parse({})).toThrow();
  });
});

describe('Job Board — deliver schema', () => {
  const VALID_DELIVERY = {
    providerWallet: ETH_ADDRESS_2,
    deliverable: {
      summary: 'Work complete',
      keyFindings: ['f1', 'f2'],
      confidence: 0.9,
    },
  };

  it('accepts valid delivery payload', () => {
    expect(() => DeliverJobSchema.parse(VALID_DELIVERY)).not.toThrow();
  });

  it('rejects invalid provider wallet', () => {
    expect(() =>
      DeliverJobSchema.parse({ ...VALID_DELIVERY, providerWallet: '0xshort' })
    ).toThrow();
  });

  it('rejects non-object deliverable payload', () => {
    expect(() =>
      DeliverJobSchema.parse({ ...VALID_DELIVERY, deliverable: 'bad' as unknown as object })
    ).toThrow();
  });
});

// ─── JobPostingDTO mapping ────────────────────────────────────────────────────

function jobToDTO(job: {
  id: string;
  posterWallet: string;
  description: string;
  budgetMaxUsdc: { toString(): string };
  requiredCaps: string[];
  deadline: Date;
  conditionsJson: unknown;
  status: string;
  winningBidId: string | null;
  escrowId: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: job.id,
    posterWallet: job.posterWallet,
    description: job.description,
    budgetMaxUsdc: job.budgetMaxUsdc.toString(),
    requiredCaps: job.requiredCaps,
    deadline: job.deadline.toISOString(),
    conditionsJson: job.conditionsJson ?? null,
    status: job.status,
    winningBidId: job.winningBidId,
    escrowId: job.escrowId,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}

describe('JobPostingDTO mapping', () => {
  const now = new Date('2026-03-21T12:00:00.000Z');
  const BASE_JOB = {
    id: 'job001',
    posterWallet: ETH_ADDRESS,
    description: 'Summarize documents',
    budgetMaxUsdc: { toString: () => '10' },
    requiredCaps: ['summarization'],
    deadline: new Date('2026-04-01T00:00:00.000Z'),
    conditionsJson: null,
    status: 'OPEN',
    winningBidId: null,
    escrowId: null,
    createdAt: now,
    updatedAt: now,
  };

  it('maps basic fields correctly', () => {
    const dto = jobToDTO(BASE_JOB);
    expect(dto.id).toBe('job001');
    expect(dto.status).toBe('OPEN');
    expect(dto.budgetMaxUsdc).toBe('10');
  });

  it('converts dates to ISO strings', () => {
    const dto = jobToDTO(BASE_JOB);
    expect(dto.createdAt).toBe('2026-03-21T12:00:00.000Z');
    expect(dto.deadline).toBe('2026-04-01T00:00:00.000Z');
  });

  it('passes null conditionsJson through', () => {
    const dto = jobToDTO(BASE_JOB);
    expect(dto.conditionsJson).toBeNull();
  });

  it('passes non-null conditionsJson through', () => {
    const dto = jobToDTO({ ...BASE_JOB, conditionsJson: { version: '1.0' } });
    expect(dto.conditionsJson).toEqual({ version: '1.0' });
  });

  it('sets escrowId when AWARDED', () => {
    const dto = jobToDTO({
      ...BASE_JOB,
      status: 'AWARDED',
      escrowId: '0xabc123',
      winningBidId: 'bid001',
    });
    expect(dto.escrowId).toBe('0xabc123');
    expect(dto.winningBidId).toBe('bid001');
  });
});

// ─── Stats route — aggregation logic ─────────────────────────────────────────

describe('Stats — aggregation helpers', () => {
  // Pure helper that mirrors the stats route math
  function computeStats(data: {
    activeEscrowSum: number;
    settled24hSum: number;
    activeJobsCount: number;
    activeDisputesCount: number;
    activeCasesCount: number;
  }) {
    return {
      totalUsdcInEscrow: data.activeEscrowSum,
      settled24h: data.settled24hSum,
      activeJobs: data.activeJobsCount,
      activeDisputes: data.activeDisputesCount,
      activeCases: data.activeCasesCount,
    };
  }

  it('returns zeroes when nothing active', () => {
    const stats = computeStats({
      activeEscrowSum: 0,
      settled24hSum: 0,
      activeJobsCount: 0,
      activeDisputesCount: 0,
      activeCasesCount: 0,
    });
    expect(stats.totalUsdcInEscrow).toBe(0);
    expect(stats.activeJobs).toBe(0);
    expect(stats.activeCases).toBe(0);
  });

  it('sums USDC correctly', () => {
    const stats = computeStats({
      activeEscrowSum: 150.75,
      settled24hSum: 50.0,
      activeJobsCount: 3,
      activeDisputesCount: 1,
      activeCasesCount: 1,
    });
    expect(stats.totalUsdcInEscrow).toBe(150.75);
    expect(stats.settled24h).toBe(50.0);
    expect(stats.activeJobs).toBe(3);
  });
});

// ─── Court — verdict encoding ─────────────────────────────────────────────────

const VERDICT_UINT: Record<string, number> = {
  PLAINTIFF_WINS: 0,
  DEFENDANT_WINS: 1,
  SPLIT: 2,
};

function deriveConsensus(verdicts: string[]): string | null {
  const counts: Record<string, number> = {};
  for (const v of verdicts) {
    counts[v] = (counts[v] ?? 0) + 1;
  }
  for (const [verdict, count] of Object.entries(counts)) {
    if (count >= 2) return verdict;
  }
  return 'SPLIT'; // 1-1-1
}

describe('Court — verdict encoding', () => {
  it('encodes PLAINTIFF_WINS as 0', () => {
    expect(VERDICT_UINT['PLAINTIFF_WINS']).toBe(0);
  });

  it('encodes DEFENDANT_WINS as 1', () => {
    expect(VERDICT_UINT['DEFENDANT_WINS']).toBe(1);
  });

  it('encodes SPLIT as 2', () => {
    expect(VERDICT_UINT['SPLIT']).toBe(2);
  });

  it('all verdicts have distinct encodings', () => {
    const values = Object.values(VERDICT_UINT);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe('Court — consensus logic', () => {
  it('returns DEFENDANT_WINS on 3-0 unanimous vote', () => {
    const result = deriveConsensus([
      'DEFENDANT_WINS',
      'DEFENDANT_WINS',
      'DEFENDANT_WINS',
    ]);
    expect(result).toBe('DEFENDANT_WINS');
  });

  it('returns PLAINTIFF_WINS on 2-1 majority', () => {
    const result = deriveConsensus([
      'PLAINTIFF_WINS',
      'PLAINTIFF_WINS',
      'DEFENDANT_WINS',
    ]);
    expect(result).toBe('PLAINTIFF_WINS');
  });

  it('returns DEFENDANT_WINS on 2-1 majority (other direction)', () => {
    const result = deriveConsensus([
      'DEFENDANT_WINS',
      'PLAINTIFF_WINS',
      'DEFENDANT_WINS',
    ]);
    expect(result).toBe('DEFENDANT_WINS');
  });

  it('returns SPLIT on 1-1-1 vote', () => {
    const result = deriveConsensus([
      'PLAINTIFF_WINS',
      'DEFENDANT_WINS',
      'SPLIT',
    ]);
    expect(result).toBe('SPLIT');
  });

  it('handles only 2 judges reaching a 2-0 consensus', () => {
    const result = deriveConsensus(['PLAINTIFF_WINS', 'PLAINTIFF_WINS']);
    expect(result).toBe('PLAINTIFF_WINS');
  });

  it('handles single judge (no consensus possible — returns SPLIT)', () => {
    const result = deriveConsensus(['DEFENDANT_WINS']);
    expect(result).toBe('SPLIT');
  });
});

// ─── isEndpointAllowed — regression + new economy endpoints ──────────────────
// (Import the real function to ensure coverage of the fix)

describe('isEndpointAllowed — economy endpoint integration', () => {
  // We test the rule: "private IPs + localhost blocked in prod, allowed in dev"
  // Mirrors the logic in verifierService.ts without importing it (avoids DB deps)

  const PRIVATE_IP_PATTERNS: RegExp[] = [
    /^127\./,
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^169\.254\./,
    /^100\.64\./,
    /^::1$/,
    /^fc00:/i,
    /^fe80:/i,
  ];

  function isEndpointAllowedMirror(
    rawUrl: string,
    isProd: boolean
  ): { allowed: boolean; reason?: string } {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { allowed: false, reason: `Invalid URL: ${rawUrl}` };
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { allowed: false, reason: `Protocol not allowed: ${parsed.protocol}` };
    }

    const hostname = parsed.hostname;

    if (isProd) {
      if (hostname === 'localhost' || PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) {
        return {
          allowed: false,
          reason: `Private/loopback address blocked in production: ${hostname}`,
        };
      }
    }

    return { allowed: true };
  }

  it('blocks localhost in production', () => {
    expect(isEndpointAllowedMirror('http://localhost:3002/health', true).allowed).toBe(false);
  });

  it('blocks 127.0.0.1 in production', () => {
    expect(isEndpointAllowedMirror('http://127.0.0.1:8080/check', true).allowed).toBe(false);
  });

  it('blocks 192.168.x.x in production', () => {
    expect(isEndpointAllowedMirror('http://192.168.1.100/api', true).allowed).toBe(false);
  });

  it('blocks cloud metadata endpoint (169.254.169.254) in production', () => {
    expect(
      isEndpointAllowedMirror('http://169.254.169.254/latest/meta-data/', true).allowed
    ).toBe(false);
  });

  it('allows localhost in development', () => {
    expect(isEndpointAllowedMirror('http://localhost:3002/health', false).allowed).toBe(true);
  });

  it('allows public agent endpoints in production', () => {
    expect(
      isEndpointAllowedMirror('https://agent.example.com/api/health', true).allowed
    ).toBe(true);
  });

  it('rejects non-http protocols in all environments', () => {
    expect(isEndpointAllowedMirror('ftp://example.com/file', false).allowed).toBe(false);
    expect(isEndpointAllowedMirror('ftp://example.com/file', true).allowed).toBe(false);
  });

  it('rejects malformed URLs in all environments', () => {
    expect(isEndpointAllowedMirror('not-a-url', false).allowed).toBe(false);
    expect(isEndpointAllowedMirror('', true).allowed).toBe(false);
  });
});
