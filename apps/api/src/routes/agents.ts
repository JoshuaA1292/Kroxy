import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@kroxy/db';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import { requireApiKey } from '../middleware/apiKey';
import {
  registerAgent,
  findAgents,
  getAgentByWallet,
  getLeaderboard,
  getWalletBalance,
} from '../services/agentRegistryService';

const router = Router();

// Helper: extract first string value from Express query param (handles string | string[] | ParsedQs)
function qs(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] as string | undefined;
  if (typeof v === 'string') return v;
  return undefined;
}

const EthAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid Ethereum address (0x + 40 hex chars)');

const RegisterAgentSchema = z.object({
  walletAddress: EthAddressSchema,
  name: z.string().min(1).max(100),
  endpoint: z.string().url('endpoint must be a valid URL'),
  modelName: z.string().optional(),
  capabilities: z.array(z.string().min(1)).min(1, 'At least one capability is required'),
  pricingUsdc: z.number().positive('pricingUsdc must be > 0'),
  slaUptimePct: z.number().min(0).max(100).optional(),
  slaResponseMs: z.number().int().positive().optional(),
});

// POST /api/agents/register
router.post(
  '/register',
  requireApiKey,
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = RegisterAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    const agent = await registerAgent(parsed.data);
    res.status(201).json(agent);
  }
);

// GET /api/agents/leaderboard
router.get('/leaderboard', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(parseInt(qs(req.query.limit) ?? '20') || 20, 100);
  const agents = await getLeaderboard(limit);
  res.json(agents);
});

// GET /api/agents/find
router.get('/find', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const capability = qs(req.query.capability);
  const maxPriceRaw = qs(req.query.maxPrice);
  const minRepRaw = qs(req.query.minReputation);
  const maxPrice = maxPriceRaw !== undefined ? parseFloat(maxPriceRaw) : undefined;
  const minReputation = minRepRaw !== undefined ? parseFloat(minRepRaw) : undefined;

  const agents = await findAgents({ capability, maxPrice, minReputation });
  res.json(agents);
});

// GET /api/agents/:wallet/balance
router.get('/:wallet/balance', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const wallet = req.params.wallet as string;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    res.status(400).json({ error: 'Invalid wallet address' });
    return;
  }
  const balance = await getWalletBalance(wallet);
  res.json(balance);
});

// GET /api/agents/:wallet/reputation-history?days=30
router.get('/:wallet/reputation-history', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const wallet = req.params.wallet as string;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    res.status(400).json({ error: 'Invalid wallet address' });
    return;
  }
  const days = Math.min(parseInt(qs(req.query.days) ?? '30') || 30, 90);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await prisma.auditEvent.findMany({
    where: {
      actorAddress: { equals: wallet, mode: 'insensitive' },
      eventType: 'REPUTATION_UPDATED',
      createdAt: { gte: since },
    },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true, rawData: true },
  });

  const history = events.map((e) => {
    const d = e.rawData as Record<string, unknown>;
    return {
      date: e.createdAt.toISOString().slice(0, 10),
      score: typeof d.newScore === 'number' ? d.newScore : (typeof d.score === 'number' ? d.score : null),
    };
  }).filter(p => p.score !== null);

  res.json(history);
});

// GET /api/agents/:wallet
router.get('/:wallet', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const wallet = req.params.wallet as string;
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    res.status(400).json({ error: 'Invalid wallet address' });
    return;
  }
  const agent = await getAgentByWallet(wallet);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  res.json(agent);
});

export default router;
