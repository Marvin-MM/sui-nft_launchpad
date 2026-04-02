import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

// === Allowlist ================================================================
// In production these would be fetched from your backend/API.
// Each address must be a full 32-byte Sui address (0x + 64 hex chars).
export const ALLOWLIST_ADDRESSES: string[] = [
  // Add allowlisted Sui addresses here:
  // '0x<64_hex_chars>',
];

// === Internal helpers =========================================================

/**
 * Normalizes a Sui address to 32-byte hex (no 0x prefix, 64 chars).
 * Throws if the address is not a valid Sui address.
 */
function normalizeAddress(addr: string): Buffer {
  const stripped = addr.startsWith('0x') ? addr.slice(2) : addr;

  if (!/^[0-9a-fA-F]{1,64}$/.test(stripped)) {
    throw new Error(`Invalid Sui address: ${addr}`);
  }

  // Left-pad to 64 hex chars (32 bytes)
  const padded = stripped.padStart(64, '0');
  return Buffer.from(padded, 'hex');
}

/**
 * Build a Merkle tree from a list of Sui addresses.
 * Uses keccak256 leaf hashing and OZ-compatible sortPairs.
 */
function buildTree(addresses: string[]): MerkleTree {
  if (addresses.length === 0) {
    // Return a deterministic empty tree; callers should check allowlist length
    return new MerkleTree([], keccak256, { sortPairs: true });
  }

  const leaves = addresses.map(addr => keccak256(normalizeAddress(addr)));
  return new MerkleTree(leaves, keccak256, { sortPairs: true });
}

// === Public API ===============================================================

/**
 * Returns the hex Merkle root for the given address list.
 * Pass your dynamic allowlist from the Admin panel if it differs from the default.
 */
export function getMerkleRoot(addresses: string[] = ALLOWLIST_ADDRESSES): string {
  return buildTree(addresses).getHexRoot();
}

/**
 * Generates an off-chain Merkle proof for a wallet during allowlist phase.
 *
 * Returns an array of proof nodes, each as a `number[]` (bytes), matching
 * the Move contract's expected `vector<vector<u8>>` argument type.
 *
 * Returns an EMPTY array [] when `addresses` is empty or address is not found
 * (a zero-length proof will always fail on-chain — this is intentional so the
 * contract itself reports the error rather than crashing client-side).
 */
export function generateMerkleProof(
  address: string,
  addresses: string[] = ALLOWLIST_ADDRESSES,
): number[][] {
  if (addresses.length === 0) {
    console.warn('[merkle] generateMerkleProof: allowlist is empty, proof will be invalid.');
    return [];
  }

  let addrBuf: Buffer;
  try {
    addrBuf = normalizeAddress(address);
  } catch {
    console.error('[merkle] generateMerkleProof: invalid address', address);
    return [];
  }

  const leaf = keccak256(addrBuf);
  const tree = buildTree(addresses);
  const proof = tree.getProof(leaf);

  if (proof.length === 0) {
    console.warn('[merkle] generateMerkleProof: address not found in allowlist', address);
  }

  // Each proof element is a Buffer; convert to number[] for BCS serialisation
  return proof.map(p => Array.from(p.data));
}

/**
 * Checks whether a given address is in the allowlist.
 * Useful for displaying phase eligibility warnings to the user.
 */
export function isOnAllowlist(
  address: string,
  addresses: string[] = ALLOWLIST_ADDRESSES,
): boolean {
  if (addresses.length === 0) return false;
  try {
    const addrBuf = normalizeAddress(address);
    const leaf = keccak256(addrBuf);
    const tree = buildTree(addresses);
    return tree.getProof(leaf).length > 0;
  } catch {
    return false;
  }
}
