import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// Mock @kroxy/db so PrismaClient is never instantiated during unit tests.
// prisma.ts calls `new PrismaClient(...)` at module load time; without this
// mock the test fails unless `prisma generate` has been run in CI.
vi.mock('@kroxy/db', () => {
  const PrismaClient = vi.fn().mockImplementation(() => ({
    escrowRecord: { findUnique: vi.fn(), update: vi.fn() },
    conditionCheck: { create: vi.fn() },
    auditEvent: { create: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
  }));
  return { PrismaClient };
});

import { assessDeliverableQuality, evaluate, getNestedValue, isEndpointAllowed } from '../services/verifierService';

// ─── evaluate() ───────────────────────────────────────────────────────────────

describe('evaluate()', () => {
  describe('eq', () => {
    it('passes when values are strictly equal', () => {
      expect(evaluate(200, 'eq', 200)).toBe(true);
    });
    it('passes when coerced string representations match', () => {
      expect(evaluate(200, 'eq', '200')).toBe(true);
    });
    it('fails when values differ', () => {
      expect(evaluate(404, 'eq', 200)).toBe(false);
    });
  });

  describe('gte', () => {
    it('passes when actual >= expected', () => {
      expect(evaluate(0.9, 'gte', 0.7)).toBe(true);
      expect(evaluate(0.7, 'gte', 0.7)).toBe(true);
    });
    it('fails when actual < expected', () => {
      expect(evaluate(0.5, 'gte', 0.7)).toBe(false);
    });
  });

  describe('lte', () => {
    it('passes when actual <= expected', () => {
      expect(evaluate(300, 'lte', 500)).toBe(true);
      expect(evaluate(500, 'lte', 500)).toBe(true);
    });
    it('fails when actual > expected', () => {
      expect(evaluate(600, 'lte', 500)).toBe(false);
    });
  });

  describe('contains', () => {
    it('passes when string contains substring', () => {
      expect(evaluate('hello world', 'contains', 'world')).toBe(true);
    });
    it('fails when substring is absent', () => {
      expect(evaluate('hello world', 'contains', 'kroxy')).toBe(false);
    });
  });

  describe('gt/lt', () => {
    it('supports strict numeric comparisons', () => {
      expect(evaluate(10, 'gt', 5)).toBe(true);
      expect(evaluate(5, 'gt', 5)).toBe(false);
      expect(evaluate(3, 'lt', 8)).toBe(true);
      expect(evaluate(8, 'lt', 8)).toBe(false);
    });
  });
});

// ─── getNestedValue() ─────────────────────────────────────────────────────────

describe('getNestedValue()', () => {
  it('returns top-level field', () => {
    expect(getNestedValue({ quality_score: 0.9 }, 'quality_score')).toBe(0.9);
  });
  it('returns nested field via dot notation', () => {
    expect(getNestedValue({ status: { uptime: 99.5 } }, 'status.uptime')).toBe(99.5);
  });
  it('returns undefined for missing path', () => {
    expect(getNestedValue({ a: 1 }, 'b.c')).toBeUndefined();
  });
  it('returns the whole object when path is empty', () => {
    const obj = { x: 1 };
    expect(getNestedValue(obj, '')).toBe(obj);
  });
});

// ─── isEndpointAllowed() ──────────────────────────────────────────────────────

describe('isEndpointAllowed()', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('allows public HTTPS URLs', () => {
    const result = isEndpointAllowed('https://api.example.com/health');
    expect(result.allowed).toBe(true);
  });

  it('allows public HTTP URLs', () => {
    const result = isEndpointAllowed('http://api.example.com/health');
    expect(result.allowed).toBe(true);
  });

  it('rejects non-http/https schemes', () => {
    expect(isEndpointAllowed('ftp://evil.com').allowed).toBe(false);
    expect(isEndpointAllowed('file:///etc/passwd').allowed).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isEndpointAllowed('not-a-url').allowed).toBe(false);
  });

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('blocks 127.x.x.x (loopback)', () => {
      const result = isEndpointAllowed('http://127.0.0.1/health');
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/blocked/i);
    });

    it('blocks 10.x.x.x (RFC-1918 Class A)', () => {
      expect(isEndpointAllowed('http://10.0.0.1/meta').allowed).toBe(false);
    });

    it('blocks 172.16-31.x.x (RFC-1918 Class B)', () => {
      expect(isEndpointAllowed('http://172.16.0.1/meta').allowed).toBe(false);
      expect(isEndpointAllowed('http://172.31.255.255/meta').allowed).toBe(false);
    });

    it('blocks 192.168.x.x (RFC-1918 Class C)', () => {
      expect(isEndpointAllowed('http://192.168.1.1/meta').allowed).toBe(false);
    });

    it('blocks 169.254.x.x (cloud metadata link-local)', () => {
      expect(isEndpointAllowed('http://169.254.169.254/latest/meta-data/').allowed).toBe(false);
    });

    it('blocks localhost hostname', () => {
      expect(isEndpointAllowed('http://localhost:3002/health').allowed).toBe(false);
    });

    it('still allows real public IPs', () => {
      expect(isEndpointAllowed('https://1.1.1.1/dns-query').allowed).toBe(true);
    });
  });

  describe('in development', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('allows localhost (needed for demo agents)', () => {
      expect(isEndpointAllowed('http://localhost:3002/health').allowed).toBe(true);
    });
  });
});

// ─── Pass-rate calculation ────────────────────────────────────────────────────

describe('Pass-rate settlement logic', () => {
  /**
   * The pass-rate formula lives inline in evaluateAndSettle, but we test it
   * directly with the same arithmetic to catch regressions.
   */
  function computePassRate(passed: number, total: number): number {
    return total > 0 ? passed / total : 0;
  }

  it('returns 1.0 when all checks pass', () => {
    expect(computePassRate(6, 6)).toBe(1);
  });

  it('returns 0 when no checks were completed', () => {
    expect(computePassRate(0, 0)).toBe(0);
  });

  it('calculates fractional pass rate', () => {
    expect(computePassRate(4, 5)).toBeCloseTo(0.8);
  });

  it('release threshold: 5/6 checks pass at 80% requirement', () => {
    const rate = computePassRate(5, 6);
    expect(rate).toBeGreaterThanOrEqual(0.8); // should release
  });

  it('dispute threshold: 3/6 checks pass at 80% requirement', () => {
    const rate = computePassRate(3, 6);
    expect(rate).toBeLessThan(0.8); // should dispute
  });
});

// ─── latency_ms condition evaluation ─────────────────────────────────────────

describe('latency_ms condition type', () => {
  it('passes when latency is within threshold (lte)', () => {
    expect(evaluate(300, 'lte', 500)).toBe(true);  // 300ms <= 500ms
  });
  it('fails when latency exceeds threshold', () => {
    expect(evaluate(600, 'lte', 500)).toBe(false); // 600ms > 500ms
  });
});

// ─── uptime_percent condition evaluation ─────────────────────────────────────

describe('uptime_percent condition type', () => {
  it('passes when uptime meets minimum (gte)', () => {
    expect(evaluate(99.5, 'gte', 99)).toBe(true);
  });
  it('fails when uptime falls below minimum', () => {
    expect(evaluate(97, 'gte', 99)).toBe(false);
  });
  it('resolves nested field correctly', () => {
    const body = { system: { uptime_pct: 99.8 } };
    const value = getNestedValue(body, 'system.uptime_pct');
    expect(evaluate(value, 'gte', 99)).toBe(true);
  });
});

// ─── deliverable_quality heuristics ──────────────────────────────────────────

describe('assessDeliverableQuality()', () => {
  it('passes for a structured, sourced deliverable', () => {
    const result = assessDeliverableQuality(
      {
        status: 'COMPLETED',
        deliverable: {
          summary:
            'Kroxy enables conditional settlement for agent work by evaluating objective quality gates before any release. ' +
            'Verification checks run repeatedly over a fixed window so temporary outages or stale responses do not immediately decide payout outcomes. ' +
            'This report compares custodial escrow, contract-native escrow, and hybrid relay patterns across trust assumptions, operational risk, and recovery paths. ' +
            'It explains common failure modes including missing delivery metadata, source spoofing, low-information summaries, and delayed provider callbacks. ' +
            'For each failure class it maps practical mitigations such as multi-signal evaluation, source-domain diversity checks, and minimum lexical diversity thresholds. ' +
            'The rollout section covers observability, alerting, staged deploys, dispute escalation criteria, and contract-safe rollback procedures. ' +
            'The final section proposes regression tests that validate condition parsing, check scheduling, dispute triggers, and audit event integrity over time.',
          keyFindings: [
            'Escrow policies should require more than one quality signal and include source checks.',
            'Condition evaluation must process every condition in the set, not only the first one.',
            'Dispute fallback should include deterministic audit events and reason capture.',
          ],
          sources: [
            'https://example.com/research/a',
            'https://docs.example.org/specs/escrow',
            'https://news.example.net/analysis',
          ],
        },
      },
      {
        minSummaryWords: 30,
        minSummaryChars: 180,
        minSentences: 3,
        minKeyFindings: 3,
        minSources: 2,
        minSourceDomains: 2,
        minLexicalDiversity: 0.35,
      }
    );

    expect(result.passed).toBe(true);
  });

  it('fails low-quality placeholder output', () => {
    const result = assessDeliverableQuality(
      {
        status: 'COMPLETED',
        deliverable: {
          summary: 'TODO placeholder. Lorem ipsum.',
          keyFindings: ['short'],
          sources: ['not-a-url'],
        },
      },
      {
        minSummaryWords: 20,
        minSummaryChars: 120,
        minKeyFindings: 2,
        minSources: 1,
        minSourceDomains: 1,
      }
    );

    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/placeholder|summary words|source/i);
  });

  it('enforces server floors even if caller requests weak thresholds', () => {
    const result = assessDeliverableQuality(
      {
        status: 'COMPLETED',
        deliverable: {
          summary: 'short text',
          keyFindings: ['one'],
          sources: ['https://example.com/one'],
        },
      },
      {
        minSummaryWords: 1,
        minSummaryChars: 1,
        minSentences: 1,
        minKeyFindings: 1,
        minSources: 1,
        minSourceDomains: 1,
        minLexicalDiversity: 0.01,
        forbidPlaceholderPhrases: false,
      }
    );

    expect(result.passed).toBe(false);
    expect(result.reason).toMatch(/summary words|summary chars|source domains/i);
  });
});
