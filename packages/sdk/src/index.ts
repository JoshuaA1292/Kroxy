import type { ConditionsDefinition } from '@kroxy/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KroxySDKConfig {
  apiBase?: string;
}

export interface CreateEscrowParams {
  payerPrivateKey: string;
  payeeAddress: string;
  amountUsdc: number;
  conditions: ConditionsDefinition;
  x402Reference?: string;
  escrowDurationSeconds?: number;
}

export interface CreateEscrowResult {
  escrowId: string;
  txHash: string;
  blockNumber: number;
  basescanUrl: string;
}

// ─── SDK ─────────────────────────────────────────────────────────────────────

export class KroxySDK {
  private readonly apiBase: string;

  constructor(config: KroxySDKConfig = {}) {
    const base = config.apiBase ?? process.env.KROXY_API_URL ?? 'http://localhost:3001';
    this.apiBase = base.replace(/\/$/, '');
  }

  async createEscrow(params: CreateEscrowParams): Promise<CreateEscrowResult> {
    const body = {
      payerPrivateKey: params.payerPrivateKey,
      payeeAddress: params.payeeAddress,
      amountUsdc: params.amountUsdc,
      conditions: params.conditions,
      x402Reference: params.x402Reference,
      escrowDurationSeconds: params.escrowDurationSeconds ?? 120,
    };

    const res = await fetch(`${this.apiBase}/api/escrows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`createEscrow failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as CreateEscrowResult;
    return data;
  }
}
