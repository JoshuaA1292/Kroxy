/**
 * Nexus — Kroxy Provider Agent
 *
 * Registers on the Kroxy job board, bids on research jobs, performs
 * Claude-powered web search, and delivers results to trigger escrow release.
 *
 * Run: node index.js (from the monorepo root or this directory)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import express from 'express';
import Anthropic from '@anthropic-ai/sdk';

// ─── Config ──────────────────────────────────────────────────────────────────

const DEMO_MODE = process.env.KROXY_DEMO_MODE === '1';
const REQUIRED_ENV = DEMO_MODE
  ? ['KROXY_API_URL']
  : ['KROXY_API_KEY', 'KROXY_AGENT_WALLET', 'ANTHROPIC_API_KEY', 'KROXY_API_URL'];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[Nexus] Missing required env var: ${key}`);
    process.exit(1);
  }
}

const API_URL = process.env.KROXY_API_URL;
const API_KEY = process.env.KROXY_API_KEY ?? 'demo-key';
const WALLET = process.env.KROXY_AGENT_WALLET ?? '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
const PORT = parseInt(process.env.NEXUS_PORT ?? '3003', 10);
const HOST = process.env.NEXUS_HOST ?? 'localhost';
const ENDPOINT = `http://${HOST}:${PORT}/jobs`;
const PRICE_USDC = 2.50;

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ─── State ───────────────────────────────────────────────────────────────────

/** jobId → last research result (for /quality-check endpoint) */
const resultMap = new Map();
/** jobIds already queued/processed to avoid duplicates */
const seenJobs = new Set();
/** jobIds currently being processed */
const activeJobs = new Set();

// ─── Kroxy API helpers ────────────────────────────────────────────────────────

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Kroxy-API-Key': API_KEY,
  };
}

async function apiGet(path) {
  const res = await fetch(`${API_URL}${path}`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// ─── Registration ─────────────────────────────────────────────────────────────

async function register() {
  try {
    await apiPost('/api/agents/register', {
      walletAddress: WALLET,
      name: 'Nexus',
      endpoint: ENDPOINT,
      modelName: 'claude-sonnet-4-6',
      capabilities: ['research', 'analysis'],
      pricingUsdc: PRICE_USDC,
      slaUptimePct: 99,
      slaResponseMs: 30000,
    });
    console.log(`[Nexus] Registered on Kroxy (wallet: ${WALLET}, endpoint: ${ENDPOINT})`);
  } catch (err) {
    console.error('[Nexus] Registration failed (continuing anyway):', err.message);
  }
}

// ─── Research ─────────────────────────────────────────────────────────────────

function buildResearchPrompt(description) {
  return `You are a research agent. Research the following topic thoroughly using web search.

Topic: ${description}

Return your response as a JSON object with EXACTLY this structure (no other text, just JSON):
{
  "summary": "comprehensive summary here (at least 150 words)",
  "keyFindings": ["finding 1", "finding 2", "finding 3"],
  "sources": ["url1", "url2", "url3"],
  "wordCount": 200,
  "confidence": 0.85
}

Use web search to find current information. The summary must be thorough and informative.`;
}

function extractJSON(content) {
  // Try to find JSON in the last text block
  for (let i = content.length - 1; i >= 0; i--) {
    if (content[i].type === 'text') {
      const text = content[i].text.trim();
      // Extract JSON from markdown code blocks if present
      const codeMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeMatch) return codeMatch[1].trim();
      // Otherwise try parsing the text directly
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return jsonMatch[0];
      return text;
    }
  }
  return '{}';
}

async function doResearch(jobId, description) {
  console.log(`[Nexus] Researching job ${jobId}: "${description.substring(0, 60)}..."`);

  if (DEMO_MODE || !anthropic) {
    const now = new Date().toISOString();
    return {
      summary: `Demo research result for "${description}". Generated locally at ${now}.`,
      keyFindings: [
        'Demo mode was enabled so no external model call was made',
        'Escrow and settlement checks can still be validated end-to-end',
        'Job delivery and verifier integration paths are active',
      ],
      sources: ['https://example.com/demo-source'],
      wordCount: 120,
      confidence: 0.95,
    };
  }

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    messages: [{ role: 'user', content: buildResearchPrompt(description) }],
  });

  const jsonStr = extractJSON(response.content);
  let result;
  try {
    result = JSON.parse(jsonStr);
  } catch {
    // Fallback structure if parsing fails
    result = {
      summary: jsonStr || 'Research completed.',
      keyFindings: [],
      sources: [],
      wordCount: (jsonStr || '').split(' ').length,
      confidence: 0.75,
    };
  }

  // Ensure required fields
  result.wordCount = result.wordCount ?? (result.summary || '').split(' ').length;
  result.confidence = result.confidence ?? 0.75;
  result.keyFindings = result.keyFindings ?? [];
  result.sources = result.sources ?? [];

  console.log(`[Nexus] Research done. wordCount=${result.wordCount}, confidence=${result.confidence}`);
  return result;
}

// ─── Job processing ───────────────────────────────────────────────────────────

async function pollJobUntil(jobId, condition, maxMs = 60_000, intervalMs = 5_000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const job = await apiGet(`/api/jobs/${jobId}`);
    if (condition(job)) return job;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

async function processJob(jobId) {
  if (activeJobs.has(jobId)) return;
  activeJobs.add(jobId);

  try {
    // 1. Fetch full job details
    const job = await apiGet(`/api/jobs/${jobId}`);
    if (job.status !== 'OPEN') {
      console.log(`[Nexus] Job ${jobId} is ${job.status}, skipping`);
      return;
    }

    // 2. Submit bid
    try {
      await apiPost(`/api/jobs/${jobId}/bid`, {
        providerWallet: WALLET,
        priceUsdc: PRICE_USDC,
        etaSeconds: 120,
        conditionsAccepted: true,
        message: 'Nexus research agent — Claude claude-sonnet-4-6 with live web search',
      });
      console.log(`[Nexus] Bid submitted for job ${jobId}`);
    } catch (err) {
      // Already bid or job gone
      console.log(`[Nexus] Bid failed for ${jobId}: ${err.message}`);
      return;
    }

    // 3. Wait for bid acceptance (our wallet must be the winning bid's provider)
    const acceptedJob = await pollJobUntil(
      jobId,
      (j) =>
        j.status === 'IN_PROGRESS' &&
        j.bids?.some((b) => b.providerWallet?.toLowerCase() === WALLET.toLowerCase() && b.status === 'ACCEPTED'),
      60_000
    );

    if (!acceptedJob) {
      console.log(`[Nexus] Bid not accepted within 60s for job ${jobId}`);
      return;
    }

    console.log(`[Nexus] Bid accepted for job ${jobId} — starting research`);

    // 4. Do the research
    const result = await doResearch(jobId, job.description);

    // 5. Store result for /quality-check endpoint
    resultMap.set(jobId, result);
    if (acceptedJob.escrowId) {
      resultMap.set(acceptedJob.escrowId, result);
    }

    // 6. Deliver result
    await apiPost(`/api/jobs/${jobId}/deliver`, {
      providerWallet: WALLET,
      deliverable: result,
    });

    console.log(`[Nexus] Delivered job ${jobId} — escrow evaluation triggered`);
  } catch (err) {
    console.error(`[Nexus] Error processing job ${jobId}:`, err.message);
  } finally {
    activeJobs.delete(jobId);
  }
}

function enqueueJob(jobId) {
  if (seenJobs.has(jobId)) return;
  seenJobs.add(jobId);
  // Process async, don't block the event loop
  processJob(jobId).catch((err) => console.error(`[Nexus] Unhandled job error ${jobId}:`, err.message));
}

// ─── Poll loop (fallback for missed webhooks) ──────────────────────────────────

async function pollForJobs() {
  try {
    const jobs = await apiGet('/api/jobs?status=OPEN&capability=research&limit=20');
    for (const job of jobs) {
      enqueueJob(job.id);
    }
  } catch (err) {
    console.error('[Nexus] Poll failed:', err.message);
  }
}

// ─── HTTP Server ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

// Health check — polled by Kroxy verifier as a condition
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', agent: 'nexus', ts: new Date().toISOString() });
});

// Quality check — polled by Kroxy verifier to check deliverable quality
// Returns the most recent research result metrics
app.get('/quality-check', (req, res) => {
  const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : null;
  const escrowId = typeof req.query.escrowId === 'string' ? req.query.escrowId : null;
  const lookupKey = jobId ?? escrowId;
  const result = lookupKey ? resultMap.get(lookupKey) : [...resultMap.values()].at(-1);

  if (!result) {
    res.json({ wordCount: 0, confidence: 0, jobId, escrowId });
    return;
  }

  res.json({
    wordCount: result.wordCount,
    confidence: result.confidence,
    jobId,
    escrowId,
  });
});

// Webhook — receives JOB_POSTED notifications from Kroxy API
app.post('/jobs', (req, res) => {
  const { type, jobId } = req.body ?? {};
  res.sendStatus(200); // respond immediately

  if (type === 'JOB_POSTED' && jobId) {
    console.log(`[Nexus] Webhook: new job ${jobId}`);
    enqueueJob(jobId);
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`[Nexus] Listening on port ${PORT}`);
  await register();
  // Initial poll to pick up any existing open jobs
  await pollForJobs();
  // Fallback poll every 30 seconds
  setInterval(pollForJobs, 30_000);
  console.log('[Nexus] Ready — polling every 30s, accepting webhooks');
});
