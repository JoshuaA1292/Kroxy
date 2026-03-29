import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';
import { appendAuditEvent } from './auditService';
import { getVerifierWallet } from '../lib/ethers';
import { logger, escrowLogger } from '../lib/logger';
import { openCase } from './courtService';
import type { ConditionsDefinition, Condition } from '@kroxy/types';
import { randomBytes } from 'crypto';

// ─── Contract ABIs ────────────────────────────────────────────────────────────

const ESCROW_ABI = [
  'function releaseEscrow(bytes32 escrowId)',
  'function raiseDispute(bytes32 escrowId, string reason)',
];

const REPUTATION_ABI = [
  'function recordSuccess(address agent, uint256 amountEarned, bytes32 escrowId)',
  'function recordDispute(address agent, bytes32 escrowId)',
];

function getEscrowContract(signer: ethers.Wallet) {
  const address = process.env.KROXY_ESCROW_ADDRESS;
  if (!address) throw new Error('KROXY_ESCROW_ADDRESS is not set');
  return new ethers.Contract(address, ESCROW_ABI, signer);
}

function getReputationContract(signer: ethers.Wallet) {
  const address = process.env.KROXY_REPUTATION_ADDRESS;
  if (!address) throw new Error('KROXY_REPUTATION_ADDRESS is not set');
  return new ethers.Contract(address, REPUTATION_ABI, signer);
}

// ─── SSRF Protection ──────────────────────────────────────────────────────────

/**
 * Private/loopback IP patterns that should never be reachable from the
 * verifier in production (they expose cloud metadata, internal services, etc.)
 */
const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,                        // IPv4 loopback
  /^10\./,                         // RFC-1918 Class A
  /^172\.(1[6-9]|2\d|3[01])\./,   // RFC-1918 Class B
  /^192\.168\./,                   // RFC-1918 Class C
  /^169\.254\./,                   // Link-local (cloud metadata endpoint)
  /^100\.64\./,                    // CGNAT shared address space
  /^::1$/,                         // IPv6 loopback
  /^fc00:/i,                       // IPv6 Unique Local
  /^fe80:/i,                       // IPv6 Link-local
];

interface EndpointCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates a condition endpoint URL before fetching it.
 *
 * In production: blocks loopback, private RFC-1918 ranges, and link-local
 * addresses to prevent SSRF attacks against internal infrastructure or cloud
 * metadata services (e.g. 169.254.169.254).
 *
 * In development: allows all URLs including localhost so the demo agents work.
 */
export function isEndpointAllowed(rawUrl: string): EndpointCheckResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: `Invalid URL: ${rawUrl}` };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { allowed: false, reason: `Protocol not allowed: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (hostname === 'localhost' || PRIVATE_IP_PATTERNS.some((p) => p.test(hostname))) {
      return { allowed: false, reason: `Private/loopback address blocked in production: ${hostname}` };
    }
  }

  return { allowed: true };
}

// ─── Poller State ─────────────────────────────────────────────────────────────

interface PollerState {
  escrowId: string;
  conditions: ConditionsDefinition;
  expiresAt: Date;
  payeeAddress: string;
  amountUsdc: bigint;
  totalChecks: number;
  checksCompleted: number;
  checksPassed: number;
  intervalHandle: ReturnType<typeof setInterval>;
}

const activePollers = new Map<string, PollerState>();

function isDemoMode(): boolean {
  return process.env.KROXY_DEMO_MODE === '1';
}

function fakeTxHash(): string {
  return `0x${randomBytes(32).toString('hex')}`;
}

// ─── Boot ─────────────────────────────────────────────────────────────────────

export async function startVerificationEngine(): Promise<void> {
  const activeEscrows = await prisma.escrowRecord.findMany({
    where: { state: 'ACTIVE' },
  });

  for (const e of activeEscrows) {
    // Resume check counts from the ConditionCheck table so a restart mid-window
    // doesn't reset progress to zero and re-evaluate already-counted checks.
    const existingChecks = await prisma.conditionCheck.findMany({
      where: { escrowId: e.escrowId },
      orderBy: { checkNumber: 'asc' },
    });

    const checksCompleted = existingChecks.length;
    const checksPassed = existingChecks.filter((c) => c.passed).length;

    registerPoller(
      e.escrowId,
      e.conditionsJson as unknown as ConditionsDefinition,
      e.expiresAt,
      e.payeeAddress,
      e.amountUsdc,
      checksCompleted,
      checksPassed,
    );
  }

  if (activeEscrows.length > 0) {
    logger.info({ count: activeEscrows.length }, 'Verification engine resumed active pollers');
  }
}

// ─── Register Poller ──────────────────────────────────────────────────────────

export function registerPoller(
  escrowId: string,
  conditions: ConditionsDefinition,
  expiresAt: Date,
  payeeAddress: string,
  amountUsdc: bigint,
  initialChecksCompleted = 0,
  initialChecksPassed = 0,
): void {
  if (activePollers.has(escrowId)) return; // already watching

  const totalChecks = Math.floor(conditions.windowSeconds / conditions.checkIntervalSeconds);
  const log = escrowLogger(escrowId);

  const state: Omit<PollerState, 'intervalHandle'> = {
    escrowId,
    conditions,
    expiresAt,
    payeeAddress,
    amountUsdc,
    totalChecks,
    checksCompleted: initialChecksCompleted,
    checksPassed: initialChecksPassed,
  };

  const intervalHandle = setInterval(async () => {
    const s = activePollers.get(escrowId);
    if (!s) return;

    if (s.checksCompleted >= s.totalChecks) {
      clearInterval(s.intervalHandle);
      activePollers.delete(escrowId);
      await evaluateAndSettle(s);
      return;
    }

    await executeSingleCheck(s);
  }, conditions.checkIntervalSeconds * 1000);

  activePollers.set(escrowId, { ...state, intervalHandle });
  log.info(
    { totalChecks, intervalSeconds: conditions.checkIntervalSeconds, resumedAt: initialChecksCompleted },
    'Poller registered'
  );
}

// ─── Run Condition Check ──────────────────────────────────────────────────────

interface CheckResult {
  passed: boolean;
  endpoint: string;
  httpStatus: number;
  responseBody: unknown;
  latencyMs?: number;
  failReason?: string;
}

interface DeliverableQualityPolicy {
  minSummaryWords: number;
  minSummaryChars: number;
  minSentences: number;
  minKeyFindings: number;
  minFindingChars: number;
  minSources: number;
  minSourceDomains: number;
  minLexicalDiversity: number;
  requireCompletedStatus: boolean;
  forbidPlaceholderPhrases: boolean;
}

interface DeliverableQualityResult {
  passed: boolean;
  reason?: string;
  metrics: Record<string, unknown>;
}

const DEFAULT_DELIVERABLE_QUALITY_POLICY: DeliverableQualityPolicy = {
  minSummaryWords: 120,
  minSummaryChars: 600,
  minSentences: 3,
  minKeyFindings: 3,
  minFindingChars: 20,
  minSources: 2,
  minSourceDomains: 2,
  minLexicalDiversity: 0.45,
  requireCompletedStatus: true,
  forbidPlaceholderPhrases: true,
};

const PLACEHOLDER_PATTERN =
  /\b(lorem ipsum|placeholder|todo|tbd|as an ai language model|i cannot browse)\b/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toWordTokens(text: string): string[] {
  return text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
}

function countSentences(text: string): number {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
}

function toNumberOrDefault(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBooleanOrDefault(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseDeliverablePolicy(expected: unknown): DeliverableQualityPolicy {
  if (!isRecord(expected)) return { ...DEFAULT_DELIVERABLE_QUALITY_POLICY };
  // Server floors: caller-supplied thresholds may be stricter, never weaker.
  const floor = DEFAULT_DELIVERABLE_QUALITY_POLICY;
  return {
    minSummaryWords: Math.max(toNumberOrDefault(expected.minSummaryWords, floor.minSummaryWords), floor.minSummaryWords),
    minSummaryChars: Math.max(toNumberOrDefault(expected.minSummaryChars, floor.minSummaryChars), floor.minSummaryChars),
    minSentences: Math.max(toNumberOrDefault(expected.minSentences, floor.minSentences), floor.minSentences),
    minKeyFindings: Math.max(toNumberOrDefault(expected.minKeyFindings, floor.minKeyFindings), floor.minKeyFindings),
    minFindingChars: Math.max(toNumberOrDefault(expected.minFindingChars, floor.minFindingChars), floor.minFindingChars),
    minSources: Math.max(toNumberOrDefault(expected.minSources, floor.minSources), floor.minSources),
    minSourceDomains: Math.max(toNumberOrDefault(expected.minSourceDomains, floor.minSourceDomains), floor.minSourceDomains),
    minLexicalDiversity: Math.max(
      toNumberOrDefault(expected.minLexicalDiversity, floor.minLexicalDiversity),
      floor.minLexicalDiversity
    ),
    requireCompletedStatus: floor.requireCompletedStatus || toBooleanOrDefault(expected.requireCompletedStatus, false),
    forbidPlaceholderPhrases: floor.forbidPlaceholderPhrases || toBooleanOrDefault(expected.forbidPlaceholderPhrases, false),
  };
}

function sourceUrlFromItem(item: unknown): string | null {
  if (typeof item === 'string') return item;
  if (isRecord(item) && typeof item.url === 'string') return item.url;
  return null;
}

function countUniqueSourceDomains(rawSources: unknown): {
  sourceCount: number;
  validSourceCount: number;
  uniqueDomainCount: number;
} {
  if (!Array.isArray(rawSources)) {
    return { sourceCount: 0, validSourceCount: 0, uniqueDomainCount: 0 };
  }

  const domains = new Set<string>();
  let valid = 0;
  for (const item of rawSources) {
    const raw = sourceUrlFromItem(item);
    if (!raw) continue;
    try {
      const parsed = new URL(raw);
      if (!['http:', 'https:'].includes(parsed.protocol)) continue;
      valid++;
      domains.add(parsed.hostname.toLowerCase());
    } catch {
      continue;
    }
  }

  return {
    sourceCount: rawSources.length,
    validSourceCount: valid,
    uniqueDomainCount: domains.size,
  };
}

/**
 * Heuristic quality gate for deliverables. This is intentionally multi-signal
 * (structure + diversity + sourcing), not a single word-count threshold.
 */
export function assessDeliverableQuality(
  responseBody: unknown,
  expected: unknown,
  field?: string
): DeliverableQualityResult {
  const policy = parseDeliverablePolicy(expected);
  const bodyObj = isRecord(responseBody) ? responseBody : {};

  const status = String(bodyObj.status ?? '');
  const deliverableRaw =
    (field ? getNestedValue(responseBody, field) : undefined) ??
    bodyObj.deliverable ??
    responseBody;

  if (!isRecord(deliverableRaw)) {
    return {
      passed: false,
      reason: 'deliverable is missing or not an object',
      metrics: { status, hasDeliverableObject: false },
    };
  }

  const summary = typeof deliverableRaw.summary === 'string' ? deliverableRaw.summary.trim() : '';
  const keyFindingsRaw = Array.isArray(deliverableRaw.keyFindings) ? deliverableRaw.keyFindings : [];
  const findingLengths = keyFindingsRaw
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim().length);
  const meaningfulFindings = findingLengths.filter((n) => n >= policy.minFindingChars).length;

  const tokens = toWordTokens(summary);
  const uniqueTokens = new Set(tokens);
  const lexicalDiversity = tokens.length > 0 ? uniqueTokens.size / tokens.length : 0;
  const sentenceCount = countSentences(summary);

  const sourceStats = countUniqueSourceDomains(deliverableRaw.sources);
  const hasPlaceholder = policy.forbidPlaceholderPhrases && PLACEHOLDER_PATTERN.test(summary);

  const failures: string[] = [];
  if (policy.requireCompletedStatus && status !== 'COMPLETED') {
    failures.push(`status=${status || 'unknown'} (must be COMPLETED)`);
  }
  if (summary.length < policy.minSummaryChars) {
    failures.push(`summary chars ${summary.length} < ${policy.minSummaryChars}`);
  }
  if (tokens.length < policy.minSummaryWords) {
    failures.push(`summary words ${tokens.length} < ${policy.minSummaryWords}`);
  }
  if (sentenceCount < policy.minSentences) {
    failures.push(`summary sentences ${sentenceCount} < ${policy.minSentences}`);
  }
  if (meaningfulFindings < policy.minKeyFindings) {
    failures.push(`key findings ${meaningfulFindings} < ${policy.minKeyFindings}`);
  }
  if (sourceStats.validSourceCount < policy.minSources) {
    failures.push(`valid sources ${sourceStats.validSourceCount} < ${policy.minSources}`);
  }
  if (sourceStats.uniqueDomainCount < policy.minSourceDomains) {
    failures.push(`source domains ${sourceStats.uniqueDomainCount} < ${policy.minSourceDomains}`);
  }
  if (lexicalDiversity < policy.minLexicalDiversity) {
    failures.push(
      `lexical diversity ${lexicalDiversity.toFixed(2)} < ${policy.minLexicalDiversity.toFixed(2)}`
    );
  }
  if (hasPlaceholder) {
    failures.push('summary contains placeholder/disclaimer phrasing');
  }

  const metrics: Record<string, unknown> = {
    status,
    summaryChars: summary.length,
    summaryWords: tokens.length,
    sentenceCount,
    keyFindingsTotal: keyFindingsRaw.length,
    keyFindingsMeaningful: meaningfulFindings,
    lexicalDiversity,
    ...sourceStats,
    hasPlaceholder,
  };

  if (failures.length > 0) {
    return {
      passed: false,
      reason: failures.join('; '),
      metrics,
    };
  }

  return { passed: true, metrics };
}

async function evaluateCondition(condition: Condition): Promise<CheckResult> {
  // SSRF guard — validate before fetching
  const guard = isEndpointAllowed(condition.endpoint);
  if (!guard.allowed) {
    return {
      passed: false,
      endpoint: condition.endpoint,
      httpStatus: 0,
      responseBody: {},
      failReason: `SSRF guard: ${guard.reason}`,
    };
  }

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const controller = new AbortController();
    timeout = setTimeout(() => controller.abort(), 5000);
    const startMs = Date.now();

    const res = await fetch(condition.endpoint, { signal: controller.signal });
    const latencyMs = Date.now() - startMs;

    let body: unknown = {};
    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    if (condition.type === 'http_status') {
      const passed = evaluate(res.status, condition.operator, condition.expected as number);
      if (!passed) {
        return {
          passed: false,
          endpoint: condition.endpoint,
          httpStatus: res.status,
          responseBody: body,
          latencyMs,
          failReason: `HTTP ${res.status} failed: expected ${condition.operator} ${condition.expected}`,
        };
      }
    } else if (condition.type === 'json_field') {
      const value = getNestedValue(body, condition.field ?? '');
      const passed = evaluate(value, condition.operator, condition.expected);
      if (!passed) {
        return {
          passed: false,
          endpoint: condition.endpoint,
          httpStatus: res.status,
          responseBody: body,
          latencyMs,
          failReason: `Field ${condition.field} = ${JSON.stringify(value)} failed: expected ${condition.operator} ${condition.expected}`,
        };
      }
    } else if (condition.type === 'latency_ms') {
      const passed = evaluate(latencyMs, condition.operator, condition.expected as number);
      if (!passed) {
        return {
          passed: false,
          endpoint: condition.endpoint,
          httpStatus: res.status,
          responseBody: body,
          latencyMs,
          failReason: `Latency ${latencyMs}ms failed: expected ${condition.operator} ${condition.expected}ms`,
        };
      }
    } else if (condition.type === 'uptime_percent') {
      const value = getNestedValue(body, condition.field ?? 'uptime');
      const passed = evaluate(value, condition.operator, condition.expected);
      if (!passed) {
        return {
          passed: false,
          endpoint: condition.endpoint,
          httpStatus: res.status,
          responseBody: body,
          latencyMs,
          failReason: `Uptime ${JSON.stringify(value)}% failed: expected ${condition.operator} ${condition.expected}%`,
        };
      }
    } else if (condition.type === 'deliverable_quality') {
      const quality = assessDeliverableQuality(body, condition.expected, condition.field);
      if (!quality.passed) {
        return {
          passed: false,
          endpoint: condition.endpoint,
          httpStatus: res.status,
          responseBody: quality.metrics,
          latencyMs,
          failReason: `Deliverable quality failed: ${quality.reason}`,
        };
      }
    }

    return { passed: true, endpoint: condition.endpoint, httpStatus: res.status, responseBody: body, latencyMs };
  } catch (err) {
    return {
      passed: false,
      endpoint: condition.endpoint,
      httpStatus: 0,
      responseBody: {},
      failReason: `Network error: ${(err as Error).message}`,
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

async function runConditionCheck(conditions: Condition[], _version: string): Promise<CheckResult> {
  // No conditions defined — trivially passes
  if (!conditions.length) {
    return { passed: true, endpoint: '', httpStatus: 0, responseBody: {} };
  }

  let lastResult: CheckResult = { passed: true, endpoint: '', httpStatus: 0, responseBody: {} };

  // All conditions must pass for this check interval.
  for (const condition of conditions) {
    const result = await evaluateCondition(condition);
    if (!result.passed) return result;
    lastResult = result;
  }

  return {
    passed: true,
    endpoint: conditions.length === 1 ? lastResult.endpoint : `all:${conditions.length}`,
    httpStatus: lastResult.httpStatus,
    responseBody: lastResult.responseBody,
    latencyMs: lastResult.latencyMs,
  };
}

async function executeSingleCheck(state: PollerState): Promise<CheckResult> {
  state.checksCompleted++;
  const checkNumber = state.checksCompleted;
  const result = await runConditionCheck(state.conditions.conditions, state.conditions.version);
  if (result.passed) state.checksPassed++;

  await appendAuditEvent({
    escrowId: state.escrowId,
    eventType: 'CONDITION_CHECKED',
    actorAddress: 'kroxy-verifier',
    actorRole: 'KROXY_VERIFIER',
    rawData: {
      checkNumber,
      checksTotal: state.totalChecks,
      ...result,
    },
  });

  await prisma.conditionCheck.create({
    data: {
      escrowId: state.escrowId,
      checkNumber,
      endpoint: result.endpoint,
      httpStatus: result.httpStatus,
      responseBody: result.responseBody as object,
      passed: result.passed,
      failReason: result.failReason,
    },
  });

  escrowLogger(state.escrowId).info(
    { checkNumber, total: state.totalChecks, passed: result.passed, endpoint: result.endpoint },
    `Condition check ${result.passed ? 'PASS' : 'FAIL'}`
  );

  return result;
}

// ─── Evaluate and Settle ──────────────────────────────────────────────────────

async function evaluateAndSettle(state: PollerState): Promise<void> {
  const passRate = state.checksCompleted > 0
    ? state.checksPassed / state.checksCompleted
    : 0;
  const passed = passRate >= state.conditions.requiredPassRate;
  const log = escrowLogger(state.escrowId);

  log.info(
    {
      passRate: (passRate * 100).toFixed(1) + '%',
      required: (state.conditions.requiredPassRate * 100).toFixed(1) + '%',
      decision: passed ? 'RELEASE' : 'DISPUTE',
    },
    'Settling escrow'
  );

  try {
    if (isDemoMode()) {
      const verifierAddress = process.env.VERIFIER_HOT_WALLET ?? '0x0000000000000000000000000000000000000001';
      if (passed) {
        const txHash = fakeTxHash();
        await appendAuditEvent({
          escrowId: state.escrowId,
          eventType: 'PAYMENT_RELEASED',
          actorAddress: verifierAddress,
          actorRole: 'KROXY_VERIFIER',
          rawData: {
            passRate,
            checksPassed: state.checksPassed,
            checksTotal: state.checksCompleted,
            amountUsdc: state.amountUsdc.toString(),
            payeeAddress: state.payeeAddress,
            demoMode: true,
          },
          txHash,
          blockNumber: BigInt(0),
        });
        await prisma.escrowRecord.update({
          where: { escrowId: state.escrowId },
          data: { state: 'RELEASED', txHashSettled: txHash },
        });
        await appendAuditEvent({
          escrowId: state.escrowId,
          eventType: 'REPUTATION_UPDATED',
          actorAddress: state.payeeAddress,
          actorRole: 'AGENT_B',
          rawData: {
            action: 'success',
            amountEarned: state.amountUsdc.toString(),
            payeeAddress: state.payeeAddress,
            demoMode: true,
          },
        });
      } else {
        const reason = `Pass rate ${(passRate * 100).toFixed(1)}% below required ${(state.conditions.requiredPassRate * 100).toFixed(1)}%`;
        const txHash = fakeTxHash();
        await appendAuditEvent({
          escrowId: state.escrowId,
          eventType: 'DISPUTE_RAISED',
          actorAddress: verifierAddress,
          actorRole: 'KROXY_VERIFIER',
          rawData: {
            reason,
            passRate,
            checksPassed: state.checksPassed,
            checksTotal: state.checksCompleted,
            failedChecks: state.checksCompleted - state.checksPassed,
            demoMode: true,
          },
          txHash,
          blockNumber: BigInt(0),
        });
        await prisma.escrowRecord.update({
          where: { escrowId: state.escrowId },
          data: { state: 'DISPUTED', txHashSettled: txHash },
        });
        await appendAuditEvent({
          escrowId: state.escrowId,
          eventType: 'REPUTATION_UPDATED',
          actorAddress: state.payeeAddress,
          actorRole: 'AGENT_B',
          rawData: { action: 'dispute', reason, payeeAddress: state.payeeAddress, demoMode: true },
        });
      }
      return;
    }

    const wallet = getVerifierWallet();
    const escrowContract = getEscrowContract(wallet);
    const repContract = getReputationContract(wallet);

    if (passed) {
      const releaseTx = await escrowContract.releaseEscrow(state.escrowId);
      const releaseReceipt = await releaseTx.wait(2); // wait 2 confirmations

      await appendAuditEvent({
        escrowId: state.escrowId,
        eventType: 'PAYMENT_RELEASED',
        actorAddress: wallet.address,
        actorRole: 'KROXY_VERIFIER',
        rawData: {
          passRate,
          checksPassed: state.checksPassed,
          checksTotal: state.checksCompleted,
          amountUsdc: state.amountUsdc.toString(),
          payeeAddress: state.payeeAddress,
        },
        txHash: releaseReceipt.hash,
        blockNumber: BigInt(releaseReceipt.blockNumber),
      });

      await prisma.escrowRecord.update({
        where: { escrowId: state.escrowId },
        data: { state: 'RELEASED', txHashSettled: releaseReceipt.hash },
      });

      const repTx = await repContract.recordSuccess(state.payeeAddress, state.amountUsdc, state.escrowId);
      const repReceipt = await repTx.wait(2);

      await appendAuditEvent({
        escrowId: state.escrowId,
        eventType: 'REPUTATION_UPDATED',
        actorAddress: state.payeeAddress,
        actorRole: 'AGENT_B',
        rawData: {
          action: 'success',
          amountEarned: state.amountUsdc.toString(),
          payeeAddress: state.payeeAddress,
        },
        txHash: repReceipt.hash,
      });

      log.info({ txHash: releaseReceipt.hash }, 'Escrow released');
    } else {
      const reason = `Pass rate ${(passRate * 100).toFixed(1)}% below required ${(state.conditions.requiredPassRate * 100).toFixed(1)}%`;

      const disputeTx = await escrowContract.raiseDispute(state.escrowId, reason);
      const disputeReceipt = await disputeTx.wait(2);

      await appendAuditEvent({
        escrowId: state.escrowId,
        eventType: 'DISPUTE_RAISED',
        actorAddress: wallet.address,
        actorRole: 'KROXY_VERIFIER',
        rawData: {
          reason,
          passRate,
          checksPassed: state.checksPassed,
          checksTotal: state.checksCompleted,
          failedChecks: state.checksCompleted - state.checksPassed,
        },
        txHash: disputeReceipt.hash,
        blockNumber: BigInt(disputeReceipt.blockNumber),
      });

      await prisma.escrowRecord.update({
        where: { escrowId: state.escrowId },
        data: { state: 'DISPUTED', txHashSettled: disputeReceipt.hash },
      });

      // Non-blocking: open arbitration court case with 3 LLM judges
      const payerRecord = await prisma.escrowRecord.findUnique({
        where: { escrowId: state.escrowId },
        select: { payerAddress: true },
      });
      if (payerRecord) {
        openCase(state.escrowId, payerRecord.payerAddress, state.payeeAddress).catch((err) =>
          log.error({ err }, 'Court case failed to open')
        );
      }

      const repTx = await repContract.recordDispute(state.payeeAddress, state.escrowId);
      await repTx.wait(2);

      await appendAuditEvent({
        escrowId: state.escrowId,
        eventType: 'REPUTATION_UPDATED',
        actorAddress: state.payeeAddress,
        actorRole: 'AGENT_B',
        rawData: { action: 'dispute', reason, payeeAddress: state.payeeAddress },
      });

      log.info({ txHash: disputeReceipt.hash, reason }, 'Dispute raised');
    }
  } catch (err) {
    escrowLogger(state.escrowId).error(
      { err: (err as Error).message },
      'Settlement failed'
    );
  }
}

// ─── Manual Triggers ──────────────────────────────────────────────────────────

export async function triggerImmediateEvaluation(escrowId: string) {
  const state = activePollers.get(escrowId);
  if (!state) return null;

  if (state.checksCompleted < state.totalChecks) {
    await executeSingleCheck(state);
  }

  clearInterval(state.intervalHandle);
  activePollers.delete(escrowId);
  await evaluateAndSettle(state);

  return {
    released: state.checksPassed / Math.max(state.checksCompleted, 1) >= state.conditions.requiredPassRate,
    checksPassed: state.checksPassed,
    checksTotal: state.checksCompleted,
  };
}

export async function manualRaiseDispute(
  escrowId: string,
  reason: string,
  evidenceData: Record<string, unknown>
) {
  const state = activePollers.get(escrowId);
  if (!state) return null;

  clearInterval(state.intervalHandle);
  activePollers.delete(escrowId);

  if (isDemoMode()) {
    const txHash = fakeTxHash();
    await appendAuditEvent({
      escrowId,
      eventType: 'DISPUTE_RAISED',
      actorAddress: process.env.VERIFIER_HOT_WALLET ?? '0x0000000000000000000000000000000000000001',
      actorRole: 'KROXY_VERIFIER',
      rawData: { reason, evidenceData, manual: true, demoMode: true },
      txHash,
      blockNumber: BigInt(0),
    });

    await prisma.escrowRecord.update({
      where: { escrowId },
      data: { state: 'DISPUTED', txHashSettled: txHash },
    });

    await appendAuditEvent({
      escrowId,
      eventType: 'REPUTATION_UPDATED',
      actorAddress: state.payeeAddress,
      actorRole: 'AGENT_B',
      rawData: { action: 'dispute', reason, payeeAddress: state.payeeAddress, demoMode: true },
    });

    logger.info({ escrowId, txHash }, 'Manual dispute raised (demo mode)');
    return {
      txHash,
      escrowId,
      frozenAt: new Date().toISOString(),
    };
  }

  const wallet = getVerifierWallet();
  const escrowContract = getEscrowContract(wallet);
  const repContract = getReputationContract(wallet);

  const tx = await escrowContract.raiseDispute(escrowId, reason);
  const receipt = await tx.wait(2);

  await appendAuditEvent({
    escrowId,
    eventType: 'DISPUTE_RAISED',
    actorAddress: wallet.address,
    actorRole: 'KROXY_VERIFIER',
    rawData: { reason, evidenceData, manual: true },
    txHash: receipt.hash,
  });

  await prisma.escrowRecord.update({
    where: { escrowId },
    data: { state: 'DISPUTED', txHashSettled: receipt.hash },
  });

  const repTx = await repContract.recordDispute(state.payeeAddress, escrowId);
  await repTx.wait(2);

  logger.info({ escrowId, txHash: receipt.hash }, 'Manual dispute raised');

  return {
    txHash: receipt.hash as string,
    escrowId,
    frozenAt: new Date().toISOString(),
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function evaluate(
  actual: unknown,
  operator: 'eq' | 'gte' | 'lte' | 'gt' | 'lt' | 'contains',
  expected: unknown
): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected || String(actual) === String(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
    case 'gt':
      return Number(actual) > Number(expected);
    case 'lt':
      return Number(actual) < Number(expected);
    case 'contains':
      return String(actual).includes(String(expected));
    default:
      return false;
  }
}

export function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  return path.split('.').reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
