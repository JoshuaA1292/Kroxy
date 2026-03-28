# Kroxy

**Conditional escrow · Immutable audit trail · On-chain reputation** — the contract enforcement layer for AI agent transactions.

> Where x402 handles "Agent A pays Agent B for a service," Kroxy handles "Agent A pays Agent B **only if the service is actually delivered**."

---

## Architecture

```
Agent A (buyer)  ─→  402 response  ─→  KroxySDK.createEscrow()
                                             │
                                    KroxyEscrow.sol (Base)
                                    USDC locked in escrow
                                             │
                              Kroxy API verification engine
                              polls Agent B every 10s for 60s
                                             │
                         conditions met?
                        YES ──→ releaseEscrow() ──→ USDC to Agent B
                        NO  ──→ raiseDispute()  ──→ funds frozen
                                             │
                              KroxyReputation.sol updated
                              Audit trail hash-chained
```

## Stack

| Layer | Tech |
|-------|------|
| Smart contracts | Solidity 0.8.24, Foundry, Base mainnet |
| Settlement token | USDC (6 decimals) |
| Backend | Node.js, Express 5, TypeScript |
| Database | Postgres 16, Prisma |
| SDK | TypeScript, ethers v6 |
| Dashboard | Next.js 14, Tailwind CSS |
| Monorepo | pnpm workspaces, Turbo |

---

## Quick Start

### One-Command Nexus E2E Demo

```bash
pnpm demo:e2e
```

This command:
- installs deps
- ensures Postgres is running
- runs Prisma generate + migrations
- starts API + Nexus in demo mode (no on-chain tx or external LLM key needed)
- runs `kroxy-hire.js` end-to-end and verifies escrow settles to `RELEASED`

### Prerequisites

- Node.js 20+, pnpm 9+
- Docker (for Postgres)
- [Foundry](https://book.getfoundry.sh/getting-started/installation)

### 1. Install dependencies

```bash
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in wallet private keys and RPC URLs
```

### 3. Start Postgres

```bash
docker compose up -d
```

### 4. Run DB migrations

```bash
pnpm --filter @kroxy/db db:migrate
```

### 5. Install Foundry dependencies

```bash
cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
```

### 6. Build and test contracts

```bash
cd packages/contracts
forge build
forge test -v
```

### 7. Deploy contracts (Sepolia first)

```bash
# Set in .env: DEPLOYER_PRIVATE_KEY, VERIFIER_HOT_WALLET, BASE_SEPOLIA_RPC_URL
forge script packages/contracts/script/Deploy.s.sol \
  --rpc-url base_sepolia \
  --broadcast \
  --verify

# Copy deployed addresses to .env: KROXY_ESCROW_ADDRESS, KROXY_REPUTATION_ADDRESS
```

### 8. Start all services

```bash
# Terminal 1: API + verification engine
pnpm --filter @kroxy/api dev

# Terminal 2: Agent B (data provider)
pnpm --filter @kroxy/agent-b dev

# Terminal 3: Dashboard
pnpm --filter @kroxy/dashboard dev
```

### 9. Run the demo

```bash
# Good data demo (payment released):
pnpm --filter @kroxy/agent-a start

# Bad data demo (dispute raised):
AGENT_B_QUALITY=0.3 pnpm --filter @kroxy/agent-b dev
# then in another terminal:
pnpm --filter @kroxy/agent-a start
```

Open http://localhost:3000/demo to watch the audit trail build in real time.

---

## Demo Flow

1. Agent A calls Agent B's `/data-feed` → receives `402` with `kroxyEnabled: true`
2. Agent A calls `sdk.createEscrow()` → $50 USDC locked on Base (visible on Basescan)
3. Dashboard shows `CONTRACT_CREATED` → `ESCROW_LOCKED` with live hash chain
4. Agent B delivers data; Kroxy pings `/health` and `/data-feed/quality-check` every 10s
5. After 60s: if 80%+ checks pass → `PAYMENT_RELEASED`, Agent B reputation +1
6. Alt: set `AGENT_B_QUALITY=0.3` → `DISPUTE_RAISED`, funds frozen

---

## Hash-Chained Audit Trail

Every event includes:

```
thisHash = SHA256(
  previousHash | id | escrowId | eventType | actorAddress | rawData | createdAt
)
```

The chain is tamper-evident: altering any event breaks all subsequent hashes. The dashboard's "Verify Chain" button recomputes all hashes in-browser.

---

## SDK Usage

```typescript
import { KroxySDK } from '@kroxy/sdk';

const sdk = new KroxySDK({ apiBase: 'https://api.kroxy.xyz' });

// 1. Create escrow (locks USDC on Base)
const escrow = await sdk.createEscrow({
  payerPrivateKey: process.env.PRIVATE_KEY,
  payeeAddress: '0x...',
  amountUsdc: 50,
  conditions: { ... },
  x402Reference: 'resource-id',
});

// 2. Trigger immediate evaluation
const result = await sdk.checkAndRelease({ escrowId: escrow.escrowId });

// 3. Raise dispute manually
await sdk.raiseDispute({
  escrowId: escrow.escrowId,
  reason: 'Data quality below threshold',
  evidenceData: { ... },
});
```

---

## Contracts

| Contract | Purpose |
|----------|---------|
| `KroxyEscrow` | USDC custody, conditional release/dispute |
| `KroxyReputation` | Per-wallet success/dispute counter, computed score |

Both are deployed by a `deployer` EOA. Only the `verifier` hot wallet (Kroxy backend) can call `releaseEscrow`, `raiseDispute`, `recordSuccess`, `recordDispute`. The `owner` multisig resolves disputed escrows.
