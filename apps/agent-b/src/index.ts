import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import express, { Request, Response } from 'express';
import type { KroxyPaymentRequirements, ConditionsDefinition } from '@kroxy/types';

const app = express();
const PORT = parseInt(process.env.AGENT_B_PORT ?? '3002', 10);
const AGENT_B_ADDRESS = process.env.AGENT_B_ADDRESS ?? '';
const KROXY_API_URL = process.env.KROXY_API_URL ?? 'http://localhost:3001';

// Quality dial: set AGENT_B_QUALITY env to a number 0.0–1.0
// Default 0.9 (good data). Set to 0.3 for the dispute demo path.
const QUALITY_SCORE = parseFloat(process.env.AGENT_B_QUALITY ?? '0.9');

app.use(express.json());

// ─── Conditions that Kroxy verifies ──────────────────────────────────────────

function buildConditions(escrowId = ''): ConditionsDefinition {
  return {
    version: '1.0',
    escrowId,
    conditions: [
      {
        type: 'http_status',
        endpoint: `http://localhost:${PORT}/health`,
        operator: 'eq',
        expected: 200,
      },
      {
        type: 'json_field',
        endpoint: `http://localhost:${PORT}/data-feed/quality-check`,
        field: 'quality_score',
        operator: 'gte',
        expected: 0.7,
      },
    ],
    windowSeconds: 60,
    checkIntervalSeconds: 10,
    requiredPassRate: 0.8,
  };
}

// ─── Endpoints ────────────────────────────────────────────────────────────────

// Health check — always 200. Kroxy verification engine polls this.
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', agent: 'agent-b', ts: new Date().toISOString() });
});

// Quality check — returns configurable quality_score.
// Set AGENT_B_QUALITY=0.3 to simulate bad data for dispute demo.
app.get('/data-feed/quality-check', (_req: Request, res: Response) => {
  res.json({
    quality_score: QUALITY_SCORE,
    data_completeness: QUALITY_SCORE > 0.7 ? 'high' : 'low',
    checked_at: new Date().toISOString(),
  });
});

// Main data feed — returns 402 until a valid escrow proof is provided.
app.get('/data-feed', (req: Request, res: Response) => {
  const escrowId = req.headers['x-kroxy-escrow-id'] as string | undefined;
  const txHash = req.headers['x-kroxy-tx-hash'] as string | undefined;

  if (!escrowId || !txHash) {
    // No escrow proof — return 402 with Kroxy payment requirements
    const paymentRequirements: KroxyPaymentRequirements = {
      scheme: 'exact',
      network: 'base-mainnet',
      maxAmountRequired: '1000000', // 1 USDC in 6-decimal units
      resource: `agent-b-data-feed-${Date.now()}`,
      description: 'Real-time research data feed — 60 second window',
      mimeType: 'application/json',
      payTo: AGENT_B_ADDRESS,
      maxTimeoutSeconds: 120,
      kroxyEnabled: true,
      conditionsHash: '', // computed by SDK
      kroxyConditions: buildConditions(),
      kroxyApiEndpoint: KROXY_API_URL,
      escrowDurationSeconds: 120,
    };

    res.status(402)
      .setHeader('X-PAYMENT-REQUIRED', Buffer.from(JSON.stringify(paymentRequirements)).toString('base64'))
      .json(paymentRequirements);
    return;
  }

  // Escrow proof present — deliver data
  console.log(`[Agent B] Delivering data for escrow: ${escrowId}`);
  res.json(generateDataFeed(escrowId));
});

// ─── Data Generation ──────────────────────────────────────────────────────────

function generateDataFeed(escrowId: string) {
  return {
    escrowId,
    timestamp: new Date().toISOString(),
    data: {
      market_sentiment: QUALITY_SCORE > 0.7 ? 'bullish' : 'unknown',
      ai_agent_transactions_24h: QUALITY_SCORE > 0.7 ? Math.floor(Math.random() * 10_000) + 5000 : null,
      top_protocols: QUALITY_SCORE > 0.7
        ? ['Uniswap', 'Aave', 'Compound', 'Curve'].map((name) => ({
            name,
            volume_usdc: Math.floor(Math.random() * 1_000_000),
          }))
        : [],
      data_quality: QUALITY_SCORE > 0.7 ? 'verified' : 'degraded',
      quality_score: QUALITY_SCORE,
    },
    meta: {
      provider: 'Agent B — Research Data Feed',
      chain: 'base-mainnet',
      payment_verified: true,
    },
  };
}

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Agent B] Listening on port ${PORT}`);
  console.log(`[Agent B] Quality score: ${QUALITY_SCORE} (${QUALITY_SCORE >= 0.7 ? 'GOOD — will pass conditions' : 'BAD — will trigger dispute'})`);
  console.log(`[Agent B] Payee address: ${AGENT_B_ADDRESS || '(not set — set AGENT_B_ADDRESS)'}`);
});
