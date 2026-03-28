import { prisma } from '../lib/prisma';
import { appendAuditEvent } from './auditService';
import type { RegisterEscrowRequest, ConditionsDefinition } from '@kroxy/types';

export async function registerEscrow(req: RegisterEscrowRequest): Promise<void> {
  const expiresAt = new Date(Date.now() + req.escrowDurationSeconds * 1000);

  await prisma.escrowRecord.create({
    data: {
      escrowId: req.escrowId,
      payerAddress: req.payerAddress,
      payeeAddress: req.payeeAddress,
      amountUsdc: BigInt(Math.round(req.amountUsdc * 1_000_000)),
      conditionsHash: req.conditionsHash,
      conditionsJson: req.conditionsJson as object,
      x402Reference: req.x402Reference,
      state: 'ACTIVE',
      expiresAt,
      txHashCreated: req.txHash,
    },
  });

  await appendAuditEvent({
    escrowId: req.escrowId,
    eventType: 'CONTRACT_CREATED',
    actorAddress: req.payerAddress,
    actorRole: 'AGENT_A',
    rawData: {
      payerAddress: req.payerAddress,
      payeeAddress: req.payeeAddress,
      amountUsdc: req.amountUsdc,
      conditionsHash: req.conditionsHash,
      x402Reference: req.x402Reference,
      escrowDurationSeconds: req.escrowDurationSeconds,
    },
  });

  await appendAuditEvent({
    escrowId: req.escrowId,
    eventType: 'ESCROW_LOCKED',
    actorAddress: 'kroxy-escrow-contract',
    actorRole: 'SMART_CONTRACT',
    rawData: {
      txHash: req.txHash,
      blockNumber: req.blockNumber,
      amountUsdc: req.amountUsdc,
      escrowContract: process.env.KROXY_ESCROW_ADDRESS ?? 'unknown',
    },
    txHash: req.txHash,
    blockNumber: BigInt(req.blockNumber),
  });
}

export async function getEscrow(escrowId: string) {
  const e = await prisma.escrowRecord.findUnique({ where: { escrowId } });
  if (!e) return null;
  return {
    ...e,
    amountUsdc: e.amountUsdc.toString(),
    conditionsJson: e.conditionsJson as unknown as ConditionsDefinition,
    expiresAt: e.expiresAt.toISOString(),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}
