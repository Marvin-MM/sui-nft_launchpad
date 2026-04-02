/**
 * walrusService.ts
 *
 * Handles uploading media files to the Walrus decentralized storage network
 * and constructing the gateway URL for fetched blobs.
 *
 * Walrus Publisher endpoints (Mysten-operated, public):
 *   Testnet: https://publisher.walrus-testnet.walrus.space
 *   Mainnet: https://publisher.walrus.space
 *
 * Walrus Aggregator (read/gateway):
 *   Testnet: https://aggregator.walrus-testnet.walrus.space
 *   Mainnet: https://aggregator.walrus.space
 */

const NETWORK = (import.meta.env.VITE_SUI_NETWORK || 'testnet') as 'mainnet' | 'testnet';

const PUBLISHER_URL =
  NETWORK === 'mainnet'
    ? 'https://publisher.walrus.space'
    : 'https://publisher.walrus-testnet.walrus.space';

const AGGREGATOR_URL =
  NETWORK === 'mainnet'
    ? 'https://aggregator.walrus.space'
    : 'https://aggregator.walrus-testnet.walrus.space';

/** Minimum epochs the blob must be stored. Default = 5 epochs (~5 days on testnet). */
const DEFAULT_EPOCHS = 5;

export interface WalrusUploadResult {
  /** The Walrus blob ID (ASCII string) */
  blobId: string;
  /** The Walrus epoch number until which the blob is guaranteed (Walrus epoch scale — display only) */
  guaranteedUntil: number;
  /** Number of Walrus storage epochs requested (used to compute Sui epoch_until for on-chain call) */
  storageEpochs: number;
  /** MIME type of the uploaded file (e.g. 'image/png'). Used by WalrusImage to set correct Content-Type. */
  mimeType: string;
  /** Full gateway URL: https://aggregator.../v1/blobs/<blob_id> */
  gatewayUrl: string;
  /** The walrus:// URI to store on-chain */
  walrusUri: string;
}

/**
 * Upload a file blob to the Walrus publisher.
 *
 * @param file    - The File object selected by the user
 * @param epochs  - Number of epochs for storage guarantee (min 1)
 * @returns       WalrusUploadResult with blob_id, guaranteed_until, and URLs
 * @throws        Error with user-friendly message on failure
 */
export async function uploadToWalrus(
  file: File,
  epochs: number = DEFAULT_EPOCHS
): Promise<WalrusUploadResult> {
  // Capture MIME type before the upload for use in display later
  const mimeType = file.type || 'application/octet-stream';
  const url = `${PUBLISHER_URL}/v1/blobs?epochs=${epochs}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
    });
  } catch (networkErr) {
    throw new Error(
      'Network error: Could not reach the Walrus publisher. Check your internet connection.'
    );
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(
      `Walrus upload failed (HTTP ${response.status}): ${text || 'Unknown error'}`
    );
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new Error('Walrus returned an invalid response. Please try again.');
  }

  // Walrus API returns either { newlyCreated: { blobObject: {... blobId, ...}, ... } }
  // or { alreadyCertified: { blobId, ... } }
  let blobId: string | undefined;
  let guaranteedUntil: number | undefined;

  if (json?.newlyCreated) {
    blobId = json.newlyCreated.blobObject?.blobId;
    guaranteedUntil = json.newlyCreated.blobObject?.storage?.endEpoch;
  } else if (json?.alreadyCertified) {
    blobId = json.alreadyCertified.blobId;
    guaranteedUntil = json.alreadyCertified.endEpoch;
  }

  if (!blobId) {
    throw new Error('Walrus did not return a blob ID. Response: ' + JSON.stringify(json));
  }

  if (typeof guaranteedUntil !== 'number' || guaranteedUntil <= 0) {
    // Fall back to a reasonable epoch estimate
    guaranteedUntil = Number(epochs) + 1;
  }

  const gatewayUrl = `${AGGREGATOR_URL}/v1/blobs/${blobId}`;
  const walrusUri  = `walrus://${blobId}`;

  return { blobId, guaranteedUntil, storageEpochs: epochs, mimeType, gatewayUrl, walrusUri };
}

/**
 * Convert a walrus:// URI to a full HTTPS gateway URL for display.
 */
export function walrusUriToGatewayUrl(uri: string): string {
  if (uri.startsWith('walrus://')) {
    const blobId = uri.slice('walrus://'.length);
    return `${AGGREGATOR_URL}/v1/blobs/${blobId}`;
  }
  return uri;
}

/**
 * Validate a file before upload.
 * Returns an error message string or null if valid.
 */
export function validateMintFile(file: File): string | null {
  const MAX_SIZE_MB = 10;
  const ALLOWED_TYPES = [
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm',
  ];

  if (!ALLOWED_TYPES.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Use PNG, JPEG, GIF, WebP, SVG, MP4, or WebM.`;
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_SIZE_MB} MB.`;
  }
  return null;
}
