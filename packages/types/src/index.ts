// ─── Audit ────────────────────────────────────────────────────────────────────
export interface AuditEventDTO {
  id: string;
  escrowId: string;
  eventType: string;
  data: Record<string, unknown>;
  rawData?: Record<string, unknown>;
  actorAddress?: string;
  actorRole?: string;
  thisHash?: string;
  sequence?: number;
  txHash?: string;
  prevHash: string | null;
  hash: string;
  createdAt: string;
  previousHash?: string;
}

// ─── Escrow ───────────────────────────────────────────────────────────────────
export interface EscrowRecordDTO {
  id: string;
  state: 'ACTIVE' | 'RELEASED' | 'DISPUTED' | 'RESOLVED';
  payerAddress: string;
  payeeAddress: string;
  amountUsdc: string;
  conditionsUrl: string | null;
  txHashCreated: string | null;
  txHashSettled: string | null;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ─── Job Board ────────────────────────────────────────────────────────────────
export interface JobPostingDTO {
  id: string;
  title?: string;
  description: string;
  budgetUsdc?: string;
  budgetMaxUsdc?: string;
  posterAddress?: string;
  posterWallet?: string;
  status: 'OPEN' | 'FILLED' | 'CLOSED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'AWARDED' | 'DISPUTED';
  deadline?: string;
  requiredCaps?: string[];
  bids?: Array<{ id: string; status: string; providerWallet: string; priceUsdc: string }>;
  escrowId?: string | null;
  winningBidId?: string | null;
  deliverable?: unknown;
  conditionsJson?: unknown;
  createdAt: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ─── x402 / Kroxy Payment Requirements ───────────────────────────────────────

export interface ConditionRule {
  type: 'http_status' | 'json_field' | 'latency_ms' | 'uptime_percent' | 'deliverable_quality';
  endpoint: string;
  operator: 'eq' | 'gte' | 'lte' | 'gt' | 'lt' | 'contains';
  expected: number | string | boolean | Record<string, unknown>;
  field?: string;
}

export interface ConditionsDefinition {
  version: string;
  escrowId: string;
  conditions: ConditionRule[];
  windowSeconds: number;
  checkIntervalSeconds: number;
  requiredPassRate: number;
}

/** Alias for ConditionRule — used interchangeably in the verifier. */
export type Condition = ConditionRule;

export interface KroxyPaymentRequirements {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  kroxyEnabled: boolean;
  conditionsHash: string;
  kroxyConditions: ConditionsDefinition;
  kroxyApiEndpoint: string;
  escrowDurationSeconds: number;
}

// ─── Agent ───────────────────────────────────────────────────────────────────

export interface AgentProfileDTO {
  id: string;
  walletAddress: string;
  name: string;
  endpoint: string;
  modelName?: string | null;
  capabilities: string[];
  pricingUsdc: string;
  slaUptimePct: number;
  slaResponseMs: number;
  active: boolean;
  reputationScore?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Bid ─────────────────────────────────────────────────────────────────────

export interface BidDTO {
  id: string;
  jobId: string;
  providerWallet: string;
  priceUsdc: string;
  etaSeconds?: number | null;
  conditionsAccepted: boolean;
  message?: string | null;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'WITHDRAWN';
  createdAt: string;
  [key: string]: unknown;
}

// ─── Escrow Registration ──────────────────────────────────────────────────────

export interface RegisterEscrowRequest {
  escrowId: string;
  payerAddress: string;
  payeeAddress: string;
  amountUsdc: number;
  conditionsHash: string;
  conditionsJson: ConditionsDefinition;
  x402Reference?: string;
  escrowDurationSeconds: number;
  txHash: string;
  blockNumber: number;
}

// ─── Reputation ───────────────────────────────────────────────────────────────
export interface ReputationDTO {
  address: string;
  score: number;
  totalJobs?: number;
  successRate?: number;
  successCount?: number;
  disputeCount?: number;
  totalEarned?: string;
  interpretation?: string;
  updatedAt?: string;
  demo?: boolean;
  [key: string]: unknown;
}
