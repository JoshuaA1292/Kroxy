import { ethers } from 'ethers';

let provider: ethers.JsonRpcProvider | null = null;
let sepoliaProvider: ethers.JsonRpcProvider | null = null;

export function getProvider(): ethers.JsonRpcProvider {
  if (!provider) {
    const rpcUrl = process.env.BASE_RPC_URL ?? 'https://mainnet.base.org';
    provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return provider;
}

export function getSepoliaProvider(): ethers.JsonRpcProvider {
  if (!sepoliaProvider) {
    const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL ?? 'https://sepolia.base.org';
    sepoliaProvider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return sepoliaProvider;
}

export function getVerifierWallet(): ethers.Wallet {
  const pk = process.env.VERIFIER_PRIVATE_KEY;
  if (!pk) throw new Error('VERIFIER_PRIVATE_KEY is not set');
  return new ethers.Wallet(pk, getProvider());
}

export function getVerifierWalletSepolia(): ethers.Wallet {
  const pk = process.env.VERIFIER_PRIVATE_KEY;
  if (!pk) throw new Error('VERIFIER_PRIVATE_KEY is not set');
  return new ethers.Wallet(pk, getSepoliaProvider());
}
