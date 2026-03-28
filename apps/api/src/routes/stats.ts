import { Router, Request, Response } from 'express';
import { prisma } from '@kroxy/db';
import { readLimiter } from '../middleware/rateLimiter';

const router = Router();

// GET /api/stats
router.get('/', readLimiter, async (_req: Request, res: Response): Promise<void> => {
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [activeEscrows, settledEscrows, activeJobs, activeDisputes, activeCases] =
    await Promise.all([
      prisma.escrowRecord.aggregate({
        where: { state: 'ACTIVE' },
        _sum: { amountUsdc: true },
        _count: true,
      }),
      prisma.escrowRecord.aggregate({
        where: { state: 'RELEASED', updatedAt: { gte: since24h } },
        _sum: { amountUsdc: true },
        _count: true,
      }),
      prisma.jobPosting.count({
        where: { status: { in: ['OPEN', 'AWARDED', 'IN_PROGRESS'] } },
      }),
      prisma.escrowRecord.count({ where: { state: 'DISPUTED' } }),
      prisma.arbitrationCase.count({ where: { status: { not: 'RESOLVED' } } }),
    ]);

  res.json({
    totalUsdcInEscrow: (activeEscrows._sum.amountUsdc ?? BigInt(0)).toString(),
    activeEscrowCount: activeEscrows._count,
    settled24h: (settledEscrows._sum.amountUsdc ?? BigInt(0)).toString(),
    settled24hCount: settledEscrows._count,
    activeJobs,
    activeDisputes,
    activeCases,
    asOf: now.toISOString(),
  });
});

export default router;
