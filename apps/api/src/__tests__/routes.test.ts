/**
 * Route validation unit tests.
 *
 * These tests exercise the Zod validation schemas used by the escrow
 * registration route. They run entirely in-process without a DB or network.
 */
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// ─── Inline schema mirror (keeps tests independent from route file) ───────────

const EthAddressSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{40}$/, 'Must be a valid Ethereum address');

const Bytes32Schema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, 'Must be a bytes32 hex string');

const ConditionSchema = z.object({
  type: z.enum(['http_status', 'json_field', 'latency_ms', 'uptime_percent']),
  endpoint: z.string().url(),
  field: z.string().optional(),
  operator: z.enum(['eq', 'gte', 'lte', 'contains']),
  expected: z.union([z.string(), z.number(), z.boolean()]),
});

const RegisterEscrowSchema = z.object({
  escrowId: Bytes32Schema,
  payerAddress: EthAddressSchema,
  payeeAddress: EthAddressSchema,
  amountUsdc: z.number().positive(),
  conditionsJson: z.object({
    version: z.literal('1.0'),
    escrowId: z.string().min(1),
    conditions: z.array(ConditionSchema).min(1),
    windowSeconds: z.number().int().positive(),
    checkIntervalSeconds: z.number().int().positive(),
    requiredPassRate: z.number().min(0).max(1),
  }),
  conditionsHash: Bytes32Schema,
  x402Reference: z.string().min(1),
  escrowDurationSeconds: z.number().int().positive(),
  txHash: Bytes32Schema,
  blockNumber: z.number().int().nonnegative(),
});

// ─── Valid fixture ────────────────────────────────────────────────────────────

const VALID_BODY = {
  escrowId: `0x${'a'.repeat(64)}`,
  payerAddress: `0x${'1'.repeat(40)}`,
  payeeAddress: `0x${'2'.repeat(40)}`,
  amountUsdc: 1.0,
  conditionsJson: {
    version: '1.0' as const,
    escrowId: `0x${'a'.repeat(64)}`,
    conditions: [
      {
        type: 'http_status' as const,
        endpoint: 'https://api.example.com/health',
        operator: 'eq' as const,
        expected: 200,
      },
    ],
    windowSeconds: 60,
    checkIntervalSeconds: 10,
    requiredPassRate: 0.8,
  },
  conditionsHash: `0x${'b'.repeat(64)}`,
  x402Reference: 'data-feed-v1',
  escrowDurationSeconds: 120,
  txHash: `0x${'c'.repeat(64)}`,
  blockNumber: 12345678,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegisterEscrow schema', () => {
  it('accepts a fully valid body', () => {
    const result = RegisterEscrowSchema.safeParse(VALID_BODY);
    expect(result.success).toBe(true);
  });

  it('rejects missing required fields', () => {
    const { escrowId: _, ...body } = VALID_BODY;
    const result = RegisterEscrowSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('rejects invalid Ethereum address (too short)', () => {
    const body = { ...VALID_BODY, payerAddress: '0xdeadbeef' };
    const result = RegisterEscrowSchema.safeParse(body);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain('payerAddress');
    }
  });

  it('rejects zero/negative amountUsdc', () => {
    expect(RegisterEscrowSchema.safeParse({ ...VALID_BODY, amountUsdc: 0 }).success).toBe(false);
    expect(RegisterEscrowSchema.safeParse({ ...VALID_BODY, amountUsdc: -5 }).success).toBe(false);
  });

  it('rejects requiredPassRate outside [0, 1]', () => {
    const body = {
      ...VALID_BODY,
      conditionsJson: { ...VALID_BODY.conditionsJson, requiredPassRate: 1.5 },
    };
    expect(RegisterEscrowSchema.safeParse(body).success).toBe(false);
  });

  it('rejects empty conditions array', () => {
    const body = {
      ...VALID_BODY,
      conditionsJson: { ...VALID_BODY.conditionsJson, conditions: [] },
    };
    const result = RegisterEscrowSchema.safeParse(body);
    expect(result.success).toBe(false);
  });

  it('rejects invalid condition endpoint URL', () => {
    const body = {
      ...VALID_BODY,
      conditionsJson: {
        ...VALID_BODY.conditionsJson,
        conditions: [{ ...VALID_BODY.conditionsJson.conditions[0], endpoint: 'not-a-url' }],
      },
    };
    expect(RegisterEscrowSchema.safeParse(body).success).toBe(false);
  });

  it('rejects unknown condition type', () => {
    const body = {
      ...VALID_BODY,
      conditionsJson: {
        ...VALID_BODY.conditionsJson,
        conditions: [{ ...VALID_BODY.conditionsJson.conditions[0], type: 'unknown_type' }],
      },
    };
    expect(RegisterEscrowSchema.safeParse(body).success).toBe(false);
  });

  it('rejects invalid txHash (wrong length)', () => {
    const body = { ...VALID_BODY, txHash: '0xdeadbeef' };
    expect(RegisterEscrowSchema.safeParse(body).success).toBe(false);
  });
});

// ─── Ethereum address validation ──────────────────────────────────────────────

describe('EthAddressSchema', () => {
  it('accepts checksummed addresses', () => {
    expect(EthAddressSchema.safeParse('0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045').success).toBe(true);
  });
  it('accepts lowercase addresses', () => {
    expect(EthAddressSchema.safeParse(`0x${'a'.repeat(40)}`).success).toBe(true);
  });
  it('rejects without 0x prefix', () => {
    expect(EthAddressSchema.safeParse('a'.repeat(40)).success).toBe(false);
  });
  it('rejects too-short address', () => {
    expect(EthAddressSchema.safeParse('0x1234').success).toBe(false);
  });
  it('rejects non-hex characters', () => {
    expect(EthAddressSchema.safeParse(`0x${'g'.repeat(40)}`).success).toBe(false);
  });
});
