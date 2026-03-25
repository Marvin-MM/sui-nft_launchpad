import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery,
  ConnectModal, useSuiClient
} from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import {
  MIST_PER_SUI, formatSui, PACKAGE_ID, MINT_CONFIG_ID,
  TRANSFER_POLICY_ID, COMMIT_REVEAL_CONFIG_ID, DUTCH_AUCTION_ID, SUI_RANDOM_ID,
  NFT_TYPE
} from '../lib/sui';
import { toast } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import {
  Loader2, Minus, Plus, Terminal, Activity, Cpu, Upload, CheckCircle2,
  CloudUpload, ImageIcon, Sparkles, ShieldCheck, ChevronRight, AlertTriangle,
  ExternalLink, X, Database
} from 'lucide-react';
import AIAdvisor from '../components/AIAdvisor';
import { bcs } from '@mysten/sui/bcs';
import { useKiosk } from '../hooks/useKiosk';
import { resolveKioskArgs, finalizeKiosk } from '../lib/kioskUtils';
import { generateMerkleProof } from '../lib/merkle';
import ConfirmModal from '../components/ConfirmModal';
import { uploadToWalrus, validateMintFile, walrusUriToGatewayUrl } from '../services/walrusService';

// ── Error map keyed on Move abort codes ──────────────────────────────────────
const ERROR_MAP: Record<string, string> = {
  ECollectionPaused:     'The collection is currently paused by the admin.',
  EMaxSupplyReached:     'The maximum supply has been reached.',
  EInsufficientFee:      'Insufficient SUI to cover the mint fee and gas.',
  EWalletLimitReached:   'You have reached the maximum mint limit for this wallet.',
  EAllowlistProofFailed: 'Your wallet is not on the allowlist for this phase.',
  EAllowlistNotEnabled:  'Allowlist is not configured yet. Contact the admin.',
};

// ── Mint wizard steps ─────────────────────────────────────────────────────────
type MintStep = 'upload' | 'mint' | 'walrus_link';

interface WalrusUploadState {
  blobId: string;
  guaranteedUntil: number;
  gatewayUrl: string;
  walrusUri: string;
  fileName: string;
  previewUrl: string;
}

interface MintedNFT {
  objectId: string;
  kioskId: string;
  kioskCapId: string;
  name: string;
  walrusUri?: string;
}

export default function Mint() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const { kioskId, kioskCapId, refetch: refetchKiosk } = useKiosk();

  // ── Wizard state ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<MintStep>('upload');
  const [quantity, setQuantity] = useState(1);
  const [mintStrategy, setMintStrategy] = useState<'standard' | 'dutch' | 'commit'>('standard');
  const [pendingCommitment, setPendingCommitment] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [mintedNft, setMintedNft] = useState<MintedNFT | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean; action: 'mint' | 'reveal' | 'walrus_link' | null
  }>({ isOpen: false, action: null });

  // ── Walrus upload state ────────────────────────────────────────────────────
  const [walrusState, setWalrusState]   = useState<WalrusUploadState | null>(null);
  const [uploading, setUploading]       = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive]    = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Transaction state ─────────────────────────────────────────────────────
  const [minting, setMinting] = useState(false);
  const [linkingWalrus, setLinkingWalrus] = useState(false);

  // ── On-chain config ────────────────────────────────────────────────────────
  const { data: configData } = useSuiClientQuery('getObject', {
    id: MINT_CONFIG_ID,
    options: { showContent: true },
  });
  const { data: systemState } = useSuiClientQuery('getLatestSuiSystemState');
  const currentEpoch = Number(systemState?.epoch || 0);

  const configFields = (configData?.data?.content as any)?.fields || {};
  const phase          = configFields.current_phase ?? 2;
  const allowlistPrice = configFields.allowlist_price_mist || '1000000000';
  const publicPrice    = configFields.mint_fee || '2000000000';
  const maxSupply      = Number(configFields.max_supply || 0);
  const mintedCount    = Number(configFields.minted_count || 0);
  const currentPrice   = phase === 1 ? allowlistPrice : publicPrice;
  const totalPrice     = BigInt(currentPrice) * BigInt(quantity);

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Walrus Upload
  // ═══════════════════════════════════════════════════════════════════════════
  const handleFile = useCallback(async (file: File) => {
    const err = validateMintFile(file);
    if (err) { toast.error(err); return; }

    setUploading(true);
    setUploadProgress(10);

    const preview = URL.createObjectURL(file);

    try {
      setUploadProgress(30);
      const result = await uploadToWalrus(file);
      setUploadProgress(100);
      setWalrusState({ ...result, fileName: file.name, previewUrl: preview });
      toast.success('Asset uploaded to Walrus!');
      // Auto-advance to mint step
      setTimeout(() => setStep('mint'), 500);
    } catch (e: any) {
      toast.error(e.message || 'Walrus upload failed.');
      URL.revokeObjectURL(preview);
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: On-chain Mint
  // ═══════════════════════════════════════════════════════════════════════════
  const handleMint = async () => {
    if (!account || !walrusState) return;
    setMinting(true);

    try {
      const tx = new Transaction();
      const [feeCoin] = tx.splitCoins(tx.gas, [totalPrice]);
      const { kioskArg, capArg, isNew } = resolveKioskArgs(tx, kioskId, kioskCapId);

      // Pass the Walrus gateway URL as image_url and walrus:// URI as thumbnail_url
      // (thumbnail_url is used by on_chain_storage lookup and display standards)
      const nftName        = new TextEncoder().encode('Sui Genesis NFT');
      const nftDescription = new TextEncoder().encode('A Sui Genesis collection asset stored on Walrus.');
      // image_url: initially a placeholder — will be updated by set_walrus_blob below
      const nftImageUrl    = new TextEncoder().encode(walrusState.walrusUri);
      const nftThumbUrl    = new TextEncoder().encode(walrusState.walrusUri);

      if (mintStrategy === 'dutch') {
        if (!DUTCH_AUCTION_ID) {
          toast.error('Dutch Auction not configured. Set VITE_DUTCH_AUCTION_ID in .env');
          setMinting(false);
          return;
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::dutch_auction::mint_via_auction`,
          arguments: [
            tx.object(DUTCH_AUCTION_ID),
            tx.object(MINT_CONFIG_ID),
            feeCoin,
            kioskArg,
            capArg,
            tx.object(TRANSFER_POLICY_ID),
            tx.pure.vector('u8', nftName),
            tx.pure.vector('u8', nftDescription),
            tx.pure.vector('u8', nftImageUrl),
            tx.pure.vector('u8', nftThumbUrl),
          ],
        });
      } else if (mintStrategy === 'commit') {
        if (!COMMIT_REVEAL_CONFIG_ID) {
          toast.error('Commit-Reveal not configured. Set VITE_COMMIT_REVEAL_CONFIG_ID in .env');
          setMinting(false);
          return;
        }
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)));
        tx.moveCall({
          target: `${PACKAGE_ID}::commit_reveal::commit`,
          arguments: [
            tx.object(COMMIT_REVEAL_CONFIG_ID),
            tx.object(MINT_CONFIG_ID),
            feeCoin,
            tx.pure.vector('u8', nonce),
          ],
        });
      } else {
        const merkleProof: number[][] = phase === 1 ? generateMerkleProof(account.address) : [];
        tx.moveCall({
          target: `${PACKAGE_ID}::mint::mint_to_kiosk`,
          arguments: [
            tx.object(MINT_CONFIG_ID),
            feeCoin,
            kioskArg,
            capArg,
            tx.object(TRANSFER_POLICY_ID),
            tx.pure.vector('u8', nftName),
            tx.pure.vector('u8', nftDescription),
            tx.pure.vector('u8', nftImageUrl),
            tx.pure.vector('u8', nftThumbUrl),
            tx.pure(bcs.vector(bcs.vector(bcs.u8())).serialize(merkleProof)),
          ],
        });
      }

      if (isNew) finalizeKiosk(tx, kioskArg, capArg, account.address);

      signAndExecute({ transaction: tx }, {
        onSuccess: async (result) => {
          toast.success('Mint submitted — confirming on-chain...');
          try {
            const txResult = await suiClient.waitForTransaction({
              digest: result.digest,
              options: { showObjectChanges: true },
            });

            const created = txResult.objectChanges?.filter((c: any) => c.type === 'created') || [];

            if (mintStrategy === 'commit') {
              const commitObj = created.find((o: any) => o.objectType?.includes('MintCommitment'));
              if (commitObj) {
                setPendingCommitment((commitObj as any).objectId);
                setMinting(false);
                return;
              }
            }

            // Find the SuiNFT object specifically (filter by our NFT type)
            const nftObj = created.find((o: any) =>
              o.objectType?.includes('::nft::SuiNFT') ||
              o.objectType === NFT_TYPE
            );
            const nftId = nftObj ? (nftObj as any).objectId : null;

            // Find kiosk objects in case a new one was created
            await refetchKiosk();

            if (nftId) {
              setMintedNft({
                objectId: nftId,
                kioskId:    kioskId || '',
                kioskCapId: kioskCapId || '',
                name: 'Sui Genesis NFT',
                walrusUri: walrusState?.walrusUri,
              });
              // Advance to Walrus link step
              setStep('walrus_link');
            } else {
              // NFT is in the kiosk — object change type may be 'mutated' not 'created'
              // Surface success and let user link Walrus manually
              toast.success('Mint successful! Proceed to link your Walrus asset.');
              setStep('walrus_link');
            }
          } catch (e) {
            console.error('Failed to parse TX result:', e);
            toast.success('Mint successful! Proceed to link your Walrus asset.');
            setStep('walrus_link');
          }
        },
        onError: (error) => {
          const msg = error.message;
          const known = Object.keys(ERROR_MAP).find(k => msg.includes(k));
          toast.error(known ? ERROR_MAP[known] : 'Mint failed: ' + msg);
        },
        onSettled: () => setMinting(false),
      });
    } catch (e) {
      console.error(e);
      toast.error('Failed to build mint transaction.');
      setMinting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Link Walrus blob on-chain via on_chain_storage::set_walrus_blob
  // ═══════════════════════════════════════════════════════════════════════════
  const handleLinkWalrus = async () => {
    if (!account || !walrusState) return;

    // Validate the blob hasn't expired relative to current epoch
    if (walrusState.guaranteedUntil <= currentEpoch) {
      toast.error(
        `Walrus blob storage expired at epoch ${walrusState.guaranteedUntil}. ` +
        `Current epoch is ${currentEpoch}. Please re-upload the asset.`
      );
      return;
    }

    if (!mintedNft?.objectId) {
      toast.error('Could not find your minted NFT object. Please enter the ID manually.');
      return;
    }

    const resolvedKioskId    = mintedNft.kioskId    || kioskId;
    const resolvedKioskCapId = mintedNft.kioskCapId || kioskCapId;

    if (!resolvedKioskId || !resolvedKioskCapId) {
      toast.error('Kiosk not found. Please refresh and try again.');
      return;
    }

    setLinkingWalrus(true);
    try {
      const tx = new Transaction();

      // on_chain_storage::set_walrus_blob(kiosk, kiosk_cap, nft_id, blob_id, epoch_until, ctx)
      tx.moveCall({
        target: `${PACKAGE_ID}::on_chain_storage::set_walrus_blob`,
        arguments: [
          tx.object(resolvedKioskId),                              // &mut Kiosk
          tx.object(resolvedKioskCapId),                           // &KioskOwnerCap
          tx.pure.id(mintedNft.objectId),                         // nft_id: ID
          tx.pure.vector('u8', new TextEncoder().encode(walrusState.blobId)), // blob_id
          tx.pure.u64(walrusState.guaranteedUntil),               // epoch_until: u64
        ],
      });

      signAndExecute({ transaction: tx }, {
        onSuccess: async (result) => {
          await suiClient.waitForTransaction({ digest: result.digest });
          // Fire confetti and show success
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#FFFFFF', '#A3E635', '#8b5cf6'] });
          setShowCelebration(true);
          toast.success('Walrus storage linked on-chain! Your NFT is fully complete.');
        },
        onError: (e) => toast.error('Failed to link Walrus blob: ' + e.message),
        onSettled: () => setLinkingWalrus(false),
      });
    } catch (e: any) {
      toast.error('Failed to build Walrus link transaction: ' + e.message);
      setLinkingWalrus(false);
    }
  };

  // ── Reveal (commit-reveal step 2) ──────────────────────────────────────────
  const handleReveal = async () => {
    if (!account || !pendingCommitment || !walrusState) return;
    if (!COMMIT_REVEAL_CONFIG_ID) {
      toast.error('Commit-Reveal config not set.');
      return;
    }
    setMinting(true);
    try {
      const tx = new Transaction();
      const { kioskArg, capArg, isNew } = resolveKioskArgs(tx, kioskId, kioskCapId);
      const nftName     = new TextEncoder().encode('Sui Genesis NFT');
      const nftDesc     = new TextEncoder().encode('A Sui Genesis collection asset stored on Walrus.');
      const nftThumbUrl = new TextEncoder().encode(walrusState.walrusUri);

      tx.moveCall({
        target: `${PACKAGE_ID}::commit_reveal::reveal`,
        arguments: [
          tx.object(COMMIT_REVEAL_CONFIG_ID),
          tx.object(MINT_CONFIG_ID),
          tx.object(pendingCommitment),
          kioskArg,
          capArg,
          tx.object(TRANSFER_POLICY_ID),
          tx.object(SUI_RANDOM_ID),
          tx.pure.vector('u8', nftName),
          tx.pure.vector('u8', nftDesc),
          tx.pure.vector('u8', nftThumbUrl),
        ],
      });
      if (isNew) finalizeKiosk(tx, kioskArg, capArg, account.address);

      signAndExecute({ transaction: tx }, {
        onSuccess: async (result) => {
          toast.success('Reveal successful!');
          setPendingCommitment(null);
          try {
            const txResult = await suiClient.waitForTransaction({
              digest: result.digest,
              options: { showObjectChanges: true },
            });
            const nftObj = (txResult.objectChanges || []).find((o: any) =>
              o.type === 'created' && o.objectType?.includes('::nft::SuiNFT')
            );
            if (nftObj) {
              setMintedNft({
                objectId: (nftObj as any).objectId,
                kioskId: kioskId || '',
                kioskCapId: kioskCapId || '',
                name: 'Sui Genesis NFT',
                walrusUri: walrusState.walrusUri,
              });
              setStep('walrus_link');
            }
          } catch (e) {
            setStep('walrus_link');
          }
        },
        onError: (e) => toast.error('Reveal failed: ' + e.message),
        onSettled: () => setMinting(false),
      });
    } catch (e: any) {
      toast.error('Failed to build reveal transaction.');
      setMinting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (!account) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center space-y-12">
        <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center text-white/20">
          <Terminal className="w-10 h-10" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-light tracking-tighter uppercase">INITIALIZATION REQUIRED</h2>
          <p className="text-white/40 font-light leading-relaxed">
            Authentication failed. Please establish a secure connection to your Sui wallet to proceed.
          </p>
        </div>
        <ConnectModal
          trigger={
            <button className="px-12 py-5 border border-white text-white font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all duration-500">
              ESTABLISH CONNECTION
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen border-x border-white/10 grid grid-cols-1 lg:grid-cols-12">

      {/* ── Left Column: Wizard ── */}
      <div className="lg:col-span-8 p-6 md:p-12 lg:p-24 space-y-16 border-b lg:border-b-0 lg:border-r border-white/10">

        {/* Header */}
        <div className="space-y-6">
          <div className="flex items-center gap-4 text-emerald-500">
            <Activity className="w-4 h-4" />
            <span className="text-[10px] font-medium tracking-[0.4em] uppercase">SYSTEM_NODE: ACTIVE</span>
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-[100px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
            ASSET<br />
            <span className="text-white/20">DISTRIBUTION</span>
          </h1>
          <p className="text-white/40 font-light leading-relaxed max-w-xl">
            Protocol Cycle{' '}
            <span className="text-white">{phase === 0 ? 'PAUSED' : phase === 1 ? 'ALLOWLIST' : 'PUBLIC'}</span>
            {phase === 1 && ' — Restricted to allowlisted identifiers only.'}
            {phase === 2 && ' — Public distribution is active.'}
          </p>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-0">
          {(['upload', 'mint', 'walrus_link'] as MintStep[]).map((s, i) => {
            const labels = ['01. UPLOAD ASSET', '02. MINT ON-CHAIN', '03. LINK STORAGE'];
            const active = step === s;
            const done   = ['upload', 'mint', 'walrus_link'].indexOf(step) > i;
            return (
              <div key={s} className="flex items-center flex-1">
                <div className={`flex-1 py-3 px-4 border-b-2 text-[9px] font-medium tracking-[0.3em] uppercase transition-all ${
                  active ? 'border-white text-white' : done ? 'border-emerald-500 text-emerald-500' : 'border-white/10 text-white/20'
                }`}>
                  {done ? <CheckCircle2 className="w-3 h-3 inline mr-2" /> : null}
                  {labels[i]}
                </div>
                {i < 2 && <div className="w-4 h-px bg-white/10" />}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1: Upload ── */}
        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="space-y-2">
                <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">ASSET_UPLOAD — WALRUS DECENTRALIZED STORAGE</p>
                <p className="text-white/30 text-sm font-light leading-relaxed max-w-lg">
                  Upload your NFT media to Walrus first. After a successful upload you will receive a <code className="text-white/60">blob_id</code> which will be permanently linked to your token on-chain.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={onDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed cursor-pointer transition-all duration-300 p-12 flex flex-col items-center justify-center gap-6 min-h-[280px] ${
                  dragActive ? 'border-white bg-white/5' : 'border-white/10 hover:border-white/30 bg-white/1'
                }`}
              >
                <input ref={fileInputRef} type="file" accept="image/*,video/mp4,video/webm" className="hidden" onChange={onFileInput} />

                {uploading ? (
                  <div className="space-y-4 w-full max-w-xs text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-white/40" />
                    <p className="text-[10px] font-medium tracking-[0.4em] uppercase text-white/40">UPLOADING TO WALRUS...</p>
                    <div className="h-1 bg-white/10 w-full overflow-hidden">
                      <motion.div
                        className="h-full bg-white"
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    <p className="text-xs text-white/20">{uploadProgress}%</p>
                  </div>
                ) : walrusState ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <img src={walrusState.previewUrl} alt="preview" className="w-32 h-32 object-cover border border-white/10" />
                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                    <div>
                      <p className="text-[10px] font-medium tracking-[0.4em] uppercase text-emerald-400">UPLOAD COMPLETE</p>
                      <p className="text-xs text-white/40 mt-1 font-mono truncate max-w-[280px]">{walrusState.blobId}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <CloudUpload className="w-12 h-12 text-white/20" />
                    <div className="text-center space-y-2">
                      <p className="text-sm font-light text-white/60">Drop your file here or click to browse</p>
                      <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">PNG · JPEG · GIF · WEBP · SVG · MP4 · WEBM — Max 10 MB</p>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] font-medium tracking-[0.2em] uppercase text-white/20">
                      <Database className="w-3 h-3" />
                      <span>Stored on Walrus Decentralized Storage</span>
                    </div>
                  </>
                )}
              </div>

              {walrusState && (
                <div className="border border-white/10 p-6 space-y-3 bg-white/1">
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">WALRUS BLOB INFO</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-white/20 uppercase tracking-widest text-[9px]">Blob ID</p>
                      <p className="text-white font-mono truncate mt-1">{walrusState.blobId}</p>
                    </div>
                    <div>
                      <p className="text-white/20 uppercase tracking-widest text-[9px]">Guaranteed Until Epoch</p>
                      <p className="text-white font-mono mt-1">{walrusState.guaranteedUntil}</p>
                    </div>
                  </div>
                  <a href={walrusState.gatewayUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-[10px] text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                    onClick={e => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" /> Preview on Walrus Gateway
                  </a>
                </div>
              )}

              {walrusState && (
                <button
                  onClick={() => setStep('mint')}
                  className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500"
                >
                  PROCEED TO MINT →
                </button>
              )}
            </motion.div>
          )}

          {/* ── STEP 2: Mint ── */}
          {step === 'mint' && (
            <motion.div
              key="mint"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              {walrusState && (
                <div className="flex items-center gap-6 border border-white/10 p-4 bg-white/1">
                  <img src={walrusState.previewUrl} alt="asset" className="w-16 h-16 object-cover border border-white/10 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium tracking-[0.3em] text-emerald-400 uppercase">WALRUS ASSET READY</p>
                    <p className="text-xs text-white/40 font-mono truncate mt-1">{walrusState.walrusUri}</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 border border-white/10 bg-white/1">
                {/* Price + Quantity */}
                <div className="p-6 md:p-10 space-y-10">
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">VALUATION / UNIT</p>
                    <p className="text-4xl sm:text-5xl font-light tracking-tighter">
                      {formatSui(currentPrice)}<span className="text-xl text-white/20 ml-2">SUI</span>
                    </p>
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">QUANTITY_LOCK</p>
                    <div className="flex items-center gap-8 border-b border-white/20 py-2">
                      <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="text-white/40 hover:text-white transition-colors">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-4xl font-light w-12 text-center">{quantity.toString().padStart(2, '0')}</span>
                      <button onClick={() => setQuantity(q => Math.min(5, q + 1))} className="text-white/40 hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-[9px] font-medium tracking-[0.2em] text-white/20 uppercase">
                      Supply: {mintedCount.toLocaleString()} / {maxSupply.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Strategy */}
                <div className="p-6 md:p-10 space-y-8 bg-white/1">
                  <div className="space-y-4">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">STRATEGY_SELECTOR</p>
                    {[
                      { id: 'standard', name: 'Standard distribution' },
                      { id: 'dutch',    name: 'Incentivized auction'  },
                      { id: 'commit',   name: 'Committed allocation'  },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => setMintStrategy(s.id as any)}
                        className={`flex items-center justify-between w-full py-2 border-b transition-all uppercase tracking-widest text-[9px] ${
                          mintStrategy === s.id ? 'border-white text-white' : 'border-white/5 text-white/20 hover:text-white/40'
                        }`}
                      >
                        {s.name}
                        {mintStrategy === s.id && <ChevronRight className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">PAYLOAD_TOTAL</p>
                    <p className="text-4xl font-light tracking-tighter">
                      {formatSui(totalPrice)}<span className="text-xl text-white/20 ml-2">SUI</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Phase warning if paused */}
              {phase === 0 && (
                <div className="flex items-center gap-3 border border-amber-500/20 p-4 bg-amber-500/5">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                  <p className="text-[10px] font-medium tracking-[0.2em] uppercase text-amber-500">
                    Collection is paused. Minting is currently disabled by the admin.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => setStep('upload')}
                  className="py-5 px-8 border border-white/10 text-white/40 text-[10px] font-medium tracking-[0.3em] uppercase hover:text-white hover:border-white/30 transition-all flex-shrink-0"
                >
                  ← BACK
                </button>
                <button
                  onClick={() => setConfirmConfig({ isOpen: true, action: 'mint' })}
                  disabled={minting || phase === 0}
                  className="flex-1 py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {minting ? (
                    <span className="flex items-center justify-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin" /> EXECUTING_MINT...
                    </span>
                  ) : 'INITIALIZE_MINT_SEQUENCE'}
                </button>
              </div>

              <div className="flex items-center gap-4 text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                <span>Secured by Sui Kiosk Architecture — NFT locked at mint</span>
              </div>
            </motion.div>
          )}

          {/* ── STEP 3: Link Walrus ── */}
          {step === 'walrus_link' && (
            <motion.div
              key="walrus_link"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="space-y-10"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-emerald-500">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="text-[10px] font-medium tracking-[0.4em] uppercase">MINT CONFIRMED ON-CHAIN</p>
                </div>
                <h2 className="text-3xl md:text-5xl font-light tracking-tighter uppercase">
                  LINK<br /><span className="text-white/20">WALRUS STORAGE</span>
                </h2>
                <p className="text-white/40 text-sm font-light leading-relaxed max-w-lg">
                  Your NFT is minted. Now execute <code className="text-white/60">on_chain_storage::set_walrus_blob</code> to permanently record the Walrus blob reference on-chain, setting <code className="text-white/60">storage_type = 2</code> and <code className="text-white/60">image_url = walrus://&lt;blob_id&gt;</code>.
                </p>
              </div>

              {walrusState && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="border border-white/10 p-6 space-y-4 bg-white/1">
                    <img src={walrusState.previewUrl} alt="preview" className="w-full aspect-square object-cover border border-white/10" />
                    <a href={walrusState.gatewayUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-[10px] text-white/40 hover:text-white transition-colors uppercase tracking-widest"
                    >
                      <ExternalLink className="w-3 h-3" /> View on Walrus
                    </a>
                  </div>
                  <div className="border border-white/10 p-6 space-y-4 bg-white/1">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">ON-CHAIN STORAGE REF</p>
                    {[
                      { label: 'Blob ID',       value: walrusState.blobId.slice(0, 24) + '...' },
                      { label: 'Storage Type',  value: 'WALRUS (type=2)' },
                      { label: 'Guaranteed',    value: `Until epoch ${walrusState.guaranteedUntil}` },
                      { label: 'NFT Object ID', value: mintedNft?.objectId ? mintedNft.objectId.slice(0, 12) + '...' : 'Resolving...' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between border-b border-white/5 pb-3">
                        <p className="text-[9px] font-medium tracking-[0.2em] text-white/20 uppercase">{row.label}</p>
                        <p className="text-[10px] font-medium font-mono text-white">{row.value}</p>
                      </div>
                    ))}

                    {walrusState.guaranteedUntil <= currentEpoch && (
                      <div className="flex items-center gap-2 text-amber-500 border border-amber-500/20 p-3 bg-amber-500/5">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <p className="text-[9px] uppercase tracking-wider">Blob storage expired. Re-upload required.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={() => setConfirmConfig({ isOpen: true, action: 'walrus_link' })}
                disabled={linkingWalrus || !walrusState || walrusState.guaranteedUntil <= currentEpoch}
                className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {linkingWalrus ? (
                  <span className="flex items-center justify-center gap-3">
                    <Loader2 className="w-4 h-4 animate-spin" /> LINKING ON-CHAIN...
                  </span>
                ) : 'EXECUTE_WALRUS_LINK'}
              </button>

              <p className="text-[10px] text-white/20 font-medium uppercase tracking-widest">
                If this step fails after a successful mint, your NFT still exists in your kiosk. You can re-link from the My Collection page.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Right Column ── */}
      <div className="lg:col-span-4 p-6 md:p-12 lg:p-24 space-y-12 bg-white/1">
        <AIAdvisor />

        <div className="space-y-8">
          <h3 className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">NETWORK_STATUS</h3>
          <div className="space-y-6">
            {[
              { label: 'Current Epoch', value: currentEpoch.toString() },
              { label: 'Mint Phase',    value: phase === 0 ? 'PAUSED' : phase === 1 ? 'ALLOWLIST' : 'PUBLIC' },
              { label: 'Asset Standard', value: 'SUI_NFT_0.2' },
              { label: 'Storage Layer', value: 'WALRUS' },
              { label: 'Gas Estimate',  value: '~0.008 SUI' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-baseline border-b border-white/5 pb-4">
                <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">{item.label}</p>
                <p className="text-xs font-medium text-white tracking-widest uppercase">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border border-white/5 bg-white/1 space-y-4">
          <div className="flex items-center gap-3 text-amber-500/50">
            <Cpu className="w-4 h-4" />
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase">MINT_PROTOCOL</span>
          </div>
          <div className="space-y-2 text-[10px] font-light text-white/30 leading-loose uppercase tracking-widest">
            <p>① Upload media to Walrus</p>
            <p>② Execute mint_to_kiosk</p>
            <p>③ Link set_walrus_blob</p>
          </div>
        </div>
      </div>

      {/* ── Success Modal ── */}
      <AnimatePresence>
        {showCelebration && mintedNft && walrusState && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/96 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="max-w-[900px] w-full grid grid-cols-1 md:grid-cols-2 border border-white/10 bg-black overflow-hidden"
            >
              <div className="aspect-square border-r border-white/10 bg-white/1 overflow-hidden">
                <img src={walrusState.previewUrl} alt="NFT" className="w-full h-full object-cover contrast-125 select-none" />
              </div>
              <div className="p-8 md:p-12 flex flex-col justify-between space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center gap-3 text-emerald-400">
                    <Sparkles className="w-5 h-5" />
                    <span className="text-[10px] font-medium tracking-[0.4em] uppercase">DISTRIBUTION_COMPLETE</span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-light tracking-tighter uppercase leading-none">Sui Genesis NFT</h2>
                    <p className="text-[10px] font-medium tracking-[0.3em] text-white/20 uppercase">ID: {mintedNft.objectId.slice(0, 12)}...</p>
                  </div>
                  <div className="space-y-3 text-[10px] border-t border-white/10 pt-6">
                    <div className="flex justify-between">
                      <span className="text-white/20 uppercase tracking-widest">Storage</span>
                      <span className="text-emerald-400 font-medium">WALRUS (type=2)</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/20 uppercase tracking-widest">Blob ID</span>
                      <span className="font-mono text-white/60">{walrusState.blobId.slice(0, 16)}...</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/20 uppercase tracking-widest">Guaranteed</span>
                      <span className="text-white/60">Epoch {walrusState.guaranteedUntil}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <a
                    href={walrusState.gatewayUrl} target="_blank" rel="noopener noreferrer"
                    className="w-full py-5 border border-white/10 text-white/40 font-medium tracking-[0.4em] uppercase hover:text-white transition-all text-center flex items-center justify-center gap-2 text-[10px]"
                  >
                    <ExternalLink className="w-3 h-3" /> VIEW ON WALRUS
                  </a>
                  <button
                    onClick={() => { setShowCelebration(false); setStep('upload'); setWalrusState(null); setMintedNft(null); }}
                    className="w-full py-5 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500"
                  >
                    MINT ANOTHER
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Commit-Reveal Pending Modal ── */}
      <AnimatePresence>
        {pendingCommitment && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/96 backdrop-blur-3xl"
          >
            <div className="max-w-[560px] w-full border border-white/10 bg-black p-10 space-y-10 text-center">
              <div className="w-20 h-20 mx-auto border border-white/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-white/40 animate-pulse" />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl font-light tracking-tighter uppercase">COMMITMENT_SECURED</h2>
                <p className="text-[10px] font-medium tracking-[0.3em] text-white/40 uppercase leading-loose">
                  Your commitment has been recorded. Execute the reveal to fetch on-chain randomness and finalize your asset traits.
                </p>
              </div>
              <button
                onClick={() => setConfirmConfig({ isOpen: true, action: 'reveal' })}
                disabled={minting}
                className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-50"
              >
                {minting ? 'DECRYPTING...' : 'EXECUTE_REVEAL'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Confirm Modal ── */}
      <ConfirmModal
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ isOpen: false, action: null })}
        onConfirm={() => {
          if (confirmConfig.action === 'mint')        handleMint();
          else if (confirmConfig.action === 'reveal') handleReveal();
          else if (confirmConfig.action === 'walrus_link') handleLinkWalrus();
        }}
        title={
          confirmConfig.action === 'mint'        ? 'AUTHORIZE DISTRIBUTION' :
          confirmConfig.action === 'walrus_link' ? 'LINK WALRUS STORAGE'    :
                                                   'DECRYPT RECORD'
        }
        message={
          confirmConfig.action === 'mint'
            ? `Transfer ${formatSui(totalPrice)} SUI to mint ${quantity} Genesis Asset(s). This action is irreversible on-chain.`
            : confirmConfig.action === 'walrus_link'
            ? `This will call on_chain_storage::set_walrus_blob on your NFT, setting storage_type=2 and image_url=walrus://${walrusState?.blobId?.slice(0, 16)}... permanently.`
            : 'Execute cryptographic reveal via the Sui randomness beacon to finalize asset traits.'
        }
        confirmText={
          confirmConfig.action === 'mint'        ? 'AUTHORIZE_MINT'   :
          confirmConfig.action === 'walrus_link' ? 'CONFIRM_LINK'     :
                                                   'AUTHORIZE_REVEAL'
        }
      />
    </div>
  );
}
