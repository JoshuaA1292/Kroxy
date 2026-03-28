import { Router, Request, Response } from 'express';
import { manualRaiseDispute } from '../services/verifierService';

const router = Router({ mergeParams: true });

// POST /api/escrows/:escrowId/dispute
router.post('/', async (req: Request, res: Response) => {
  const escrowId = req.params.escrowId as string;
  const { reason, evidenceData } = req.body as { reason: string; evidenceData: Record<string, unknown> };

  if (!reason) {
    res.status(400).json({ error: 'reason is required' });
    return;
  }

  const result = await manualRaiseDispute(escrowId, reason, evidenceData ?? {});
  if (!result) {
    res.status(404).json({ error: 'Escrow not found or not active' });
    return;
  }

  res.json(result);
});

export default router;
