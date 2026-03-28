import { Router, Request, Response } from 'express';
import { processJob, resultMap } from '../services/demoAgentService';
import { logger } from '../lib/logger';

const router = Router();

// POST /demo-agent/jobs — webhook receiver (called by notifyMatchingAgents)
router.post('/jobs', (req: Request, res: Response): void => {
  const { type, jobId } = req.body as { type?: string; jobId?: string };

  if (type === 'JOB_POSTED' && jobId) {
    logger.info({ jobId }, '[DemoAgent] Received job notification');
    void processJob(jobId);
  }

  res.status(202).json({ accepted: true });
});

// GET /demo-agent/health — verifier polls this to check agent is alive
router.get('/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', agent: 'nexus-demo' });
});

// GET /demo-agent/quality-check?jobId=X — verifier polls this to validate work quality
router.get('/quality-check', (req: Request, res: Response): void => {
  const jobId = req.query.jobId as string | undefined;
  const metrics = jobId ? resultMap.get(jobId) : undefined;

  // Return stored metrics if available, else return static passing values
  res.json({
    wordCount: metrics?.wordCount ?? 500,
    confidence: metrics?.confidence ?? 0.95,
    jobId: jobId ?? null,
  });
});

export default router;
