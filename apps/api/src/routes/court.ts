import { Router, Request, Response } from 'express';
import { Prisma } from '@kroxy/db';
import { prisma } from '../lib/prisma';
import { z } from 'zod';
import { readLimiter, writeLimiter } from '../middleware/rateLimiter';
import { requireApiKey } from '../middleware/apiKey';
import { appendAuditEvent } from '../services/auditService';

const router = Router();

function qs(v: unknown): string | undefined {
  if (Array.isArray(v)) return v[0] as string | undefined;
  if (typeof v === 'string') return v;
  return undefined;
}

// GET /api/court/cases
router.get('/cases', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const status = qs(req.query.status);
  const limit = Math.min(parseInt(qs(req.query.limit) ?? '50') || 50, 200);

  const where: Prisma.ArbitrationCaseWhereInput = {};
  if (status) where.status = status as Prisma.EnumArbitrationStatusFilter;

  const cases = await prisma.arbitrationCase.findMany({
    where,
    orderBy: { openedAt: 'desc' },
    take: limit,
  });

  res.json(
    cases.map((c) => ({
      id: c.id,
      escrowId: c.escrowId,
      plaintiffWallet: c.plaintiffWallet,
      defendantWallet: c.defendantWallet,
      evidenceIpfsHash: c.evidenceIpfsHash,
      status: c.status,
      verdict: c.verdict,
      judgeCommits: c.judgeCommits,
      openedAt: c.openedAt.toISOString(),
      resolvedAt: c.resolvedAt?.toISOString() ?? null,
    }))
  );
});

// GET /api/court/cases/:escrowId
router.get('/cases/:escrowId', readLimiter, async (req: Request, res: Response): Promise<void> => {
  const c = await prisma.arbitrationCase.findUnique({
    where: { escrowId: req.params.escrowId as string },
  });
  if (!c) {
    res.status(404).json({ error: 'Case not found' });
    return;
  }
  res.json({
    id: c.id,
    escrowId: c.escrowId,
    plaintiffWallet: c.plaintiffWallet,
    defendantWallet: c.defendantWallet,
    evidenceIpfsHash: c.evidenceIpfsHash,
    status: c.status,
    verdict: c.verdict,
    judgeCommits: c.judgeCommits,
    openedAt: c.openedAt.toISOString(),
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
  });
});

// POST /api/court/cases/:escrowId/evidence
// Allows the plaintiff or defendant to submit a text argument that gets appended to the evidence package
const EvidenceSchema = z.object({
  submitter: z.enum(['plaintiff', 'defendant']),
  argument: z.string().min(10).max(2000),
  walletAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
});

router.post(
  '/cases/:escrowId/evidence',
  requireApiKey,
  writeLimiter,
  async (req: Request, res: Response): Promise<void> => {
    const parse = EvidenceSchema.safeParse(req.body);
    if (!parse.success) {
      res.status(400).json({ error: parse.error.flatten() });
      return;
    }

    const { submitter, argument, walletAddress } = parse.data;
    const { escrowId } = req.params as { escrowId: string };

    const courtCase = await prisma.arbitrationCase.findUnique({ where: { escrowId } });
    if (!courtCase) {
      res.status(404).json({ error: 'Case not found' });
      return;
    }
    if (courtCase.status === 'RESOLVED') {
      res.status(409).json({ error: 'Case is already resolved' });
      return;
    }

    // Validate submitter matches their wallet
    const expectedWallet = submitter === 'plaintiff' ? courtCase.plaintiffWallet : courtCase.defendantWallet;
    if (walletAddress.toLowerCase() !== expectedWallet.toLowerCase()) {
      res.status(403).json({ error: `Wallet does not match ${submitter} address` });
      return;
    }

    await appendAuditEvent({
      escrowId,
      eventType: 'EVIDENCE_POSTED',
      actorAddress: walletAddress,
      actorRole: 'KROXY_COURT',
      rawData: { submitter, argument: argument.slice(0, 500), caseId: courtCase.id },
    });

    // Append the argument to evidenceJson
    const existing = (courtCase.evidenceJson as Record<string, unknown> | null) ?? {};
    const args = ((existing.arguments as unknown[]) ?? []) as Array<{ submitter: string; argument: string; submittedAt: string }>;
    args.push({ submitter, argument, submittedAt: new Date().toISOString() });
    await prisma.arbitrationCase.update({
      where: { escrowId },
      data: { evidenceJson: { ...existing, arguments: args } },
    });

    res.json({ ok: true, caseId: courtCase.id });
  }
);

export default router;
