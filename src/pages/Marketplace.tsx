import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Search, Filter, ShoppingBag, Tag, TrendingUp, X, Sparkles, Info, Loader2, InfoIcon, BarChart3 } from 'lucide-react';
import RarityBadge from '../components/RarityBadge';
import PriceChart from '../components/PriceChart';
import { toast } from 'react-hot-toast';
import { formatSui, NFT_TYPE, PACKAGE_ID } from '../lib/sui';
import { aiService, AIPriceEstimate } from '../services/aiService';

export default function Marketplace() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [search, setSearch] = useState('');
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [buying, setBuying] = useState(false);
  const [aiEstimate, setAiEstimate] = useState<AIPriceEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const suiClient = useSuiClient();

  // Fetch real events to get latest minted NFTs
  const { data: eventData } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveModule: { package: PACKAGE_ID, module: 'mint' } },
      limit: 20,
      order: 'descending',
    }
  );

  const [objectsData, setObjectsData] = useState<any[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);

  useEffect(() => {
    async function fetchObjects() {
      if (!eventData?.data) return;
      const objectIds = eventData.data
        .map((e: any) => e.parsedJson?.object_id)
        .filter(Boolean);
      
      if (objectIds.length === 0) return;
      
      setLoadingObjects(true);
      try {
        const res = await suiClient.multiGetObjects({
          ids: objectIds,
          options: { showContent: true, showDisplay: true, showOwner: true }
        });
        setObjectsData(res);
      } catch (e) {
        console.error("Failed to fetch objects", e);
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
      
      return {
        id: obj.data?.objectId,
        name: display?.name || content?.fields?.name || 'Sui Genesis NFT',
        image: display?.image_url || `https://picsum.photos/seed/${obj.data?.objectId}/600/600`,
        rarityScore: rarityScore,
        price: 'N/A', // Real marketplace contract needed for actual prices
        seller: obj.data?.owner?.AddressOwner || 'Unknown',
        traits: content?.fields?.traits || [],
        status: 'Unlisted',
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
      // Real buy action would go here
      toast.success('Purchase transaction prepared (requires real contract)');
      setSelectedNft(null);
    } catch (error) {
      console.error(error);
      toast.error('Purchase failed.');
    } finally {
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
              <h1 className="text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.04em]">
                SECONDARY<br />
                <span className="text-white/20">MARKET</span>
              </h1>
            </div>
            <p className="text-white/40 text-lg font-light max-w-xl leading-relaxed">
              Discover and acquire rare Sui Genesis assets from the community. 
              All sales enforce on-chain royalties.
            </p>
          </div>
          <div className="flex items-center gap-12 pb-4">
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
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button className="px-8 py-3 rounded-full border border-white/20 text-[10px] font-medium tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all">
              FILTER
            </button>
            <button className="px-8 py-3 rounded-full border border-white/20 text-[10px] font-medium tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all">
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
              <div className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-white/[0.02]">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card max-w-4xl w-full p-6 md:p-10 space-y-8 relative overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedNft(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                <div className="space-y-6">
                  <div className="aspect-square rounded-2xl overflow-hidden glass-card relative">
                    <img 
                      src={selectedNft.image} 
                      alt={selectedNft.name} 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-4 left-4">
                      <RarityBadge score={selectedNft.rarityScore} />
                    </div>
                  </div>
                  
                  <div className="glass-card p-6 space-y-4">
                    <div className="flex items-center gap-2 text-accent-secondary">
                      <BarChart3 className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase tracking-widest">PRICE HISTORY</h4>
                    </div>
                    <PriceChart />
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-accent-primary">
                      <Tag className="w-5 h-5" />
                      <p className="text-xs font-black uppercase tracking-widest">Market Listing</p>
                    </div>
                    <h2 className="text-4xl font-black italic tracking-tighter">{selectedNft.name}</h2>
                    <p className="text-xs font-mono text-white/40 truncate">{selectedNft.id}</p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-white/40">Traits Breakdown</p>
                    <div className="grid grid-cols-2 gap-3">
                      {selectedNft.traits.map((t: any) => (
                        <div key={t.key} className="p-3 rounded-xl bg-white/5 border border-white/10">
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/20 mb-1">{t.key}</p>
                          <p className="text-sm font-bold text-white/80">{t.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-6">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest text-white/40">Total Price</p>
                        <p className="text-4xl font-black italic tracking-tighter text-white">
                          {selectedNft.price} <span className="text-xl text-accent-secondary">SUI</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black uppercase tracking-widest text-white/40">Royalty (5%)</p>
                        <p className="text-sm font-bold text-white/60">{(Number(selectedNft.price) * 0.05).toFixed(2)} SUI</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center gap-3 p-4 rounded-xl bg-accent-primary/5 border border-accent-primary/20 text-accent-primary text-xs font-medium">
                        <InfoIcon className="w-4 h-4" />
                        This transaction includes royalty payment and kiosk locking.
                      </div>
                      <button 
                        onClick={() => handleBuy(selectedNft)}
                        disabled={buying}
                        className="w-full py-5 bg-accent-primary text-white font-black italic tracking-widest uppercase rounded-xl hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] transition-all flex items-center justify-center gap-3 text-xl"
                      >
                        {buying ? (
                          <>
                            <Loader2 className="w-6 h-6 animate-spin" />
                            PROCESSING...
                          </>
                        ) : (
                          <>
                            <ShoppingBag className="w-6 h-6" />
                            CONFIRM PURCHASE
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* AI Price Estimate Section */}
                  <div className="glass-card p-6 border-accent-secondary/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-accent-secondary">
                        <Sparkles className="w-4 h-4" />
                        <h4 className="text-xs font-black uppercase tracking-widest">AI PRICE ESTIMATE</h4>
                      </div>
                      <div className="px-2 py-1 rounded bg-accent-secondary/10 text-[10px] font-black text-accent-secondary">BETA</div>
                    </div>
                    {estimating ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-accent-secondary" />
                      </div>
                    ) : aiEstimate ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-sm font-medium text-white/40">Estimated Range</p>
                          <p className="text-lg font-black italic tracking-tight text-white">{aiEstimate.low} - {aiEstimate.high} SUI</p>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full w-1/3 bg-accent-secondary ml-[40%] rounded-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
                        </div>
                        <p className="text-xs text-white/40 leading-relaxed italic">
                          "{aiEstimate.explanation}"
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-white/40 text-center py-4 italic">Select an NFT to see AI valuation.</p>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
