import { keccak256, encodePacked } from 'viem';

export function hashAddress(address: string) {
  return keccak256(encodePacked(['address'], [address as `0x${string}`]));
}

export function verifyProof(leaf: string, proof: string[], root: string) {
  let computedHash = leaf;

  for (const proofElement of proof) {
    if (computedHash <= proofElement) {
      computedHash = keccak256(encodePacked(['bytes32', 'bytes32'], [computedHash as `0x${string}`, proofElement as `0x${string}`]));
    } else {
      computedHash = keccak256(encodePacked(['bytes32', 'bytes32'], [proofElement as `0x${string}`, computedHash as `0x${string}`]));
    }
  }

  return computedHash === root;
}
