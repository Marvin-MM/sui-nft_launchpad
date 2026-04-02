/**
 * useWalrusImage.ts
 *
 * Converts a walrus://<blobId> URI into a displayable HTTPS URL.
 *
 * WHY WE DON'T FETCH THE BLOB BYTES:
 *  The Walrus aggregator does not send Access-Control-Allow-Origin headers
 *  for programmatic fetch() requests. This causes CORS errors in the browser.
 *
 *  However, <img src="https://aggregator.../v1/blobs/<id>"> works perfectly:
 *  img tag requests are not blocked by CORS (they use simple GET with no
 *  preflight). Browsers also perform MIME sniffing on img tags so a missing
 *  Content-Type header is not a problem.
 *
 *  This hook simply converts walrus:// → HTTPS aggregator URL and returns
 *  it immediately (no loading state needed). WalrusImage uses this and
 *  handles load errors via the img onError event.
 */

const NETWORK = (import.meta.env.VITE_SUI_NETWORK || 'testnet') as 'mainnet' | 'testnet';

export const WALRUS_AGGREGATOR_URL =
  NETWORK === 'mainnet'
    ? 'https://aggregator.walrus.space'
    : 'https://aggregator.walrus-testnet.walrus.space';

/**
 * Converts any image URI to a displayable HTTPS URL:
 *  - walrus://<blobId>  →  https://aggregator.../v1/blobs/<blobId>
 *  - https://...        →  returned as-is
 *  - null/undefined     →  null
 */
export function resolveWalrusUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;

  const trimmed = uri.trim();

  // 1. Walrus URI (walrus://<blobId>)
  if (trimmed.startsWith('walrus://')) {
    const blobId = trimmed.slice('walrus://'.length).trim();
    return `${WALRUS_AGGREGATOR_URL}/v1/blobs/${blobId}`;
  }

  // 2. IPFS URI (ipfs://<cid>)
  if (trimmed.startsWith('ipfs://')) {
    const cid = trimmed.slice('ipfs://'.length).trim();
    return `https://ipfs.io/ipfs/${cid}`;
  }

  // 3. Raw Walrus Blob ID (typically 43 or 44 base64url chars)
  // Example: mkK8q2PC6uc8toWXTabD9eBTkbc9W4pTY9_USd7Qv-o
  if (/^[A-Za-z0-9_-]{43,44}$/.test(trimmed)) {
    return `${WALRUS_AGGREGATOR_URL}/v1/blobs/${trimmed}`;
  }

  // 4. Prevent ERR_UNKNOWN_URL_SCHEME for other unsupported schemes
  // If it has a scheme (starts with word and colon) but isn't http/https/data/blob, ignore it.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    if (!/^(https?|data|blob):/i.test(trimmed)) {
      return null;
    }
  }

  // Already an HTTPS/HTTP/blob/data or safe relative URL
  return trimmed;
}

export interface WalrusImageState {
  /** The resolved displayable URL (HTTPS aggregator URL or original) */
  src: string | null;
  /** Whether this resolved from a walrus:// URI */
  isWalrus: boolean;
}

/**
 * Resolves a walrus:// URI to an HTTPS URL for display.
 * No async work — returns synchronously via the HTTPS aggregator URL.
 */
export function useWalrusImage(
  uri: string | null | undefined,
): WalrusImageState {
  const src = resolveWalrusUrl(uri);
  const isWalrus = !!uri?.startsWith('walrus://');
  return { src, isWalrus };
}
