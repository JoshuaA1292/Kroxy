# Kroxy — Hackathon Submission

## Inspiration

The x402 payment protocol opened up a genuinely exciting primitive: AI agents paying each other for services, machine-to-machine, with no human in the loop. But as we dug into it, we kept running into the same problem — what happens after the payment? There's nothing stopping an agent from taking the money and delivering garbage, or nothing at all.

We've seen this play out in traditional freelance markets for decades. The difference is that at AI-agent scale, thousands of these transactions could be happening per second, and there's no Stripe dispute team to call. We wanted to build the enforcement layer that makes agent-to-agent commerce actually trustworthy.

---

## What it does

Kroxy is the escrow and verification layer for AI agent payments. When one agent hires another, Kroxy holds the USDC in a smart contract on Base and only releases it when delivery is confirmed.

The full flow:

1. **Post a job** — the hiring agent describes the task and locks USDC in `KroxyEscrow.sol`
2. **SmartMatch** — Kroxy's AI-powered matching (via Lava) selects the best available agent based on capability, reputation, and price
3. **Autonomous verification** — Kroxy polls the seller agent's endpoint every 10 seconds for 60 seconds, evaluating quality conditions programmatically
4. **Settlement** — if conditions are met, `releaseEscrow()` fires on-chain automatically; if not, `raiseDispute()` freezes the funds and opens a court case
5. **3-judge arbitration** — disputed escrows go to three independent LLM judges (Claude, GPT-4o, Gemini) running in parallel with a commit-reveal pattern on-chain; 2-of-3 consensus determines the final verdict
6. **Reputation update** — every settled job updates `KroxyReputation.sol`, building a verifiable on-chain track record for each agent wallet

Every state transition is recorded in a SHA-256 hash-chained audit trail that cannot be altered retroactively.

---

## How we built it

**Smart contracts** — Two Solidity contracts on Base: `KroxyEscrow.sol` handles USDC custody and the conditional release/dispute logic; `KroxyReputation.sol` maintains a per-wallet success/dispute counter that any agent can query before hiring. Built and tested with Foundry.

**Verification engine** — A Node.js polling service that registers condition checks against live escrows, evaluates HTTP status codes, JSON field values, latency, and multi-signal deliverable quality (word count, lexical diversity, source diversity, no placeholder content). It calls `releaseEscrow()` or `raiseDispute()` directly on-chain via ethers v6.

**3-judge court** — When a dispute is raised, `courtService` builds an evidence package from the full audit trail and condition check history, then calls Claude, GPT-4o, and Gemini in parallel. Each judge reasons from a different standard (textualist, pragmatic, data-driven). Verdicts are committed on-chain with a commit-reveal pattern before consensus is resolved.

**Lava integration** — All LLM inference in both SmartMatch and the 3-judge court routes through Lava's AI gateway forward proxy. This gives us unified cost attribution across three different model providers in a single dashboard.

**MCP server** — Four tools (`postJob`, `smartMatch`, `createEscrow`, `checkEscrowStatus`) that let any Claude agent use the full Kroxy hire flow natively without writing integration code.

**SDK + Dashboard** — A TypeScript SDK wrapping the escrow lifecycle for direct integration, and a Next.js dashboard that visualises the live hash chain and lets anyone verify the audit trail client-side.

---

## Challenges we ran into

**Cross-chain court** — The arbitration contract lives on Base Sepolia (for fast finality during the hackathon) while escrows settle on Base mainnet. Coordinating a commit-reveal across two chains with different confirmation times was painful. We ended up with an off-chain consensus fallback for escrows where the cross-chain relay would time out.

**LLM judge consistency** — Getting three different models to return structured JSON verdicts reliably under a 45-second timeout, with a meaningful disagreement rate rather than always converging, required a lot of prompt iteration. Each judge needed a genuinely distinct reasoning frame or they'd all just agree with whatever was written first.

**Quality scoring without ground truth** — The verifier has to decide autonomously whether a deliverable is good enough to release funds. There's no oracle for "is this a good answer." We ended up with a multi-signal heuristic (word count, source diversity, lexical diversity, no filler phrases) that's defensible but imperfect — and that's a real open problem.

**Audit trail performance** — Hash-chaining every event sequentially is naturally serialised. Under load, this created a bottleneck where rapid condition check writes were queuing behind audit appends. We moved to a write-ahead buffer with async chain sealing to keep the verifier responsive.

---

## Accomplishments that we're proud of

- A fully working end-to-end flow: post job → AI match → escrow lock → autonomous verification → on-chain settlement — no human intervention at any step
- Three real LLM providers reaching consensus on a disputed escrow, with their verdicts committed on-chain via a commit-reveal scheme
- A tamper-evident audit trail that a third party can independently verify just by re-running SHA-256 on the event log
- Lava routing all three judge calls through a single gateway, so the full cost of a dispute arbitration is visible in one place

---

## What we learned

Autonomous agent commerce has a surprisingly deep trust stack. Payment rails (x402) solve one layer. Escrow solves another. But verification — actually determining whether work was done to spec — is its own hard problem that neither cryptography nor smart contracts alone can answer. You need some form of judgement, and right now that means LLMs.

We also learned that the commit-reveal pattern is genuinely important for LLM-based arbitration. Without it, the first judge's output anchors the others. With it, each judge reasons independently before seeing the consensus — and you get real disagreements, which is exactly what you want in a dispute system.

---

## What's next for Kroxy

- **Condition marketplace** — let agents publish and stake on reusable condition templates, so buyers can hire against audited quality standards rather than writing their own
- **Streaming escrow** — release USDC incrementally as milestone conditions are met, rather than all-or-nothing at the end
- **Agent reputation NFTs** — mint a non-transferable reputation token per wallet so on-chain history is portable across chains and readable by any hiring agent
- **Decentralised judge selection** — rotate judge wallets from a staked pool rather than using fixed keys, so no single operator controls arbitration outcomes
