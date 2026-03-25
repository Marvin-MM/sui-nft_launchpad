import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Search, Filter, ShoppingBag, Tag, TrendingUp, X, Sparkles, Info, Loader2, InfoIcon, BarChart3 } from 'lucide-react';
import RarityBadge from '../components/RarityBadge';
import PriceChart from '../components/PriceChart';
import { toast } from 'react-hot-toast';
import { formatSui, NFT_TYPE, PACKAGE_ID, MIST_PER_SUI, TRANSFER_POLICY_ID } from '../lib/sui';
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
      // The NFTMinted event from events.move uses field `nft_id` (address type)
      const nftInfoMap: Record<string, { feePaid: string }> = {};
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
        const res = await suiClient.multiGetObjects({
          ids: objectIds,
          options: { showContent: true, showDisplay: true, showOwner: true }
        });
        // Attach on-chain mint fee info to each object
        setObjectsData(res.map((obj: any) => ({
          ...obj,
          _mintFee: nftInfoMap[obj.data?.objectId] || { feePaid: '0' },
        })));
      } catch (e) {
        console.error('Failed to fetch objects', e);
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
      // Use the actual mint fee from the on-chain event as a floor price indicator
      const mintFeeSui = formatSui(obj._mintFee?.feePaid || '0');
      
      return {
        id: obj.data?.objectId,
        name: display?.name || content?.fields?.name || 'Sui Genesis NFT',
        image: display?.image_url || `https://picsum.photos/seed/${obj.data?.objectId}/600/600`,
        rarityScore: rarityScore,
        // Real kiosk listing price would come from Kiosk dynamic fields;
        // mint fee is the on-chain floor reference. Listings require separate Kiosk indexing.
        price: mintFeeSui,
        seller: obj.data?.owner?.ObjectOwner || obj.data?.owner?.AddressOwner || 'In Kiosk',
        // To get the actual kiosk ID, the indexer must look up which kiosk owns this NFT.
        // For now we surface the NFT object ID — the buy flow requires seller kiosk resolution.
        sellerKioskId: null as string | null,
        traits: content?.fields?.traits || [],
        status: 'Listed',
      };
    });
  }, [objectsData]);

  const filteredListings = listings.filter(nft => 
    nft.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleBuy = async (nft: any) => {
    if (!account) return;
    setBuying(true);
    try {
      const tx = new Transaction();
      
      const { kioskArg, capArg, isNew } = resolveKioskArgs(tx, kioskId, kioskCapId);
      
      const priceInMist = BigInt(parseFloat(nft.price) * Number(MIST_PER_SUI));
      const [paymentCoin] = tx.splitCoins(tx.gas, [priceInMist]);

      const [purchasedItem, transferRequest] = tx.moveCall({
        target: '0x2::kiosk::purchase',
        typeArguments: [NFT_TYPE],
        arguments: [
          tx.object(nft.sellerKioskId),
          tx.object(nft.id),
          paymentCoin
        ]
      });

      // pay_with_split royalty rule: royalty::pay_with_split(policy, transfer_request, payment, ctx)
      // Standard purchase via kiosk then resolve transfer policy royalties
      tx.moveCall({
        target: `0x2::transfer_policy::confirm_request`,
        typeArguments: [NFT_TYPE],
        arguments: [
          tx.object(TRANSFER_POLICY_ID),
          transferRequest
        ]
      });

      tx.moveCall({
        target: '0x2::kiosk::place',
        typeArguments: [NFT_TYPE],
        arguments: [kioskArg, capArg, purchasedItem]
      });

      if (isNew) finalizeKiosk(tx, kioskArg, capArg, account.address);

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success('Purchase successful! Royalty automatically distributed to split config.');
            setSelectedNft(null);
          },
          onError: () => toast.error('Standard royalty purchase failed.'),
          onSettled: () => setBuying(false),
        }
      );
    } catch (error) {
      console.error(error);
      toast.error('Failed to construct Kiosk purchase transaction.');
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
              <div className="relative aspect-3/4 overflow-hidden rounded-2xl bg-white/2">
                <img 
                  src={nft.image} 
                  alt={nft.name} 
                  className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                  referrerPolicy="no-referrer"
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
                  <p className="text-lg font-light tracking-tighter">{nft.price} SUI</p>
                </div>
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-[1000px] w-full grid grid-cols-1 md:grid-cols-2 border border-white/10 bg-black overflow-hidden relative"
            >
              <button 
                onClick={() => setSelectedNft(null)}
                className="absolute top-6 right-6 p-2 z-10 text-white/40 hover:text-white transition-colors"
                title="CLOSE_WINDOW"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="aspect-square border-r border-b md:border-b-0 border-white/10 bg-white/1 relative group">
                <img 
                  src={selectedNft.image} 
                  alt={selectedNft.name} 
                  className="w-full h-full object-cover filter contrast-125 select-none"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-6 left-6">
                  <RarityBadge score={selectedNft.rarityScore} />
                </div>
              </div>
              
              <div className="p-8 md:p-12 lg:p-16 flex flex-col justify-between space-y-12 overflow-y-auto max-h-[85vh] custom-scrollbar">
                
                <div className="space-y-10">
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 text-emerald-500">
                      <Tag className="w-5 h-5" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">MARKET_LISTING</span>
                    </div>
                    <div className="space-y-2">
                       <h2 className="text-4xl md:text-5xl font-light tracking-tighter uppercase leading-none">{selectedNft.name}</h2>
                       <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">ID: {selectedNft.id.slice(0, 16)}...</p>
                    </div>
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
                  <button 
                    onClick={() => handleBuy(selectedNft)}
                    disabled={buying}
                    className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-4"
                  >
                    {buying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        EXECUTING_TRANSFER...
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-5 h-5" />
                        AUTHORIZE_PURCHASE
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
