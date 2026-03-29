import { Prisma } from '@kroxy/db';
import { prisma } from '../lib/prisma';
import { AgentProfileDTO } from '@kroxy/types';
import { ethers } from 'ethers';
import { getProvider } from '../lib/ethers';
import { getReputationReadOnly } from './reputationService';
import { logger } from '../lib/logger';

const USDC_BASE_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const USDC_ABI = ['function balanceOf(address owner) view returns (uint256)'];

export interface BalanceSummary {
  wallet: string;
  usdcBalance: string;
  pendingEscrow: string;
  pendingEscrowCount: number;
  totalEarned: string;
  demo: boolean;
}

export interface RegisterAgentParams {
  walletAddress: string;
  name: string;
  endpoint: string;
  modelName?: string;
  capabilities: string[];
  pricingUsdc: number; // human-readable, e.g. 2.50
  slaUptimePct?: number;
  slaResponseMs?: number;
}

export interface FindAgentsParams {
  capability?: string;
  maxPrice?: number;
  minReputation?: number;
}

function toDTO(profile: {
  id: string;
  walletAddress: string;
  name: string;
  endpoint: string;
  modelName: string | null;
  capabilities: string[];
  pricingUsdc: { toString(): string };
  slaUptimePct: number;
  slaResponseMs: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}, reputationScore?: number): AgentProfileDTO {
  return {
    id: profile.id,
    walletAddress: profile.walletAddress,
    name: profile.name,
    endpoint: profile.endpoint,
    modelName: profile.modelName,
    capabilities: profile.capabilities,
    pricingUsdc: profile.pricingUsdc.toString(),
    slaUptimePct: profile.slaUptimePct,
    slaResponseMs: profile.slaResponseMs,
    active: profile.active,
    reputationScore,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export async function registerAgent(params: RegisterAgentParams): Promise<AgentProfileDTO> {
  const profile = await prisma.agentProfile.upsert({
    where: { walletAddress: params.walletAddress },
    update: {
      name: params.name,
      endpoint: params.endpoint,
      modelName: params.modelName ?? null,
      capabilities: params.capabilities,
      pricingUsdc: params.pricingUsdc,
      slaUptimePct: params.slaUptimePct ?? 99.0,
      slaResponseMs: params.slaResponseMs ?? 2000,
      active: true,
    },
    create: {
      walletAddress: params.walletAddress,
      name: params.name,
      endpoint: params.endpoint,
      modelName: params.modelName ?? null,
      capabilities: params.capabilities,
      pricingUsdc: params.pricingUsdc,
      slaUptimePct: params.slaUptimePct ?? 99.0,
      slaResponseMs: params.slaResponseMs ?? 2000,
    },
  });

  logger.info({ walletAddress: params.walletAddress }, 'Agent registered');
  return toDTO(profile);
}

export async function findAgents(params: FindAgentsParams): Promise<AgentProfileDTO[]> {
  const where: Prisma.AgentProfileWhereInput = { active: true };

  if (params.capability) {
    where.capabilities = { hasSome: [params.capability] };
  }
  if (params.maxPrice !== undefined) {
    where.pricingUsdc = { lte: params.maxPrice };
  }

  const profiles = await prisma.agentProfile.findMany({ where });

  // Enrich with on-chain reputation (best-effort — don't fail if contract unavailable)
  const enriched = await Promise.all(
    profiles.map(async (profile) => {
      let score: number | undefined;
      try {
        const rep = await getReputationReadOnly(profile.walletAddress);
        score = rep.score;
      } catch (err) {
        logger.debug({ err, wallet: profile.walletAddress }, 'Reputation fetch skipped');
      }
      return { profile, score };
    })
  );

  const filtered = params.minReputation !== undefined
    ? enriched.filter(({ score }) => score === undefined || score >= params.minReputation!)
    : enriched;

  return filtered
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map(({ profile, score }) => toDTO(profile, score));
}

export async function getAgentByWallet(walletAddress: string): Promise<AgentProfileDTO | null> {
  const profile = await prisma.agentProfile.findUnique({ where: { walletAddress } });
  if (!profile) return null;

  let score: number | undefined;
  try {
    const rep = await getReputationReadOnly(walletAddress);
    score = rep.score;
  } catch {
    // contract unavailable — return without score
  }

  return toDTO(profile, score);
}

export async function getWalletBalance(walletAddress: string): Promise<BalanceSummary> {
  const demoMode = process.env.KROXY_DEMO_MODE === '1';

  // Pending escrow: sum active escrow amounts where payer = wallet
  const activeEscrows = await prisma.escrowRecord.findMany({
    where: {
      payerAddress: { equals: walletAddress, mode: 'insensitive' },
      state: 'ACTIVE',
    },
    select: { amountUsdc: true },
  });
  const pendingEscrowCount = activeEscrows.length;
  // amountUsdc is stored as micro-USDC (e.g. 2500000 = $2.50), divide by 1e6
  const pendingEscrowRaw = activeEscrows.reduce(
    (sum, e) => sum + Number(e.amountUsdc ?? 0n) / 1_000_000,
    0,
  );

  // Total earned: from on-chain reputation (best-effort)
  let totalEarned = '0.00';
  try {
    const rep = await getReputationReadOnly(walletAddress);
    totalEarned = parseFloat(ethers.formatUnits(rep.totalEarned, 6)).toFixed(2);
  } catch {
    // Contract unavailable — leave as 0
  }

  // USDC on-chain balance
  let usdcBalance = '0.00';
  if (demoMode) {
    usdcBalance = '100.00';
  } else {
    try {
      const usdc = new ethers.Contract(USDC_BASE_ADDRESS, USDC_ABI, getProvider());
      const raw: bigint = await usdc.balanceOf(walletAddress);
      usdcBalance = parseFloat(ethers.formatUnits(raw, 6)).toFixed(2);
    } catch (err) {
      logger.debug({ err, wallet: walletAddress }, 'USDC balance fetch failed — returning 0');
    }
  }

  return {
    wallet: walletAddress,
    usdcBalance,
    pendingEscrow: pendingEscrowRaw.toFixed(2),
    pendingEscrowCount,
    totalEarned,
    demo: demoMode,
  };
}

// 60-second in-memory cache for leaderboard
let leaderboardCache: { data: AgentProfileDTO[]; at: number } | null = null;

export async function getLeaderboard(limit = 20): Promise<AgentProfileDTO[]> {
  const now = Date.now();
  if (leaderboardCache && now - leaderboardCache.at < 60_000) {
    return leaderboardCache.data.slice(0, limit);
  }

  const agents = await findAgents({});
  const sorted = agents.sort((a, b) => (b.reputationScore ?? 0) - (a.reputationScore ?? 0));
  leaderboardCache = { data: sorted, at: now };
  return sorted.slice(0, limit);
}
