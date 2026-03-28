import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { registerWebhook, listWebhooks, deleteWebhook } from '../services/webhookService';
import { requireApiKey } from '../middleware/apiKey';
import { writeLimiter, readLimiter } from '../middleware/rateLimiter';

const router = Router();

function qs(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] as string | undefined;
  if (typeof v === 'string') return v;
  return undefined;
}

const VALID_EVENT_TYPES = [
  'CONTRACT_CREATED',
  'ESCROW_LOCKED',
  'CONDITION_CHECKED',
  'PAYMENT_RELEASED',
  'DISPUTE_RAISED',
  'REFUND_ISSUED',
  'REPUTATION_UPDATED',
] as const;

const RegisterWebhookSchema = z.object({
  url: z.string().url('url must be a valid HTTPS URL').refine(
    (u) => u.startsWith('https://'),
    'Webhook URL must use HTTPS'
  ),
  escrowId: z
    .string()
    .regex(/^0x[0-9a-fA-F]{64}$/, 'escrowId must be a bytes32 hex string')
    .optional(),
  events: z
    .array(z.enum(VALID_EVENT_TYPES))
    .optional()
    .default([]),
});

/**
 * POST /api/webhooks — Register a new webhook subscription.
 *
 * Returns the subscription id and the HMAC secret once.
 * Store the secret securely — it cannot be retrieved again.
 *
 * To verify deliveries, compute HMAC-SHA256(body, secret) and compare against
 * the X-Kroxy-Signature header value (format: "sha256=<hex>").
 */
router.post('/', requireApiKey, writeLimiter, async (req: Request, res: Response) => {
  const parse = RegisterWebhookSchema.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({
      error: 'Validation failed',
      issues: parse.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
    return;
  }

  const result = await registerWebhook(parse.data);
  res.status(201).json({
    id: result.id,
    secret: result.secret,
    note: 'Store this secret securely. It will not be shown again.',
  });
});

/**
 * GET /api/webhooks — List webhook subscriptions (secrets omitted).
 * Optionally filter by ?escrowId=0x...
 */
router.get('/', requireApiKey, readLimiter, async (req: Request, res: Response) => {
  const escrowId = qs(req.query.escrowId);
  const webhooks = await listWebhooks(escrowId);
  res.json(webhooks);
});

/**
 * DELETE /api/webhooks/:id — Deactivate a webhook subscription.
 */
router.delete('/:id', requireApiKey, writeLimiter, async (req: Request, res: Response) => {
  const deleted = await deleteWebhook(req.params.id as string);
  if (!deleted) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }
  res.json({ deleted: true });
});

export default router;
