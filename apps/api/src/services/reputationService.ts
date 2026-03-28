import { getVerifierWallet, getProvider } from '../lib/ethers';
import { ethers } from 'ethers';

// Minimal ABI for KroxyReputation
const REPUTATION_ABI = [
  'function getReputation(address agent) view returns (uint256 successCount, uint256 disputeCount, uint256 totalEarned, uint256 lastUpdated)',
  'function getScore(address agent) view returns (uint256)',
  'function recordSuccess(address agent, uint256 amountEarned, bytes32 escrowId)',
  'function recordDispute(address agent, bytes32 escrowId)',
];

function getReputationContract(signer?: ethers.Wallet) {
  const address = process.env.KROXY_REPUTATION_ADDRESS;
  if (!address) throw new Error('KROXY_REPUTATION_ADDRESS is not set');
  const wallet = signer ?? getVerifierWallet();
  return new ethers.Contract(address, REPUTATION_ABI, wallet);
}

function getReputationContractReadOnly() {
  const address = process.env.KROXY_REPUTATION_ADDRESS;
  if (!address) throw new Error('KROXY_REPUTATION_ADDRESS is not set');
  return new ethers.Contract(address, REPUTATION_ABI, getProvider());
}

export async function getReputationReadOnly(agentAddress: string) {
  const contract = getReputationContractReadOnly();
  const [successCount, disputeCount, totalEarned, lastUpdated] =
    await contract.getReputation(agentAddress);
  const score = await contract.getScore(agentAddress);

  return {
    address: agentAddress,
    successCount: Number(successCount),
    disputeCount: Number(disputeCount),
    totalEarned: totalEarned.toString(),
    score: Number(score),
    lastUpdated: lastUpdated > 0n ? new Date(Number(lastUpdated) * 1000).toISOString() : null,
  };
}

export async function getReputation(address: string) {
  const contract = getReputationContract();
  const [successCount, disputeCount, totalEarned, lastUpdated] =
    await contract.getReputation(address);
  const score = await contract.getScore(address);

  return {
    address,
    successCount: Number(successCount),
    disputeCount: Number(disputeCount),
    totalEarned: totalEarned.toString(),
    score: Number(score),
    lastUpdated: lastUpdated > 0n ? new Date(Number(lastUpdated) * 1000).toISOString() : null,
  };
}

export async function recordSuccess(
  agentAddress: string,
  amountUsdc: bigint,
  escrowId: string
): Promise<string> {
  const contract = getReputationContract();
  const tx = await contract.recordSuccess(agentAddress, amountUsdc, escrowId);
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function recordDispute(agentAddress: string, escrowId: string): Promise<string> {
  const contract = getReputationContract();
  const tx = await contract.recordDispute(agentAddress, escrowId);
  const receipt = await tx.wait();
  return receipt.hash;
}
