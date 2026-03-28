import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
import { KroxySDK } from '@kroxy/sdk';
import type { KroxyPaymentRequirements } from '@kroxy/types';

const AGENT_B_URL = process.env.AGENT_B_URL ?? 'http://localhost:3002';
const KROXY_API_URL = process.env.KROXY_API_URL ?? 'http://localhost:3001';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  KROXY DEMO — Conditional AI Agent Payment');
  console.log('═══════════════════════════════════════════════════════\n');

  const payerPrivateKey = process.env.AGENT_A_PRIVATE_KEY;
  if (!payerPrivateKey) {
    throw new Error('AGENT_A_PRIVATE_KEY is not set. Set it in .env');
  }

  const sdk = new KroxySDK({ apiBase: KROXY_API_URL });

  // ─── Step 1: Request data from Agent B ───────────────────────────────────

  console.log('[Agent A] Step 1: Requesting data from Agent B...');
  console.log(`[Agent A] → GET ${AGENT_B_URL}/data-feed`);

  const initialResponse = await fetch(`${AGENT_B_URL}/data-feed`);

  if (initialResponse.status !== 402) {
    const data = await initialResponse.json();
    console.log('[Agent A] Got data without payment (escrow headers may already be set):');
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  console.log('[Agent A] ← 402 Payment Required (with Kroxy extension)');

  // ─── Step 2: Parse payment requirements ──────────────────────────────────

  const paymentHeader = initialResponse.headers.get('X-PAYMENT-REQUIRED') ?? '';
  let paymentRequired: KroxyPaymentRequirements;

  try {
    const decoded = Buffer.from(paymentHeader, 'base64').toString('utf-8');
    paymentRequired = JSON.parse(decoded) as KroxyPaymentRequirements;
  } catch {
    paymentRequired = await initialResponse.clone().json() as KroxyPaymentRequirements;
  }

  console.log('\n[Agent A] Payment requirements:');
  console.log(`  Amount:    $${parseInt(paymentRequired.maxAmountRequired) / 1_000_000} USDC`);
  console.log(`  Payee:     ${paymentRequired.payTo}`);
  console.log(`  Escrow:    ${paymentRequired.escrowDurationSeconds}s window`);
  console.log(`  Conditions: ${paymentRequired.kroxyConditions.conditions.length} condition(s)`);
  console.log(`  Pass rate:  ${paymentRequired.kroxyConditions.requiredPassRate * 100}% required`);

  // ─── Step 3: Create Kroxy escrow ─────────────────────────────────────────

  console.log('\n[Agent A] Step 2: Creating Kroxy escrow on Base...');

  const escrowResult = await sdk.createEscrow({
    payerPrivateKey,
    payeeAddress: paymentRequired.payTo,
    amountUsdc: parseInt(paymentRequired.maxAmountRequired, 10) / 1_000_000,
    conditions: paymentRequired.kroxyConditions,
    x402Reference: paymentRequired.resource,
    escrowDurationSeconds: paymentRequired.escrowDurationSeconds,
  });

  console.log('\n[Agent A] ✓ Escrow created on Base!');
  console.log(`  Escrow ID: ${escrowResult.escrowId}`);
  console.log(`  TX Hash:   ${escrowResult.txHash}`);
  console.log(`  Block:     ${escrowResult.blockNumber}`);
  console.log(`  Basescan:  ${escrowResult.basescanUrl}`);

  // ─── Step 4: Deliver data with escrow proof ───────────────────────────────

  console.log('\n[Agent A] Step 3: Requesting data with escrow proof...');

  const dataResponse = await fetch(`${AGENT_B_URL}/data-feed`, {
    headers: {
      'X-KROXY-ESCROW-ID': escrowResult.escrowId,
      'X-KROXY-TX-HASH': escrowResult.txHash,
    },
  });

  if (!dataResponse.ok) {
    throw new Error(`Agent B returned ${dataResponse.status}: ${await dataResponse.text()}`);
  }

  const data = await dataResponse.json();
  console.log('\n[Agent A] ✓ Data received from Agent B:');
  console.log(JSON.stringify(data, null, 2));

  // ─── Step 5: Wait for verification window ────────────────────────────────

  const windowSeconds = paymentRequired.kroxyConditions.windowSeconds;
  const checkInterval = paymentRequired.kroxyConditions.checkIntervalSeconds;
  const totalChecks = Math.floor(windowSeconds / checkInterval);

  console.log(`\n[Agent A] Step 4: Verification window open (${windowSeconds}s, ${totalChecks} checks)`);
  console.log('[Agent A] Kroxy is polling Agent B every 10s. Watch the dashboard at http://localhost:3000/demo');
  console.log('[Agent A] Waiting for automatic settlement...\n');

  for (let i = 0; i < totalChecks; i++) {
    await sleep(checkInterval * 1000);
    console.log(`[Agent A] ... check ${i + 1}/${totalChecks} completed (watching audit trail)`);
  }

  // Give the settlement a moment to process
  await sleep(3000);

  // ─── Step 6: Fetch final state ────────────────────────────────────────────

  console.log('\n[Agent A] Step 5: Fetching final escrow state...');
  const stateRes = await fetch(`${KROXY_API_URL}/api/escrows/${escrowResult.escrowId}`);
  const state = await stateRes.json();

  console.log(`\n[Agent A] Final state: ${state.state}`);

  if (state.state === 'RELEASED') {
    console.log('[Agent A] ✓ PAYMENT RELEASED — Agent B fulfilled the contract');
    console.log(`  Settlement TX: ${state.txHashSettled}`);
  } else if (state.state === 'DISPUTED') {
    console.log('[Agent A] ✗ DISPUTE RAISED — Agent B failed to meet conditions');
    console.log('  Funds are frozen. Owner can resolve via resolveDispute().');
  } else {
    console.log(`[Agent A] Current state: ${state.state}`);
  }

  console.log('\n[Agent A] Full audit trail:');
  const auditRes = await fetch(`${KROXY_API_URL}/api/audit/${escrowResult.escrowId}`);
  const auditEvents = await auditRes.json();
  for (const event of auditEvents) {
    console.log(`  [${event.sequence}] ${event.eventType} — ${event.createdAt}`);
    if (event.txHash) console.log(`       TX: ${event.txHash}`);
  }

  console.log('\n[Agent A] Demo complete. ✓');
  console.log('═══════════════════════════════════════════════════════\n');
}

runDemo().catch((err) => {
  console.error('[Agent A] Fatal error:', err.message);
  process.exit(1);
});
