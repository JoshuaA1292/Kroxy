/**
 * Kroxy REST API client.
 * Reads KROXY_API_URL and KROXY_API_KEY from process.env at call time,
 * so runtime-injected env vars are always used.
 */

import { fetchWithRetry } from './utils/fetchWithRetry.js';

export interface AgentProfile {
  walletAddress: string;
  name: string;
  capabilities: string[];
  pricingUsdc: string;
  endpoint: string;
  reputationScore?: number;
}

export interface Job {
  id: string;
  status: 'OPEN' | 'AWARDED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  bids?: Bid[];
  deliverable?: Record<string, unknown> | null;
  escrowId?: string | null;
  posterWallet: string;
  description: string;
  budgetMaxUsdc?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Bid {
  id: string;
  providerWallet: string;
  priceUsdc: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
}

export interface ConditionsDefinition {
  version: '1.0';
  escrowId: string;
  conditions: Condition[];
  windowSeconds: number;
  checkIntervalSeconds: number;
  requiredPassRate: number;
}

export interface Condition {
  type: 'http_status' | 'json_field' | 'latency_ms' | 'uptime_percent';
  endpoint: string;
  field?: string;
  operator: 'eq' | 'gte' | 'lte' | 'contains';
  expected: string | number | boolean;
}

export interface ReputationResult {
  walletAddress: string;
  successCount: number;
  disputeCount: number;
  totalEarned: string;
  score: number;
}

export interface BalanceSummary {
  wallet: string;
  usdcBalance: string;
  pendingEscrow: string;
  pendingEscrowCount: number;
  totalEarned: string;
  demo?: boolean;
}

export interface DisputeResult {
  escrowId: string;
  caseId?: string;
  status: string;
  message: string;
}

export interface AuditEvent {
  id: string;
  sequence: number;
  escrowId: string;
  eventType: string;
  actorAddress: string;
  rawData: unknown;
  txHash: string | null;
  createdAt: string;
}

function apiBase(): string {
  return process.env.KROXY_API_URL ?? 'http://localhost:3001';
}

function authHeaders(): Record<string, string> {
  const key = process.env.KROXY_API_KEY ?? '';
  return {
    'Content-Type': 'application/json',
    'X-Kroxy-API-Key': key,
  };
}

function apiError(method: string, path: string, status: number, body: string): Error {
  const base = apiBase();
  let hint = '';
  if (status === 401 || status === 403) {
    hint = ' Check KROXY_API_KEY in plugin config.';
  } else if (status === 404) {
    hint = ` Resource not found: ${path}`;
  } else if (status === 503) {
    hint = ` API may be starting up — retry in a moment. Is ${base} running?`;
  } else if (status === 0) {
    hint = ` Cannot reach ${base}. Check KROXY_API_URL. Set KROXY_DEMO_MODE=1 to use demo mode.`;
  }
  return new Error(`${method} ${path} → ${status}: ${body.slice(0, 200)}${hint}`);
}

async function apiGet<T>(path: string): Promise<T> {
  let resp: Response;
  try {
    resp = await fetchWithRetry(`${apiBase()}${path}`, { headers: authHeaders() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `GET ${path} failed: ${msg}. Cannot reach ${apiBase()} — check KROXY_API_URL. Set KROXY_DEMO_MODE=1 to skip network calls.`,
    );
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw apiError('GET', path, resp.status, body);
  }
  return resp.json() as Promise<T>;
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  let resp: Response;
  try {
    resp = await fetchWithRetry(`${apiBase()}${path}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `POST ${path} failed: ${msg}. Cannot reach ${apiBase()} — check KROXY_API_URL. Set KROXY_DEMO_MODE=1 to skip network calls.`,
    );
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw apiError('POST', path, resp.status, text);
  }
  return resp.json() as Promise<T>;
}

export function findAgents(capability: string, maxPrice: number): Promise<AgentProfile[]> {
  return apiGet(`/api/agents/find?capability=${encodeURIComponent(capability)}&maxPrice=${maxPrice}`);
}

export function getAgents(filters: {
  capability?: string;
  maxPrice?: number;
  limit?: number;
} = {}): Promise<AgentProfile[]> {
  const params = new URLSearchParams();
  if (filters.capability) params.set('capability', filters.capability);
  if (filters.maxPrice !== undefined) params.set('maxPrice', String(filters.maxPrice));
  const qs = params.toString();
  return apiGet(`/api/agents/find${qs ? `?${qs}` : ''}`);
}

export function postJob(
  jobId: string,
  description: string,
  capability: string,
  budgetUsdc: number,
  conditionsJson: ConditionsDefinition,
  posterWallet: string,
): Promise<Job> {
  const deadline = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  return apiPost('/api/jobs', {
    id: jobId,
    posterWallet,
    description,
    budgetMaxUsdc: budgetUsdc,
    requiredCaps: [capability],
    deadline,
    conditionsJson,
  });
}

export function acceptBid(
  jobId: string,
  bidId: string,
  payerPrivateKey: string,
): Promise<{ jobId: string; bidId: string; escrowId: string; txHash: string }> {
  return apiPost(`/api/jobs/${jobId}/accept/${bidId}`, { payerPrivateKey });
}

export function getJob(jobId: string): Promise<Job> {
  return apiGet(`/api/jobs/${jobId}`);
}

export function listJobs(filters: {
  status?: string;
  posterWallet?: string;
  limit?: number;
} = {}): Promise<Job[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.posterWallet) params.set('posterWallet', filters.posterWallet);
  if (filters.limit !== undefined) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return apiGet(`/api/jobs${qs ? `?${qs}` : ''}`);
}

export async function pollJob(
  jobId: string,
  condition: (job: Job) => boolean,
  maxMs = 300_000,
  intervalMs = 5_000,
): Promise<Job | null> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const job = await getJob(jobId);
    if (condition(job)) return job;
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  return null;
}

export function getReputation(walletAddress: string): Promise<ReputationResult> {
  return apiGet(`/api/reputation/${walletAddress}`);
}

export function getWalletBalance(walletAddress: string): Promise<BalanceSummary> {
  return apiGet(`/api/agents/${walletAddress}/balance`);
}

export function raiseDisputeForEscrow(
  escrowId: string,
  reason: string,
): Promise<DisputeResult> {
  return apiPost(`/api/escrows/${escrowId}/dispute`, { reason, evidenceData: {} });
}

export function getAuditTrail(escrowId: string): Promise<AuditEvent[]> {
  return apiGet(`/api/audit/${escrowId}`);
}

export function registerProvider(opts: {
  walletAddress: string;
  name: string;
  endpoint: string;
  capabilities: string[];
  pricingUsdc: number;
  modelName?: string;
}): Promise<AgentProfile> {
  return apiPost('/api/agents/register', {
    walletAddress: opts.walletAddress,
    name: opts.name,
    endpoint: opts.endpoint,
    modelName: opts.modelName,
    capabilities: opts.capabilities,
    pricingUsdc: opts.pricingUsdc,
    slaUptimePct: 99,
    slaResponseMs: 30000,
  });
}

export async function pingApi(): Promise<boolean> {
  try {
    const resp = await fetchWithRetry(`${apiBase()}/livez`, {}, 5_000);
    return resp.ok;
  } catch {
    return false;
  }
}
