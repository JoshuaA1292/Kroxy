import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import cors from 'cors';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';
import { getProvider } from './lib/ethers';
import escrowsRouter from './routes/escrows';
import auditRouter from './routes/audit';
import reputationRouter from './routes/reputation';
import webhooksRouter from './routes/webhooks';
import checkRouter from './routes/check';
import disputeRouter from './routes/dispute';
import agentsRouter from './routes/agents';
import jobsRouter from './routes/jobs';
import courtRouter from './routes/court';
import statsRouter from './routes/stats';
import { errorHandler } from './middleware/errorHandler';
import { startVerificationEngine } from './services/verifierService';
import demoAgentRouter from './routes/demoAgent';
import { startDemoAgent } from './services/demoAgentService';

const app = express();
const PORT = parseInt(process.env.PORT ?? process.env.API_PORT ?? '3001', 10);

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// ─── Health Check ─────────────────────────────────────────────────────────────
// Liveness probe: confirms process is up and can serve HTTP.
app.get('/livez', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    ts: new Date().toISOString(),
  });
});

// Checks DB connectivity and (optionally) RPC reachability — used by load
// balancers and uptime monitors.

app.get('/health', async (_req, res) => {
  const checks: Record<string, 'ok' | 'error'> = {};

  // Database
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  // RPC provider (non-blocking — skip if address vars not set)
  if (process.env.BASE_RPC_URL) {
    try {
      const provider = getProvider();
      await provider.getBlockNumber();
      checks.rpc = 'ok';
    } catch {
      checks.rpc = 'error';
    }
  }

  // Only gate on database — RPC is an external dependency and shouldn't
  // fail the Railway healthcheck when Base RPC is slow or rate-limiting.
  const dbOk = checks.database === 'ok';
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'degraded',
    checks,
    ts: new Date().toISOString(),
  });
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/api/escrows', escrowsRouter);
app.use('/api/escrows/:escrowId/check-and-release', checkRouter);
app.use('/api/escrows/:escrowId/dispute', disputeRouter);
app.use('/api/audit', auditRouter);
app.use('/api/reputation', reputationRouter);
app.use('/api/webhooks', webhooksRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/court', courtRouter);
app.use('/api/stats', statsRouter);
app.use('/demo-agent', demoAgentRouter);

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function startVerificationEngineWithRetry(attempt = 1): Promise<void> {
  try {
    await startVerificationEngine();
    logger.info('Verification engine started');
  } catch (err) {
    const delayMs = Math.min(30000, 1000 * 2 ** Math.min(attempt, 5));
    logger.error(
      { err, attempt, retryInMs: delayMs },
      'Verification engine startup failed; retry scheduled'
    );

    setTimeout(() => {
      void startVerificationEngineWithRetry(attempt + 1);
    }, delayMs);
  }
}

app.listen(PORT, () => {
  logger.info({ port: PORT }, 'API server started');
  void startVerificationEngineWithRetry();
  if (process.env.KROXY_DEMO_AGENT_ENABLED === '1') {
    void startDemoAgent();
  }
});

export default app;
