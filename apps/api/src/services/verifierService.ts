import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';
import { appendAuditEvent } from './auditService';
import { deliverWebhook } from './webhookService';
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

async function runConditionCheck(conditions: Condition[], _version: string): Promise<CheckResult> {
  for (const condition of conditions) {
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

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const startMs = Date.now();

      const res = await fetch(condition.endpoint, { signal: controller.signal });
      const latencyMs = Date.now() - startMs;
      clearTimeout(timeout);

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
      }

      if (condition.type === 'json_field') {
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
      }

      if (condition.type === 'latency_ms') {
        // Measures actual end-to-end HTTP response time and compares it to threshold.
        // e.g. { type: 'latency_ms', operator: 'lte', expected: 500 } means p99 < 500ms.
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
      }

      if (condition.type === 'uptime_percent') {
        // Reads a numeric uptime percentage from a JSON field and compares it.
        // The endpoint must return a JSON body; 'field' specifies the path to
        // the uptime value (e.g. "status.uptime_pct").
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
    }
  }

  // No conditions defined — trivially passes
  return { passed: true, endpoint: '', httpStatus: 0, responseBody: {} };
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
        await deliverWebhook(state.escrowId, 'PAYMENT_RELEASED', {
          escrowId: state.escrowId,
          payeeAddress: state.payeeAddress,
          amountUsdc: state.amountUsdc.toString(),
          txHash,
          passRate,
          demoMode: true,
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
        await deliverWebhook(state.escrowId, 'DISPUTE_RAISED', {
          escrowId: state.escrowId,
          reason,
          passRate,
          txHash,
          demoMode: true,
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

      // Deliver webhooks for state change
      await deliverWebhook(state.escrowId, 'PAYMENT_RELEASED', {
        escrowId: state.escrowId,
        payeeAddress: state.payeeAddress,
        amountUsdc: state.amountUsdc.toString(),
        txHash: releaseReceipt.hash,
        passRate,
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

      await deliverWebhook(state.escrowId, 'DISPUTE_RAISED', {
        escrowId: state.escrowId,
        reason,
        passRate,
        txHash: disputeReceipt.hash,
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

    await deliverWebhook(escrowId, 'DISPUTE_RAISED', {
      escrowId,
      reason,
      evidenceData,
      manual: true,
      txHash,
      demoMode: true,
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

  await deliverWebhook(escrowId, 'DISPUTE_RAISED', {
    escrowId,
    reason,
    evidenceData,
    manual: true,
    txHash: receipt.hash,
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
  operator: 'eq' | 'gte' | 'lte' | 'contains',
  expected: unknown
): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected || String(actual) === String(expected);
    case 'gte':
      return Number(actual) >= Number(expected);
    case 'lte':
      return Number(actual) <= Number(expected);
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
