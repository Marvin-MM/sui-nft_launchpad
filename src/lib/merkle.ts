import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

// For demonstration purposes, we use a static list of allowlisted addresses.
// In a production application, these would be fetched from an API/database.
export const ALLOWLIST_ADDRESSES = [
  '0x0000000000000000000000000000000000000000000000000000000000000001',
  '0x1234567890123456789012345678901234567890123456789012345678901234',
  '0x2b30193e83b3c39211929cad0e1f203100000000000000000000000000000000',
];

let globalMerkleTree: MerkleTree | null = null;

export function getMerkleTree(addresses: string[] = ALLOWLIST_ADDRESSES) {
  if (globalMerkleTree) return globalMerkleTree;

  // Hash each address using keccak256
  // Address in Sui is 32 bytes (64 hex characters)
  const leaves = addresses.map(addr => {
    // Strip 0x, pad to 64 chars, parse as hex buffer
    const normalized = addr.startsWith('0x') ? addr.slice(2) : addr;
    const padded = normalized.padStart(64, '0');
    return keccak256(Buffer.from(padded, 'hex'));
  });

  // OpenZeppelin standard requires sortPairs: true
  globalMerkleTree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  
  return globalMerkleTree;
}

export function getMerkleRoot(addresses?: string[]) {
  const tree = getMerkleTree(addresses);
  return tree.getHexRoot();
}

/**
 * Generates an off-chain Merkle proof for a given wallet address.
 * Use this output as argument for the smart contract's `mint_allowlist` function.
 */
export function generateMerkleProof(
  address: string,
  addresses = ALLOWLIST_ADDRESSES
): number[][] {
  const tree = getMerkleTree(addresses);
  
  const normalized = address.startsWith('0x') ? address.slice(2) : address;
  const padded = normalized.padStart(64, '0');
  const leaf = keccak256(Buffer.from(padded, 'hex'));
  
  const proof = tree.getProof(leaf);
  
  // Convert hex string proofs back into arrays of bytes (vector<u8>) for the Move contract
  return proof.map(p => Array.from(p.data));
}
