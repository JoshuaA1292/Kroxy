import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { addSseClient } from '../services/auditService';
import { sseLimiter } from '../middleware/rateLimiter';

const router = Router();

// GET /api/audit/stream — SSE stream of all audit events (real-time push)
router.get('/stream', sseLimiter, (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Send a heartbeat every 15s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15_000);

  res.on('close', () => clearInterval(heartbeat));

  const accepted = addSseClient(req, res);
  if (!accepted) {
    res.status(429).end();
    return;
  }
});

// GET /api/audit/:escrowId — full hash-chain event log for one escrow
router.get('/:escrowId', async (req: Request, res: Response) => {
  const events = await prisma.auditEvent.findMany({
    where: { escrowId: req.params.escrowId as string },
    orderBy: { sequence: 'asc' },
  });

  const dto = events.map((e) => ({
    id: e.id,
    sequence: e.sequence,
    escrowId: e.escrowId,
    eventType: e.eventType,
    actorAddress: e.actorAddress,
    actorRole: e.actorRole,
    rawData: e.rawData,
    txHash: e.txHash,
    blockNumber: e.blockNumber?.toString() ?? null,
    previousHash: e.previousHash,
    thisHash: e.thisHash,
    createdAt: e.createdAt.toISOString(),
  }));

  res.json(dto);
});

export default router;
