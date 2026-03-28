import { createHmac, randomBytes } from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

const WEBHOOK_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2_000;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Deliver a webhook event to all matching subscriptions.
 *
 * Called by verifierService whenever escrow state changes.
 * Failures are logged but never throw — webhook delivery is best-effort and
 * must never block the settlement path.
 */
export async function deliverWebhook(
  escrowId: string,
  eventType: string,
  payload: Record<string, unknown>
): Promise<void> {
  let subscriptions;
  try {
    subscriptions = await prisma.webhookSubscription.findMany({
      where: {
        active: true,
        OR: [
          { escrowId },           // subscribed to this specific escrow
          { escrowId: null },     // subscribed to all escrows
        ],
      },
    });
  } catch (err) {
    logger.error({ err, escrowId, eventType }, 'Failed to query webhook subscriptions');
    return;
  }

  const matching = subscriptions.filter(
    (s) => s.events.length === 0 || s.events.includes(eventType)
  );

  if (matching.length === 0) return;

  const body = JSON.stringify({
    event: eventType,
    escrowId,
    timestamp: new Date().toISOString(),
    data: payload,
  });

  await Promise.allSettled(
    matching.map((sub) => deliverToSubscription(sub.id, sub.url, sub.secret, body, eventType))
  );
}

/**
 * Register a new webhook subscription.
 * Returns the subscription id and the generated secret to the caller once
 * (the raw secret is stored; callers should treat it as a bearer credential).
 */
export async function registerWebhook(params: {
  url: string;
  escrowId?: string;
  events?: string[];
}): Promise<{ id: string; secret: string }> {
  const secret = randomBytes(32).toString('hex');

  const sub = await prisma.webhookSubscription.create({
    data: {
      url: params.url,
      escrowId: params.escrowId ?? null,
      events: params.events ?? [],
      secret,
    },
  });

  return { id: sub.id, secret };
}

export async function listWebhooks(escrowId?: string) {
  return prisma.webhookSubscription.findMany({
    where: escrowId ? { escrowId } : {},
    select: {
      id: true,
      url: true,
      escrowId: true,
      events: true,
      active: true,
      createdAt: true,
      // Never expose the secret in list responses
    },
  });
}

export async function deleteWebhook(id: string): Promise<boolean> {
  try {
    await prisma.webhookSubscription.update({
      where: { id },
      data: { active: false },
    });
    return true;
  } catch {
    return false;
  }
}

// ─── Internal Delivery ────────────────────────────────────────────────────────

async function deliverToSubscription(
  subId: string,
  url: string,
  secret: string,
  body: string,
  eventType: string,
  attempt = 1
): Promise<void> {
  const signature = createHmac('sha256', secret).update(body).digest('hex');

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Kroxy-Signature': `sha256=${signature}`,
        'X-Kroxy-Event': eventType,
        'X-Kroxy-Delivery': subId,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutHandle);

    if (res.ok) {
      logger.info({ subId, url, status: res.status, event: eventType }, 'Webhook delivered');
      return;
    }

    logger.warn({ subId, url, status: res.status, attempt }, 'Webhook delivery failed (non-2xx)');
  } catch (err) {
    clearTimeout(timeoutHandle);
    logger.warn({ subId, url, err: (err as Error).message, attempt }, 'Webhook delivery error');
  }

  // Retry with exponential backoff
  if (attempt < MAX_RETRIES) {
    const delay = RETRY_DELAY_MS * 2 ** (attempt - 1);
    await new Promise((r) => setTimeout(r, delay));
    await deliverToSubscription(subId, url, secret, body, eventType, attempt + 1);
  } else {
    logger.error({ subId, url, event: eventType }, 'Webhook delivery exhausted retries');
  }
}
