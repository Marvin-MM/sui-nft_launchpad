import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Search, Filter, Repeat, Clock, Coins, X, Info, Loader2, Calendar, ShieldCheck, User } from 'lucide-react';
import RarityBadge from '../components/RarityBadge';
import { toast } from 'react-hot-toast';
import { NFT_TYPE, PACKAGE_ID } from '../lib/sui';

export default function RentalMarketplace() {
  const account = useCurrentAccount();
  const [search, setSearch] = useState('');
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [renting, setRenting] = useState(false);
  const [duration, setDuration] = useState(1);
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

  const rentals = useMemo(() => {
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
        pricePerEpoch: 'N/A', // Real rental contract needed for actual prices
        maxDuration: 10,
        lender: obj.data?.owner?.AddressOwner || 'Unknown',
        traits: content?.fields?.traits || [],
      };
    });
  }, [objectsData]);

  const filteredRentals = rentals.filter(nft => 
    nft.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRent = async (nft: any) => {
    if (!account) return;
    setRenting(true);
    try {
      // Real rent action would go here
      toast.success('Rental transaction prepared (requires real contract)');
      setSelectedNft(null);
    } catch (error) {
      console.error(error);
      toast.error('Rental failed.');
    } finally {
      setRenting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-accent-primary/30">
      <div className="max-w-7xl mx-auto px-6 py-24 space-y-24">
        <div className="flex flex-col md:flex-row items-end justify-between gap-12">
          <div className="space-y-8">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/40">Sui Genesis Collection</p>
              <h1 className="text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.04em]">
                RENTAL<br />
                <span className="text-white/20">MARKET</span>
              </h1>
            </div>
            <p className="text-white/40 text-lg font-light max-w-xl leading-relaxed">
              Borrow utility and access by renting Sui Genesis assets from the community.
            </p>
          </div>
          <div className="flex items-center gap-12 pb-4">
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Active Rentals</p>
              <p className="text-4xl font-light tracking-tighter">1,240</p>
            </div>
            <div className="w-px h-16 bg-white/10" />
            <div className="space-y-1">
              <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">Total Yield</p>
              <p className="text-4xl font-light tracking-tighter">8,920<span className="text-sm ml-1 opacity-40">SUI</span></p>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/10" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="relative w-full md:w-96 group">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-white transition-colors" />
            <input 
              type="text" 
              placeholder="SEARCH RENTALS"
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
              SORT: YIELD
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-16">
          {filteredRentals.map((nft) => (
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
                  <div className="text-right">
                    <p className="text-lg font-light tracking-tighter">{nft.pricePerEpoch} SUI</p>
                    <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">PER EPOCH</p>
                  </div>
                </div>
                <div className="h-px bg-white/5" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Rent Modal */}
      <AnimatePresence>
        {selectedNft && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="glass-card max-w-2xl w-full p-6 md:p-10 space-y-8 relative overflow-y-auto max-h-[90vh]"
            >
              <button 
                onClick={() => setSelectedNft(null)}
                className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-full hover:bg-white/5 transition-colors text-white/40 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>

              <div className="flex items-center gap-4 text-accent-secondary">
                <Repeat className="w-6 h-6" />
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">RENTAL AGREEMENT</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="aspect-square rounded-2xl overflow-hidden glass-card">
                  <img 
                    src={selectedNft.image} 
                    alt={selectedNft.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase tracking-widest text-white/40">Selected Asset</p>
                    <h3 className="text-2xl font-black italic tracking-tight">{selectedNft.name}</h3>
                    <p className="text-xs font-mono text-accent-secondary truncate">{selectedNft.id}</p>
                  </div>

                  <div className="space-y-4">
                    <p className="text-xs font-black uppercase tracking-widest text-white/40">Rental Duration (Epochs)</p>
                    <div className="flex items-center gap-4">
                      <input 
                        type="range" 
                        min="1" 
                        max={selectedNft.maxDuration} 
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="flex-1 h-2 bg-white/5 rounded-full appearance-none cursor-pointer accent-accent-secondary"
                      />
                      <span className="w-12 text-center font-black italic text-xl">{duration}</span>
                    </div>
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/20">
                      <span>1 EPOCH</span>
                      <span>{selectedNft.maxDuration} EPOCHS MAX</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-center gap-2 text-accent-secondary">
                      <ShieldCheck className="w-4 h-4" />
                      <p className="text-xs font-black uppercase tracking-widest">Rental Terms</p>
                    </div>
                    <p className="text-sm text-white/60 leading-relaxed font-medium">
                      You will receive a <span className="text-white">RentalAccessToken</span> for {duration} epochs. This token grants you all utility associated with the NFT. The asset remains in the lender's kiosk but is locked for your use.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="space-y-1">
                        <p className="text-xs font-black uppercase tracking-widest text-white/40">Total Cost</p>
                        <p className="text-4xl font-black italic tracking-tighter text-white">
                          {(Number(selectedNft.pricePerEpoch) * duration).toFixed(2)} <span className="text-xl text-accent-secondary">SUI</span>
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleRent(selectedNft)}
                      disabled={renting}
                      className="w-full py-5 bg-accent-secondary text-white font-black italic tracking-widest uppercase rounded-xl hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all flex items-center justify-center gap-3 text-xl"
                    >
                      {renting ? (
                        <>
                          <Loader2 className="w-6 h-6 animate-spin" />
                          RENTING...
                        </>
                      ) : (
                        <>
                          <Clock className="w-6 h-6" />
                          CONFIRM RENTAL
                        </>
                      )}
                    </button>
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
