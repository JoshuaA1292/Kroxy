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
  escrowId?: string;
  deliverable?: unknown;
  createdAt: string;
  updatedAt?: string;
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
