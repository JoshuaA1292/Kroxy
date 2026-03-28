import { createHash, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { EventType, ActorRole } from '@kroxy/db';
import type { Request, Response } from 'express';
import { logger } from '../lib/logger';

const GENESIS_HASH = '0'.repeat(64);

/** Maximum concurrent SSE connections per client IP. */
const MAX_SSE_PER_IP = 10;

/** Hard cap on total SSE connections across all clients. */
const MAX_TOTAL_SSE = 500;

// SSE client registry: maps Response → client IP
const sseClients = new Map<Response, string>();

// Per-IP connection counter
const ipConnectionCount = new Map<string, number>();

/**
 * Attempt to register a new SSE client.
 * Returns true if accepted, false if the connection was rejected due to limits.
 */
export function addSseClient(req: Request, res: Response): boolean {
  const ip = req.ip ?? 'unknown';

  if (sseClients.size >= MAX_TOTAL_SSE) {
    logger.warn({ ip, total: sseClients.size }, 'SSE: global connection limit reached');
    return false;
  }

  const ipCount = ipConnectionCount.get(ip) ?? 0;
  if (ipCount >= MAX_SSE_PER_IP) {
    logger.warn({ ip, ipCount }, 'SSE: per-IP connection limit reached');
    return false;
  }

  sseClients.set(res, ip);
  ipConnectionCount.set(ip, ipCount + 1);

  res.on('close', () => {
    sseClients.delete(res);
    const current = ipConnectionCount.get(ip) ?? 1;
    if (current <= 1) {
      ipConnectionCount.delete(ip);
    } else {
      ipConnectionCount.set(ip, current - 1);
    }
  });

  logger.debug({ ip, total: sseClients.size, ipCount: ipCount + 1 }, 'SSE client connected');
  return true;
}

function broadcastEvent(data: unknown): void {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const [client] of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

function generateId(): string {
  return randomBytes(12).toString('hex');
}

export interface AppendAuditEventParams {
  escrowId: string;
  eventType: EventType;
  actorAddress: string;
  actorRole: ActorRole;
  rawData: Record<string, unknown>;
  txHash?: string;
  blockNumber?: bigint;
}

export async function appendAuditEvent(params: AppendAuditEventParams): Promise<void> {
  const previous = await prisma.auditEvent.findFirst({
    where: { escrowId: params.escrowId },
    orderBy: { sequence: 'desc' },
    select: { thisHash: true },
  });

  const previousHash = previous?.thisHash ?? GENESIS_HASH;
  const id = generateId();
  const createdAt = new Date();

  const hashInput = [
    previousHash,
    id,
    params.escrowId,
    params.eventType,
    params.actorAddress,
    JSON.stringify(params.rawData),
    createdAt.toISOString(),
  ].join('|');

  const thisHash = createHash('sha256').update(hashInput).digest('hex');

  const event = await prisma.auditEvent.create({
    data: {
      id,
      escrowId: params.escrowId,
      eventType: params.eventType,
      actorAddress: params.actorAddress,
      actorRole: params.actorRole,
      rawData: params.rawData as object,
      txHash: params.txHash,
      blockNumber: params.blockNumber,
      previousHash,
      thisHash,
      createdAt,
    },
  });

  broadcastEvent({
    id: event.id,
    sequence: event.sequence,
    escrowId: event.escrowId,
    eventType: event.eventType,
    actorAddress: event.actorAddress,
    actorRole: event.actorRole,
    rawData: event.rawData,
    txHash: event.txHash,
    blockNumber: event.blockNumber?.toString() ?? null,
    previousHash: event.previousHash,
    thisHash: event.thisHash,
    createdAt: event.createdAt.toISOString(),
  });
}
