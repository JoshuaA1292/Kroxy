import { Router, Request, Response } from 'express';
import { getReputation } from '../services/reputationService';

const router = Router();

// GET /api/reputation/:address
router.get('/:address', async (req: Request, res: Response) => {
  const address = req.params.address as string;

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid Ethereum address' });
    return;
  }

  const reputation = await getReputation(address);
  res.json(reputation);
});

export default router;
