// Re-export everything from the generated Prisma client.
// Run `pnpm --filter @kroxy/db generate` to regenerate after schema changes.
export { PrismaClient, Prisma } from '@prisma/client';
export type {
  EscrowRecord,
  AuditEvent,
  ConditionCheck,
  JobPosting,
  Bid,
  AgentProfile,
  ArbitrationCase,
  WebhookSubscription,
} from '@prisma/client';
export { EventType, ActorRole, EscrowState, JobStatus, BidStatus, ArbitrationStatus, Verdict } from '@prisma/client';
