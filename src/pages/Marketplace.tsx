import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Search, Filter, ShoppingBag, Tag, TrendingUp, X, Sparkles, Info, Loader2, InfoIcon, BarChart3, Lock } from 'lucide-react';
import RarityBadge from '../components/RarityBadge';
import PriceChart from '../components/PriceChart';
import WalrusImage from '../components/WalrusImage';
import { toast } from 'react-hot-toast';
import { formatSui, NFT_TYPE, PACKAGE_ID, MIST_PER_SUI, TRANSFER_POLICY_ID, MARKETPLACE_CONFIG_ID } from '../lib/sui';
import { aiService, AIPriceEstimate } from '../services/aiService';
import { useKiosk } from '../hooks/useKiosk';
import { resolveKioskArgs, finalizeKiosk } from '../lib/kioskUtils';

export default function Marketplace() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [search, setSearch] = useState('');
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [buying, setBuying] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<AIPriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const suiClient = useSuiClient();

  // Kiosk resolving
  const { kioskId, kioskCapId } = useKiosk();

  // Query NFTMinted events from the events module (nft_app::events, not mint)
  // The NFTMinted event has field `nft_id` not `object_id`
  const { data: eventData } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::NFTMinted` },
      limit: 20,
      order: 'descending',
    }
  );

  const [objectsData, setObjectsData] = useState<any[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);

  useEffect(() => {
    async function fetchObjects() {
      if (!eventData?.data) return;

      // NOTE: In production, also query getDynamicFields({ parentId: MARKETPLACE_CONFIG_ID })
      // for the most accurate listing state — it reflects delists and expiries that
      // events alone cannot capture (events are append-only and stale after state changes).
      const nftInfoMap: Record<string, { feePaid: string; expiresAt?: number }> = {};
      const objectIds = eventData.data
        .filter((e: any) => e.parsedJson?.nft_id)
        .map((e: any) => {
          const nftId = e.parsedJson.nft_id as string;
          nftInfoMap[nftId] = { feePaid: e.parsedJson?.fee_paid || '0' };
          return nftId;
        });

      if (objectIds.length === 0) return;

      setLoadingObjects(true);
      try {
        // ── Step 1: fetch NFT objects ─────────────────────────────────────
        const res = await suiClient.multiGetObjects({
          ids: objectIds,
          options: { showContent: true, showDisplay: true, showOwner: true },
        });

        // ── Step 2: for each NFT in a kiosk, check for an active Listing ─
        // A kiosk::Listing dynamic field exists only when the owner called kiosk::list.
        // Field name type: 0x2::kiosk::Listing, name.value = { id: nft_id, is_exclusive: false }
        // Field value: u64 (the listing price in MIST)
        const enriched = await Promise.all(
          res.map(async (obj: any) => {
            const kioskId: string | null = obj.data?.owner?.ObjectOwner ?? null;
            let isListed = false;
            let listingPriceMist: string | null = null;
            let sellerKioskInitialVersion: string | null = null;

            if (kioskId) {
              try {
                // Fetch the kiosk object to get its initialSharedVersion
                const kioskObject = await suiClient.getObject({
                  id: kioskId,
                  options: { showOwner: true },
                });
                const owner = (kioskObject.data?.owner as any);
                sellerKioskInitialVersion =
                  owner?.Shared?.initial_shared_version?.toString() ?? null;

                // Scan dynamic fields for kiosk::Listing entries
                const fields = await suiClient.getDynamicFields({ parentId: kioskId });
                const listingField = fields.data.find(
                  (f: any) =>
                    f?.name?.type?.includes('kiosk::Listing') &&
                    (f?.name?.value?.id === obj.data?.objectId ||
                      String(f?.name?.value?.id).toLowerCase() ===
                        obj.data?.objectId?.toLowerCase())
                );
                if (listingField) {
                  isListed = true;
                  // Fetch the actual field object to get the price value
                  try {
                    const fieldObj = await suiClient.getDynamicFieldObject({
                      parentId: kioskId,
                      name: listingField.name,
                    });
                    listingPriceMist =
                      (fieldObj.data?.content as any)?.fields?.value?.toString() ?? null;
                  } catch {
                    // Price not critical — listing still valid
                  }
                }
              } catch (e) {
                console.warn('[Marketplace] Failed to check kiosk listing for', obj.data?.objectId, e);
              }
            }

            return {
              ...obj,
              _mintFee: nftInfoMap[obj.data?.objectId] || { feePaid: '0' },
              _kioskId: kioskId,
              _isListed: isListed,
              _listingPriceMist: listingPriceMist,
              _sellerKioskInitialVersion: sellerKioskInitialVersion,
              _expiresAt: nftInfoMap[obj.data?.objectId]?.expiresAt || 0,
            };
          })
        );

        setObjectsData(enriched);
      } catch (e) {
        console.error('Failed to fetch marketplace objects', e);
      } finally {
        setLoadingObjects(false);
      }
    }
    fetchObjects();
  }, [eventData, suiClient]);

  const listings = useMemo(() => {
    if (!objectsData.length) return [];
    return objectsData.map((obj: any) => {
      const content = obj.data?.content as any;
      const display = obj.data?.display?.data as any;
      const rarityScore = content?.fields?.rarity_score || 0;
      const mintFeeSui = formatSui(obj._mintFee?.feePaid || '0');

      // Use the on-chain listing price if available, else fall back to mint fee
      const price = obj._listingPriceMist
        ? formatSui(obj._listingPriceMist)
        : mintFeeSui;

      return {
        id:                          obj.data?.objectId,
        name:                        display?.name || content?.fields?.name || 'Sui Genesis NFT',
        description:                 display?.description || content?.fields?.description || '',
        image:                       display?.image_url || content?.fields?.image_url || null,
        rarityScore,
        price,
        priceMist:                   obj._listingPriceMist || obj._mintFee?.feePaid || '0',
        seller:                      obj._kioskId || obj.data?.owner?.AddressOwner || 'Unknown',
        sellerKioskId:               obj._kioskId as string | null,
        sellerKioskInitialVersion:   obj._sellerKioskInitialVersion as string | null,
        isListed:                    obj._isListed as boolean,
        traits:                      content?.fields?.traits || [],
        status:                      obj._isListed ? 'LISTED' : 'IN_KIOSK',
        expiresAt:                   obj._expiresAt || 0,
      };
    });
  }, [objectsData]);

  const filteredListings = listings.filter(nft =>
    nft.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleBuy = async (nft: any) => {
    if (!account) return;

    if (!nft.isListed) {
      toast.error('This NFT is not currently listed for sale.', { duration: 7000, icon: '🔒' });
      return;
    }

    if (!nft.sellerKioskId) {
      toast.error('Cannot resolve seller kiosk. Please refresh.');
      return;
    }

    if (!TRANSFER_POLICY_ID) {
      toast.error('TransferPolicy not configured.');
      return;
    }

    if (!MARKETPLACE_CONFIG_ID) {
      toast.error('Marketplace not configured. Set VITE_MARKETPLACE_CONFIG_ID in .env');
      return;
    }

    if (nft.seller === account.address) {
      toast.error('You cannot purchase your own NFT.');
      return;
    }

    setBuying(true);
    try {
      const tx = new Transaction();

      // ── Resolve buyer's kiosk ─────────────────────────────────────────────
      const { kioskArg, capArg, isNew } = resolveKioskArgs(tx, kioskId, kioskCapId);

      const priceInMist = BigInt(nft.priceMist || '0');
      const [paymentCoin] = tx.splitCoins(tx.gas, [priceInMist]);

      // 6% royalty buffer (contract returns change)
      const royaltyBuffer = BigInt(Math.ceil(Number(priceInMist) * 0.06));
      const [royaltyCoin] = tx.splitCoins(tx.gas, [royaltyBuffer]);

      let sellerKioskArg;
      if (nft.sellerKioskInitialVersion) {
        sellerKioskArg = tx.sharedObjectRef({
          objectId: nft.sellerKioskId,
          initialSharedVersion: nft.sellerKioskInitialVersion,
          mutable: true,
        });
      } else {
        sellerKioskArg = tx.object(nft.sellerKioskId);
      }

      // marketplace::purchase_nft handles kiosk::purchase + royalty::pay + lock + confirm internally
      tx.moveCall({
        target: `${PACKAGE_ID}::marketplace::purchase_nft`,
        arguments: [
          tx.object(MARKETPLACE_CONFIG_ID),
          sellerKioskArg,
          kioskArg,
          capArg,
          tx.object(TRANSFER_POLICY_ID),
          tx.pure.id(nft.id),
          paymentCoin,
          royaltyCoin,
        ],
      });

      if (isNew) finalizeKiosk(tx, kioskArg, capArg, account.address);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success('Purchase complete! NFT is now in your Kiosk. 🎉');
            setSelectedNft(null);
          },
          onError: (err: any) => {
            const msg = err?.message || '';
            if (msg.includes('EListingNotFound') || msg.includes('abort code: 2')) {
              toast.error('Listing no longer active. The seller may have delisted.');
            } else if (msg.includes('EListingExpired') || msg.includes('abort code: 3')) {
              toast.error('This listing has expired.');
            } else if (msg.includes('ECannotBuyOwnListing')) {
              toast.error('You cannot buy your own listing.');
            } else if (msg.includes('EInsufficientPayment')) {
              toast.error('Insufficient payment. Price may have changed — refresh and retry.');
            } else if (msg.includes('EInsufficientRoyalty')) {
              toast.error('Royalty payment insufficient.');
            } else {
              toast.error('Purchase failed: ' + (msg || 'Unknown error'));
            }
          },
          onSettled: () => setBuying(false),
        }
      );
    } catch (error: any) {
      toast.error('Failed to construct purchase: ' + (error?.message || 'Unknown error'));
      setBuying(false);
    }
  };

  useEffect(() => {
    if (!selectedNft) {
      setAiEstimate(null);
      return;
    }

    let isMounted = true;
    const fetchEstimate = async () => {
      setEstimating(true);
      try {
        const estimate = await aiService.getPriceEstimate({
          id: selectedNft.id,
          name: selectedNft.name,
          rarityScore: selectedNft.rarityScore,
          traits: selectedNft.traits,
          recentSales: [],
          floorPrice: 10,
        });
        if (isMounted) setAiEstimate(estimate);
      } catch (error) {
        console.error('Failed to get AI estimate', error);
      } finally {
        if (isMounted) setEstimating(false);
      }
    };

    fetchEstimate();
    return () => { isMounted = false; };
  }, [selectedNft]);

  return (
    <div className="min-h-screen bg-black text-white selection:bg-accent-primary/30">
      <div className="max-w-7xl mx-auto px-6 py-24 space-y-24">
        <div className="flex flex-col md:flex-row items-end justify-between gap-12">
          <div className="space-y-8">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/40">Sui Genesis Collection</p>
              <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.04em]">
                SECONDARY<br />
                <span className="text-white/20">MARKET</span>
              </h1>
            </div>
            <p className="text-white/40 text-lg font-light max-w-xl leading-relaxed">
              Discover and acquire rare Sui Genesis assets from the community.
              All sales enforce on-chain royalties.
            </p>
          </div>
          <div className="flex items-center gap-6 md:gap-12 pb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Floor Price</p>
              <p className="text-4xl font-light tracking-tighter">1.25<span className="text-sm ml-1 opacity-40">SUI</span></p>
            </div>
            <div className="w-px h-16 bg-white/10" />
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">24h Volume</p>
              <p className="text-4xl font-light tracking-tighter">4,280<span className="text-sm ml-1 opacity-40">SUI</span></p>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white transition-colors" />
            <input
              type="text"
              placeholder="SEARCH ASSETS"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-4 py-2 bg-transparent border-b border-white/10 focus:outline-none focus:border-white transition-colors text-sm font-light tracking-widest uppercase"
            />
          </div>
          <div className="flex items-center justify-between gap-4 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-6 md:px-8 py-3 rounded-full border border-white/20 text-[10px] font-medium tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all text-center">
              FILTER
            </button>
            <button className="flex-1 md:flex-none px-6 md:px-8 py-3 rounded-full border border-white/20 text-[10px] font-medium tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all text-center">
              SORT: PRICE
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
          {filteredListings.map((nft) => (
            <motion.div
              key={nft.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="group cursor-pointer space-y-6"
              onClick={() => setSelectedNft(nft)}
            >
              <div className="relative aspect-3/4 overflow-hidden rounded bg-white/2">
                <WalrusImage
                  src={nft.image}
                  alt={nft.name}
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute top-6 left-6">
                  <RarityBadge score={nft.rarityScore} />
                </div>
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-center justify-center">
                  <div className="px-8 py-3 rounded-full border border-white/40 backdrop-blur-md text-[10px] font-medium tracking-[0.2em] uppercase">
                    VIEW DETAILS
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-lg font-light tracking-tight">{nft.name}</h3>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">GENESIS COLLECTION</p>
                  </div>
                  <div className="text-right space-y-1">
                    {nft.isListed ? (
                      <>
                        <p className="text-lg font-light tracking-tighter">{nft.price} SUI</p>
                        <span className="text-[8px] font-medium tracking-[0.2em] uppercase text-emerald-500 bg-emerald-500/10 px-2 py-0.5">LISTED</span>
                      </>
                    ) : (
                      <span className="text-[8px] font-medium tracking-[0.2em] uppercase text-white/30 bg-white/5 px-2 py-0.5">IN KIOSK</span>
                    )}
                  </div>
                </div>
                {typeof nft.description === 'string' && nft.description.trim() && (
                  <p className="text-xs font-light text-white/40 line-clamp-2 leading-relaxed">
                    {nft.description}
                  </p>
                )}
                <div className="h-px bg-white/5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Buy Modal */}
      <AnimatePresence>
        {selectedNft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-black/95 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-[1000px] w-full grid grid-cols-1 md:grid-cols-2 border border-white/10 bg-black relative max-h-[95vh] sm:max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <button
                onClick={() => setSelectedNft(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 z-10 text-white/40 hover:text-white bg-black/50 md:bg-transparent rounded-full backdrop-blur-md md:backdrop-blur-none transition-colors"
                title="CLOSE_WINDOW"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="h-64 sm:h-80 md:h-auto md:aspect-square border-r border-b md:border-b-0 border-white/10 bg-white/1 relative group">
                <WalrusImage
                  src={selectedNft.image}
                  alt={selectedNft.name}
                  className="w-full h-full object-cover filter contrast-125 select-none"
                />
                <div className="absolute top-4 left-4 md:top-6 md:left-6">
                  <RarityBadge score={selectedNft.rarityScore} />
                </div>
              </div>

              <div className="p-6 sm:p-8 md:p-12 lg:p-16 flex flex-col justify-between space-y-12">

                <div className="space-y-10">
                  <div className="space-y-4">
                    <div className={`flex items-center gap-4 ${selectedNft.isListed ? 'text-emerald-500' : 'text-amber-500'}`}>
                      <Tag className="w-5 h-5" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">
                        {selectedNft.isListed ? 'MARKET_LISTING' : 'VAULTED / NOT_FOR_SALE'}
                      </span>
                    </div>
                    <div className="space-y-2">
                       <h2 className="text-4xl md:text-5xl font-light tracking-tighter uppercase leading-none">{selectedNft.name}</h2>
                       <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">ID: {selectedNft.id.slice(0, 16)}...</p>
                    </div>
                    {typeof selectedNft.description === 'string' && selectedNft.description.trim() && (
                      <div className="pt-2">
                         <p className="text-sm md:text-base font-light text-white/40 leading-relaxed border-l-2 border-white/20 pl-4 py-1">
                           {selectedNft.description}
                         </p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-white/10 p-4 space-y-1 bg-white/1">
                      <p className="text-[9px] font-medium tracking-[0.2em] text-white/40 uppercase">ASKING_PRICE</p>
                      <p className="text-2xl font-light tracking-tighter">{selectedNft.price} SUI</p>
                    </div>
                    <div className="border border-white/10 p-4 space-y-1 bg-white/1">
                      <p className="text-[9px] font-medium tracking-[0.2em] text-white/40 uppercase">SELLER_INDEX</p>
                      <p className="text-sm font-mono text-white/60 truncate" title={selectedNft.seller}>{selectedNft.seller.slice(0, 10)}..</p>
                    </div>
                  </div>
                  {selectedNft.expiresAt > 0 && (
                    <div className="border border-amber-500/20 p-4 space-y-1 bg-amber-500/5">
                      <p className="text-[9px] font-medium tracking-[0.2em] text-amber-500/60 uppercase">EXPIRES_AT_EPOCH</p>
                      <p className="text-sm font-mono text-amber-400">{selectedNft.expiresAt}</p>
                    </div>
                  )}

                  <div className="space-y-4 border-t border-white/10 pt-8">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/40">TRAIT_ANALYSIS</p>
                      <span className="text-[9px] text-white/20 uppercase tracking-widest">{selectedNft.traits.length} IDENTIFIED</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedNft.traits.map((t: any) => (
                        <div key={t.key} className="p-3 bg-white/5 border border-white/5">
                          <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/40 mb-1">{t.key}</p>
                          <p className="text-sm font-light text-white">{t.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Price Estimate Section */}
                  <div className="space-y-4 border-t border-white/10 pt-8">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-emerald-500">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-[10px] font-medium tracking-[0.4em] uppercase">AI_VALUATION</span>
                      </div>
                    </div>
                    {estimating ? (
                      <div className="flex items-center justify-center py-6 border border-white/5 bg-white/1">
                        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                      </div>
                    ) : aiEstimate ? (
                      <div className="border border-emerald-500/20 p-6 space-y-6 bg-emerald-500/5">
                        <div className="flex justify-between items-end">
                          <div className="space-y-1">
                             <p className="text-[9px] font-medium tracking-[0.2em] text-emerald-500/50 uppercase">ESTIMATED_RANGE</p>
                             <p className="text-2xl font-light tracking-tighter text-emerald-400">{aiEstimate.low} - {aiEstimate.high} SUI</p>
                          </div>
                          <div className="space-y-1 text-right">
                             <p className="text-[9px] font-medium tracking-[0.2em] text-white/40 uppercase">CONFIDENCE</p>
                             <p className="text-sm font-medium tracking-widest text-emerald-500">HIGH</p>
                          </div>
                        </div>
                        <div className="h-px bg-emerald-500/20 w-full" />
                        <p className="text-[10px] text-emerald-400/60 leading-relaxed uppercase tracking-widest">
                          {aiEstimate.explanation}
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-4 pt-10">
                  <div className="flex justify-between items-center text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">
                    <span>Includes protocol royalty transmission</span>
                    <span>Secure Kiosk Transfer</span>
                  </div>
                  {!selectedNft.isListed && (
                    <div className="border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                      <p className="text-[10px] font-medium tracking-[0.3em] text-amber-400 uppercase">
                        <Lock className="w-4 h-4 inline mr-2" /> NOT LISTED — Owner must list this NFT for sale from their My Collection
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => handleBuy(selectedNft)}
                    disabled={buying || !selectedNft.isListed}
                    className={`w-full py-6 font-medium tracking-[0.4em] uppercase border transition-all duration-500 flex items-center justify-center gap-4 ${
                      selectedNft.isListed
                        ? 'bg-white text-black hover:bg-black hover:text-white border-white disabled:opacity-30 disabled:cursor-not-allowed'
                        : 'bg-transparent text-white/20 border-white/10 cursor-not-allowed'
                    }`}
                  >
                    {buying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        EXECUTING_TRANSFER...
                      </>
                    ) : selectedNft.isListed ? (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        AUTHORIZE_PURCHASE
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4 inline mr-2" /> NOT LISTED FOR SALE
                      </>
                    )}
                  </button>
                </div>

              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
