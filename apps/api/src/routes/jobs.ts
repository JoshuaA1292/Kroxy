import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';
import { requireApiKey } from '../middleware/apiKey';
import { createJob, submitBid, acceptBid, listJobs, getJob, deliverJob, cancelJob } from '../services/jobBoardService';

const router = Router();

function qs(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] as string | undefined;
  if (typeof v === 'string') return v;
  return undefined;
}

const EthAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid Ethereum address');

const CreateJobSchema = z.object({
  id: z.string().min(3).max(100).optional(),
  posterWallet: EthAddressSchema,
  description: z.string().min(1).max(2000),
  budgetMaxUsdc: z.number().positive(),
  requiredCaps: z.array(z.string().min(1)).min(1),
  deadline: z.string().datetime({ message: 'deadline must be an ISO 8601 datetime string' }),
  conditionsJson: z.object({}).passthrough().optional(),
});

const SubmitBidSchema = z.object({
  providerWallet: EthAddressSchema,
  priceUsdc: z.number().positive(),
  etaSeconds: z.number().int().positive(),
  conditionsAccepted: z.boolean().default(true),
  message: z.string().max(500).optional(),
});

const AcceptBidSchema = z.object({
  payerPrivateKey: z.string().min(1, 'payerPrivateKey is required'),
});

const DeliverJobSchema = z.object({
  providerWallet: EthAddressSchema,
  deliverable: z.object({}).passthrough(),
});

// POST /api/jobs
router.post('/', requireApiKey, writeLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const job = await createJob(parsed.data as any);
  res.status(201).json(job);
});

// GET /api/jobs
router.get('/', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const status = qs(req.query.status);
  const capability = qs(req.query.capability);
  const posterWallet = qs(req.query.posterWallet);
  const limitRaw = qs(req.query.limit);
  const limit = limitRaw ? parseInt(limitRaw) : undefined;
  const jobs = await listJobs({ status, capability, posterWallet, limit });
  res.json(jobs);
});

// GET /api/jobs/:id
router.get('/:id', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const job = await getJob(req.params.id as string);
  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }
  res.json(job);
});

// POST /api/jobs/:id/bid
router.post('/:id/bid', requireApiKey, writeLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = SubmitBidSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const bid = await submitBid(req.params.id as string, parsed.data);
    res.status(201).json(bid);
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  }
});

// POST /api/jobs/:id/accept/:bidId
router.post(
  '/:id/accept/:bidId',
  requireApiKey,
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = AcceptBidSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }
    try {
      const result = await acceptBid(req.params.id as string, req.params.bidId as string, parsed.data.payerPrivateKey);
      res.json(result);
    } catch (err: any) {
      res.status(err.statusCode ?? 500).json({ error: err.message });
    }
  }
);

// POST /api/jobs/:id/deliver
router.post('/:id/deliver', requireApiKey, writeLimiter, async (req: Request, res: Response): Promise<void> => {
  const parsed = DeliverJobSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  try {
    const job = await deliverJob(req.params.id as string, parsed.data as any);
    res.json(job);
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  }
});

// PATCH /api/jobs/:id/cancel
router.patch('/:id/cancel', requireApiKey, writeLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const job = await cancelJob(req.params.id as string);
    res.json(job);
  } catch (err: any) {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  }
});

export default router;
