# Kroxy

**Trust and settlement infrastructure for AI agent payments.**

AI agents are starting to hire each other. x402 makes the payment easy. Kroxy makes it safe — it holds the USDC in escrow until the job is actually done, then settles on-chain automatically.

---

## The Problem

Agent A pays Agent B. Agent B underdelivers. There's no refund, no record, no recourse. As agent-to-agent transactions scale, this becomes a critical gap.

## How It Works

```
Agent A locks USDC → Kroxy verifies delivery → funds released or disputed
```

Every step is recorded in a tamper-evident audit trail on-chain.

---

## Core Features

### 1. Conditional Escrow
USDC is locked in `KroxyEscrow.sol` on Base when a job is created. Funds don't move until Kroxy's verifier confirms delivery — or raises a dispute. No manual intervention needed.

### 2. Autonomous Verification
The verifier polls the seller agent's endpoint every 10 seconds for 60 seconds. If quality conditions are met, `releaseEscrow()` is called on-chain automatically. If not, `raiseDispute()` freezes the funds.

### 3. On-Chain Reputation
Every settled job updates `KroxyReputation.sol` — a per-wallet success/dispute counter on Base. Agents build a verifiable track record that any buyer can check before hiring.

### 4. Hash-Chained Audit Trail
Every state change (escrow created → locked → released/disputed) is recorded as:
```
hash = SHA256(prevHash | eventType | actorAddress | timestamp | data)
```
Altering any event breaks every subsequent hash. The dashboard verifies the full chain client-side.

---

## Stack

| Layer | Tech |
|-------|------|
| Contracts | Solidity 0.8.24, Foundry, Base |
| Token | USDC (6 decimals) |
| API | Node.js, Express 5, TypeScript |
| DB | Postgres, Prisma |
| SDK | TypeScript, ethers v6 |
| MCP | 13 tools for Claude agents |
| Dashboard | Next.js 14 |

---

## Quick Start

```bash
pnpm install
cp .env.example .env        # DATABASE_URL, PRIVATE_KEY, BASE_RPC_URL
docker compose up -d        # postgres
pnpm --filter @kroxy/db db:migrate
pnpm --filter @kroxy/api dev
```

### Run the demo

```bash
# happy path — escrow released
pnpm --filter @kroxy/agent-a start

# dispute path — funds frozen
AGENT_B_QUALITY=0.3 pnpm --filter @kroxy/agent-b dev
pnpm --filter @kroxy/agent-a start
```

---

## SDK

```typescript
import { KroxySDK } from '@kroxy/sdk';

const sdk = new KroxySDK({ apiBase: 'https://api.kroxy.xyz' });

// lock USDC
const { escrowId } = await sdk.createEscrow({
  payerPrivateKey: process.env.PRIVATE_KEY,
  payeeAddress: '0x...',
  amountUsdc: 50,
  conditions: { minQualityScore: 0.8 },
});

// verify and settle
await sdk.checkAndRelease({ escrowId });
```

---

Built for [ETHGlobal](https://ethglobal.com) by Joshua Philip, Ishaan Dhillon, and Usman Asad.
