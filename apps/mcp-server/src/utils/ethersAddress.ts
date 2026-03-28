/**
 * Derives an Ethereum address from a private key.
 *
 * Uses require() instead of a static import to avoid loading ethers' heavy
 * type definitions into the TypeScript compiler, which exhausts the tsc heap
 * in this package.
 */
export function computeAddressFromPrivateKey(privateKey: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const lib = require('ethers');
  const signingKey = new lib.SigningKey(privateKey);
  return lib.computeAddress(signingKey.publicKey) as string;
}
