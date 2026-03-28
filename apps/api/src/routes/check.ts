import { Router, Request, Response } from 'express';
import { triggerImmediateEvaluation } from '../services/verifierService';

const router = Router({ mergeParams: true });

// POST /api/escrows/:escrowId/check-and-release
router.post('/', async (req: Request, res: Response) => {
  const escrowId = req.params.escrowId as string;

  const result = await triggerImmediateEvaluation(escrowId);
  if (!result) {
    res.status(404).json({ error: 'Escrow not found or not active' });
    return;
  }

  res.json(result);
});

export default router;
