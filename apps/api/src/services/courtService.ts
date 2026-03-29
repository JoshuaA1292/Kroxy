import { ethers } from 'ethers';
import { prisma } from '../lib/prisma';
import { appendAuditEvent } from './auditService';
import { getVerifierWallet, getVerifierWalletSepolia, getSepoliaProvider } from '../lib/ethers';
import { logger } from '../lib/logger';
import { lavaAnthropic, lavaAvailable } from '../lib/lava';

// ─── Contract ABI ─────────────────────────────────────────────────────────────

const COURT_ABI = [
  'function openCase(bytes32 escrowId, address plaintiff, address defendant, bytes32 evidenceHash, address[3] judges) external',
  'function commitVerdict(bytes32 escrowId, address judge, bytes32 commitHash) external',
  'function revealVerdict(bytes32 escrowId, address judge, uint8 verdict, bytes32 salt) external',
  'function getCaseStatus(bytes32 escrowId) external view returns (uint8)',
  'event ConsensusReached(bytes32 indexed escrowId, uint8 verdict, address recipient)',
  'event SplitVerdict(bytes32 indexed escrowId)',
];

function getCourtContract() {
  const address = process.env.KROXY_COURT_ADDRESS;
  if (!address) throw new Error('KROXY_COURT_ADDRESS is not set');
  // Court is on Base Sepolia — use Sepolia provider/wallet
  return new ethers.Contract(address, COURT_ABI, getVerifierWalletSepolia());
}

// ─── Verdict encoding ─────────────────────────────────────────────────────────

const VERDICT_UINT: Record<string, number> = {
  PLAINTIFF_WINS: 0,
  DEFENDANT_WINS: 1,
  SPLIT: 2,
};

const VERDICT_FROM_UINT: Record<number, string> = {
  0: 'PLAINTIFF_WINS',
  1: 'DEFENDANT_WINS',
  2: 'SPLIT',
};

// ─── Judge wallets ────────────────────────────────────────────────────────────

function getJudgeWallets(softMode: boolean): [ethers.Wallet, ethers.Wallet, ethers.Wallet] {
  const keys = [
    process.env.COURT_JUDGE_1_PRIVATE_KEY,
    process.env.COURT_JUDGE_2_PRIVATE_KEY,
    process.env.COURT_JUDGE_3_PRIVATE_KEY,
  ];

  if (softMode) {
    // In soft mode, use judge keys if available (for addresses), else create dummy wallets
    if (keys.every(Boolean)) {
      return keys.map((k) => new ethers.Wallet(k!) as ethers.Wallet) as [ethers.Wallet, ethers.Wallet, ethers.Wallet];
    }
    // Return 3 random dummy wallets (addresses only — no provider needed in soft mode)
    return [
      ethers.Wallet.createRandom() as unknown as ethers.Wallet,
      ethers.Wallet.createRandom() as unknown as ethers.Wallet,
      ethers.Wallet.createRandom() as unknown as ethers.Wallet,
    ] as [ethers.Wallet, ethers.Wallet, ethers.Wallet];
  }

  if (!keys.every(Boolean)) throw new Error('COURT_JUDGE_1/2/3_PRIVATE_KEY must all be set');
  const provider = getSepoliaProvider();
  return keys.map((k) => new ethers.Wallet(k!, provider) as ethers.Wallet) as [ethers.Wallet, ethers.Wallet, ethers.Wallet];
}

// ─── Evidence package ─────────────────────────────────────────────────────────

async function buildEvidencePackage(escrowId: string) {
  const [escrowRecord, auditEvents, conditionChecks] = await Promise.all([
    prisma.escrowRecord.findUnique({ where: { escrowId } }),
    prisma.auditEvent.findMany({ where: { escrowId }, orderBy: { sequence: 'asc' } }),
    prisma.conditionCheck.findMany({ where: { escrowId }, orderBy: { checkedAt: 'asc' } }),
  ]);

  // Trim to keep token count manageable — LLMs don't need the full chain history
  return {
    escrowRecord: escrowRecord ? {
      escrowId:     escrowRecord.escrowId,
      amountUsdc:   escrowRecord.amountUsdc.toString(),
      state:        escrowRecord.state,
      payerAddress: escrowRecord.payerAddress,
      payeeAddress: escrowRecord.payeeAddress,
      conditionsJson: escrowRecord.conditionsJson,
    } : null,
    conditionChecks: conditionChecks.map(c => ({
      checkNumber: c.checkNumber,
      endpoint:    c.endpoint,
      httpStatus:  c.httpStatus,
      passed:      c.passed,
      failReason:  c.failReason,
    })),
    // Only include the most relevant audit events (dispute-related)
    keyEvents: auditEvents
      .filter(e => ['ESCROW_LOCKED','CONDITION_CHECKED','DISPUTE_RAISED'].includes(e.eventType))
      .slice(-20)
      .map(e => ({ eventType: e.eventType, actorRole: e.actorRole, rawData: e.rawData })),
  };
}

async function uploadToIpfs(evidence: object): Promise<string | null> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) return null;

  try {
    const resp = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        pinataContent: evidence,
        pinataMetadata: { name: `kroxy-evidence-${Date.now()}` },
      }),
    });
    if (!resp.ok) return null;
    const data = (await resp.json()) as { IpfsHash: string };
    return data.IpfsHash;
  } catch {
    return null;
  }
}

// ─── LLM judges ───────────────────────────────────────────────────────────────

interface JudgeResult {
  verdict: 'PLAINTIFF_WINS' | 'DEFENDANT_WINS' | 'SPLIT';
  reasoning: string;
  confidence: number;
}

const JUDGE_SYSTEM_PROMPTS = [
  // Judge 1 — strict textualist: focuses on exact condition compliance
  `You are Judge Alpha, a strict arbitration judge for the Kroxy AI agent payment network.
You apply a textualist standard: conditions must be EXACTLY met as specified — no benefit of the doubt.
Evaluate whether each HTTP condition was literally satisfied.
Respond with JSON only: {"verdict":"PLAINTIFF_WINS"|"DEFENDANT_WINS"|"SPLIT","reasoning":"1-2 sentences","confidence":0.0-1.0}
PLAINTIFF_WINS: any condition failed. DEFENDANT_WINS: all conditions passed. SPLIT: genuinely ambiguous data.`,

  // Judge 2 — reasonable standard: focuses on intent and substantial performance
  `You are Judge Beta, a pragmatic arbitration judge for the Kroxy AI agent payment network.
You apply a reasonable-performance standard: did the agent substantially deliver what was promised?
Minor technical failures that don't affect the service outcome should favor the defendant.
Respond with JSON only: {"verdict":"PLAINTIFF_WINS"|"DEFENDANT_WINS"|"SPLIT","reasoning":"1-2 sentences","confidence":0.0-1.0}
PLAINTIFF_WINS: material breach. DEFENDANT_WINS: substantial performance. SPLIT: borderline case.`,

  // Judge 3 — evidence weigher: focuses on statistical patterns across all checks
  `You are Judge Gamma, a data-driven arbitration judge for the Kroxy AI agent payment network.
You weigh the aggregate evidence statistically — what percentage of conditions passed, what was the overall pass rate?
A >70% pass rate generally favors the defendant; <40% favors the plaintiff.
Respond with JSON only: {"verdict":"PLAINTIFF_WINS"|"DEFENDANT_WINS"|"SPLIT","reasoning":"1-2 sentences citing pass rate","confidence":0.0-1.0}
PLAINTIFF_WINS: majority of conditions failed. DEFENDANT_WINS: majority passed. SPLIT: borderline 50/50.`,
];

function buildUserPrompt(evidence: object): string {
  return `Evaluate this escrow dispute:\n\n${JSON.stringify(evidence, null, 2)}`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Judge Alpha — Claude, routed through Lava's forward proxy when LAVA_SECRET_KEY is set.
 * All inference costs are tracked in the Lava dashboard.
 */
async function callClaudeJudge(evidence: object, personaIndex: number): Promise<JudgeResult> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set');

  const text = await lavaAnthropic({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    system: JUDGE_SYSTEM_PROMPTS[personaIndex],
    messages: [{ role: 'user', content: buildUserPrompt(evidence) }],
  });

  const via = lavaAvailable() ? 'Lava' : 'direct';
  logger.debug({ judge: 'alpha', via }, 'Claude judge completed');

  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as JudgeResult;
}

async function callGPT4oJudge(evidence: object, personaIndex: number): Promise<JudgeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');
  const { default: OpenAI } = await import('openai');
  const client = new OpenAI({ apiKey });

  const resp = await client.chat.completions.create({
    model: 'gpt-4o',
    response_format: { type: 'json_object' },
    max_tokens: 256,
    messages: [
      { role: 'system', content: JUDGE_SYSTEM_PROMPTS[personaIndex] },
      { role: 'user', content: buildUserPrompt(evidence) },
    ],
  });

  const text = resp.choices[0]?.message?.content ?? '{}';
  return JSON.parse(text) as JudgeResult;
}

async function callGeminiJudge(apiKey: string, evidence: object, personaIndex: number): Promise<JudgeResult> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai = new GoogleGenerativeAI(apiKey);
  const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `${JUDGE_SYSTEM_PROMPTS[personaIndex]}\n\n${buildUserPrompt(evidence)}\n\nRespond with JSON only.`;
  const result = await model.generateContent([prompt]);
  const text = result.response.text();
  const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned) as JudgeResult;
}

// Dispatch a single judge call — tries the preferred provider, falls back to Claude
async function callJudge(index: number, evidence: object): Promise<JudgeResult> {
  const geminiKeys = [
    process.env.GOOGLE_API_KEY_1 ?? '',
    process.env.GOOGLE_API_KEY_2 ?? '',
    process.env.GOOGLE_API_KEY_3 ?? '',
  ];

  if (index === 0 && process.env.ANTHROPIC_API_KEY) {
    return callClaudeJudge(evidence, 0);
  }
  if (index === 1 && process.env.OPENAI_API_KEY) {
    try { return await callGPT4oJudge(evidence, 1); } catch {
      // GPT-4o quota/error — fall through to Claude fallback
    }
  }
  if (index === 2 && geminiKeys[2]) {
    try { return await callGeminiJudge(geminiKeys[2], evidence, 2); } catch {
      // Gemini quota/error — fall through to Claude fallback
    }
  }
  // Universal fallback: Claude with this judge's persona
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('No LLM provider available for judge ' + index);
  return callClaudeJudge(evidence, index);
}

// ─── Main court flow ──────────────────────────────────────────────────────────

export async function openCase(
  escrowId: string,
  plaintiffWallet: string,
  defendantWallet: string
): Promise<void> {
  const softMode = !process.env.KROXY_COURT_ADDRESS;
  const log = logger.child({ escrowId: escrowId.slice(0, 18) + '…', softMode });

  try {
    const evidence = await buildEvidencePackage(escrowId);
    const ipfsHash = await uploadToIpfs(evidence);

    // Store in DB (fallback evidence JSON if IPFS unavailable)
    const arbitrationCase = await prisma.arbitrationCase.create({
      data: {
        escrowId,
        plaintiffWallet,
        defendantWallet,
        evidenceIpfsHash: ipfsHash,
        evidenceJson: ipfsHash ? undefined : (evidence as any),
        judgeCommits: [],
      },
    });

    // Get judge wallet addresses
    const judgeWallets = getJudgeWallets(softMode);
    const judgeAddresses = judgeWallets.map((w) => w.address) as [string, string, string];

    if (softMode) {
      // Soft mode: skip on-chain openCase call, just emit the audit event
      const verifierAddress = await getVerifierWallet().getAddress();
      await appendAuditEvent({
        escrowId,
        eventType: 'CASE_OPENED',
        actorAddress: verifierAddress,
        actorRole: 'KROXY_COURT',
        rawData: {
          caseId: arbitrationCase.id,
          plaintiffWallet,
          defendantWallet,
          evidenceIpfsHash: ipfsHash,
          judges: judgeAddresses,
          softMode: true,
        },
      });
    } else {
      // On-chain mode
      const court = getCourtContract();
      const evidenceBytes32 = ipfsHash
        ? ethers.keccak256(ethers.toUtf8Bytes(ipfsHash))
        : ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(evidence)));

      const openTx = await court.openCase(
        escrowId,
        plaintiffWallet,
        defendantWallet,
        evidenceBytes32,
        judgeAddresses
      );
      await openTx.wait(1);

      await appendAuditEvent({
        escrowId,
        eventType: 'CASE_OPENED',
        actorAddress: await getVerifierWallet().getAddress(),
        actorRole: 'KROXY_COURT',
        rawData: {
          caseId: arbitrationCase.id,
          plaintiffWallet,
          defendantWallet,
          evidenceIpfsHash: ipfsHash,
          judges: judgeAddresses,
          txHash: openTx.hash,
        },
        txHash: openTx.hash,
      });
    }

    if (ipfsHash) {
      await appendAuditEvent({
        escrowId,
        eventType: 'EVIDENCE_POSTED',
        actorAddress: await getVerifierWallet().getAddress(),
        actorRole: 'KROXY_COURT',
        rawData: { ipfsHash, caseId: arbitrationCase.id },
      });
    }

    log.info({ caseId: arbitrationCase.id }, 'Court case opened');

    // Run LLM judges non-blocking
    runLLMJudges(escrowId, evidence, judgeWallets, judgeAddresses, softMode).catch((err) =>
      log.error({ err }, 'LLM judge run failed')
    );
  } catch (err) {
    log.error({ err }, 'Failed to open court case');
    throw err;
  }
}

async function runLLMJudges(
  escrowId: string,
  evidence: object,
  judgeWallets: [ethers.Wallet, ethers.Wallet, ethers.Wallet],
  judgeAddresses: [string, string, string],
  softMode: boolean
): Promise<void> {
  const log = logger.child({ escrowId: escrowId.slice(0, 18) + '…', softMode });
  const verifierAddress = await getVerifierWallet().getAddress();

  const TIMEOUT_MS = 45_000;
  const [judge1Result, judge2Result, judge3Result] = await Promise.allSettled([
    withTimeout(callJudge(0, evidence), TIMEOUT_MS, 'Judge 1'),
    withTimeout(callJudge(1, evidence), TIMEOUT_MS, 'Judge 2'),
    withTimeout(callJudge(2, evidence), TIMEOUT_MS, 'Judge 3'),
  ]);

  const judgeNames = ['judge-alpha', 'judge-beta', 'judge-gamma'] as const;
  const results = [judge1Result, judge2Result, judge3Result];

  interface CommitData {
    index: number;
    judgeAddress: string;
    verdict: string;
    verdictUint: number;
    salt: string;
    commitHash: string;
    reasoning: string;
    confidence: number;
  }

  const commits: CommitData[] = [];

  for (let i = 0; i < 3; i++) {
    const result = results[i];
    if (result.status === 'rejected') {
      log.error({ judge: judgeNames[i], err: String(result.reason) }, 'LLM judge failed');
      continue;
    }

    const { verdict, reasoning, confidence } = result.value;
    const verdictUint = VERDICT_UINT[verdict] ?? 2;
    const salt = ethers.hexlify(ethers.randomBytes(32));
    const commitHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(['uint8', 'bytes32'], [verdictUint, salt])
    );

    commits.push({
      index: i,
      judgeAddress: judgeAddresses[i],
      verdict,
      verdictUint,
      salt,
      commitHash,
      reasoning,
      confidence,
    });
  }

  if (commits.length === 0) {
    log.error('All LLM judges failed — case requires manual resolution');
    await appendAuditEvent({
      escrowId,
      eventType: 'JUDGE_COMMITTED',
      actorAddress: verifierAddress,
      actorRole: 'KROXY_COURT',
      rawData: { error: 'All judges failed', requiresManualResolution: true },
    });
    return;
  }

  if (softMode) {
    // Soft mode: emit JUDGE_COMMITTED events without on-chain calls
    for (const commit of commits) {
      await appendAuditEvent({
        escrowId,
        eventType: 'JUDGE_COMMITTED',
        actorAddress: verifierAddress,
        actorRole: 'KROXY_COURT',
        rawData: {
          judge: judgeNames[commit.index],
          judgeAddress: commit.judgeAddress,
          commitHash: commit.commitHash,
          softMode: true,
        },
      });
      log.info({ judge: judgeNames[commit.index] }, 'Verdict committed (soft mode)');
    }

    // Soft mode: emit JUDGE_REVEALED events without on-chain calls
    for (const commit of commits) {
      await appendAuditEvent({
        escrowId,
        eventType: 'JUDGE_REVEALED',
        actorAddress: verifierAddress,
        actorRole: 'KROXY_COURT',
        rawData: {
          judge: judgeNames[commit.index],
          judgeAddress: commit.judgeAddress,
          verdict: commit.verdict,
          verdictUint: commit.verdictUint,
          reasoning: commit.reasoning,
          confidence: commit.confidence,
          softMode: true,
        },
      });
      log.info({ judge: judgeNames[commit.index], verdict: commit.verdict }, 'Verdict revealed (soft mode)');
    }

    // Derive consensus locally (2/3 majority)
    const verdictCounts: Record<string, number> = {};
    for (const c of commits) { verdictCounts[c.verdict] = (verdictCounts[c.verdict] ?? 0) + 1; }
    let consensus = 'SPLIT';
    for (const [v, count] of Object.entries(verdictCounts)) {
      if (count >= 2) { consensus = v; break; }
    }

    await prisma.arbitrationCase.update({
      where: { escrowId },
      data: { status: 'RESOLVED', verdict: consensus as any, resolvedAt: new Date() },
    });

    await appendAuditEvent({
      escrowId,
      eventType: 'CONSENSUS_REACHED',
      actorAddress: verifierAddress,
      actorRole: 'KROXY_COURT',
      rawData: { verdict: consensus, softMode: true, note: 'Simulated commit-reveal (no on-chain court)' },
    });

    log.info({ verdict: consensus }, 'Consensus reached (soft mode)');
    return;
  }

  // On-chain mode
  const court = getCourtContract();

  // Commit phase — sequential for gas management
  for (const commit of commits) {
    try {
      const tx = await court.commitVerdict(escrowId, commit.judgeAddress, commit.commitHash);
      await tx.wait(1);

      await appendAuditEvent({
        escrowId,
        eventType: 'JUDGE_COMMITTED',
        actorAddress: verifierAddress,
        actorRole: 'KROXY_COURT',
        rawData: {
          judge: judgeNames[commit.index],
          judgeAddress: commit.judgeAddress,
          commitHash: commit.commitHash,
          txHash: tx.hash,
        },
        txHash: tx.hash,
      });

      log.info({ judge: judgeNames[commit.index] }, 'Verdict committed');
    } catch (err) {
      log.error({ err, judge: judgeNames[commit.index] }, 'Commit failed');
    }
  }

  // Reveal phase — sequential
  const revealedCommits: CommitData[] = [];
  for (const commit of commits) {
    try {
      const tx = await court.revealVerdict(
        escrowId,
        commit.judgeAddress,
        commit.verdictUint,
        commit.salt
      );
      await tx.wait(1);
      revealedCommits.push(commit);

      await appendAuditEvent({
        escrowId,
        eventType: 'JUDGE_REVEALED',
        actorAddress: verifierAddress,
        actorRole: 'KROXY_COURT',
        rawData: {
          judge: judgeNames[commit.index],
          judgeAddress: commit.judgeAddress,
          verdict: commit.verdict,
          verdictUint: commit.verdictUint,
          reasoning: commit.reasoning,
          confidence: commit.confidence,
          txHash: tx.hash,
        },
        txHash: tx.hash,
      });

      log.info({ judge: judgeNames[commit.index], verdict: commit.verdict }, 'Verdict revealed');
    } catch (err) {
      // 3rd reveal may fail because _executeConsensus calls emergencyResolve on an
      // escrow that doesn't exist on Base Sepolia — still emit the reveal event
      // and fall through to off-chain consensus resolution below.
      log.error({ err, judge: judgeNames[commit.index] }, 'On-chain reveal failed — falling back to off-chain consensus');

      // Still emit JUDGE_REVEALED so the dashboard shows the verdict
      await appendAuditEvent({
        escrowId,
        eventType: 'JUDGE_REVEALED',
        actorAddress: verifierAddress,
        actorRole: 'KROXY_COURT',
        rawData: {
          judge: judgeNames[commit.index],
          judgeAddress: commit.judgeAddress,
          verdict: commit.verdict,
          verdictUint: commit.verdictUint,
          reasoning: commit.reasoning,
          confidence: commit.confidence,
          note: 'reveal revert — cross-chain escrow; consensus resolved off-chain',
        },
      });
      revealedCommits.push(commit);
    }
  }

  // Off-chain consensus — derive from in-memory commits (handles cross-chain escrow case
  // where _executeConsensus can't call emergencyResolve on the other network).
  const verdictCounts: Record<string, number> = {};
  for (const c of revealedCommits) { verdictCounts[c.verdict] = (verdictCounts[c.verdict] ?? 0) + 1; }
  let consensus = 'SPLIT';
  for (const [v, count] of Object.entries(verdictCounts)) {
    if (count >= 2) { consensus = v; break; }
  }

  await prisma.arbitrationCase.update({
    where: { escrowId },
    data: { status: 'RESOLVED', verdict: consensus as any, resolvedAt: new Date() },
  });

  await appendAuditEvent({
    escrowId,
    eventType: 'CONSENSUS_REACHED',
    actorAddress: verifierAddress,
    actorRole: 'KROXY_COURT',
    rawData: { verdict: consensus, note: 'Off-chain consensus (cross-chain escrow/court setup)' },
  });

  log.info({ verdict: consensus }, 'Consensus reached (off-chain derivation)');
}
