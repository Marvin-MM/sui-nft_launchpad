import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { Search, Filter, Repeat, Clock, Coins, X, Info, Loader2, Calendar, ShieldCheck, User } from 'lucide-react';
import RarityBadge from '../components/RarityBadge';
import { toast } from 'react-hot-toast';
import { NFT_TYPE, PACKAGE_ID, MIST_PER_SUI, RENTAL_POLICY_ID } from '../lib/sui';
import { Transaction } from '@mysten/sui/transactions';
import { useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { useKiosk } from '../hooks/useKiosk';

export default function RentalMarketplace() {
  const account = useCurrentAccount();
  const [search, setSearch] = useState('');
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [renting, setRenting] = useState(false);
  const [duration, setDuration] = useState(1);
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { kioskId, kioskCapId } = useKiosk();

  // Query NFTListedForRent events to find active rental listings
  const { data: eventData } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::NFTListedForRent` },
      limit: 20,
      order: 'descending',
    }
  );

  const [objectsData, setObjectsData] = useState<any[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);

  useEffect(() => {
    async function fetchObjects() {
      if (!eventData?.data) return;
      // NFTListedForRent events have: nft_id, lender, price_per_epoch, max_duration, epoch
      const rentalInfoMap: Record<string, { pricePerEpoch: string; maxDuration: number; lender: string }> = {};
      const objectIds = eventData.data
        .filter((e: any) => e.parsedJson?.nft_id)
        .map((e: any) => {
          const nftId = e.parsedJson.nft_id as string;
          rentalInfoMap[nftId] = {
            pricePerEpoch: e.parsedJson?.price_per_epoch || '0',
            maxDuration: Number(e.parsedJson?.max_duration || 10),
            lender: e.parsedJson?.lender || '',
          };
          return nftId;
        });
      
      if (objectIds.length === 0) return;
      
      setLoadingObjects(true);
      try {
        const res = await suiClient.multiGetObjects({
          ids: objectIds,
          options: { showContent: true, showDisplay: true, showOwner: true }
        });
        setObjectsData(res.map((obj: any) => ({
          ...obj,
          _rentalInfo: rentalInfoMap[obj.data?.objectId] || { pricePerEpoch: '0', maxDuration: 10, lender: '' },
        })));
      } catch (e) {
        console.error('Failed to fetch objects', e);
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
      const info = obj._rentalInfo || {};
      
      return {
        id: obj.data?.objectId,
        name: display?.name || content?.fields?.name || 'Sui Genesis NFT',
        image: display?.image_url || `https://picsum.photos/seed/${obj.data?.objectId}/600/600`,
        rarityScore: content?.fields?.rarity_score || 0,
        // Price from on-chain NFTListedForRent event (MIST per epoch)
        pricePerEpochMist: info.pricePerEpoch || '0',
        pricePerEpoch: (Number(info.pricePerEpoch || 0) / 1_000_000_000).toFixed(4),
        // The lender's kiosk — needed to call rental::rent
        lenderKioskId: obj.data?.owner?.ObjectOwner || null,
        maxDuration: info.maxDuration || 10,
        lender: info.lender || obj.data?.owner?.AddressOwner || 'Unknown',
        traits: content?.fields?.traits || [],
      };
    });
  }, [objectsData]);

  const filteredRentals = rentals.filter(nft => 
    nft.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleRent = async (nft: any) => {
    if (!account) return;
    if (!RENTAL_POLICY_ID) {
      toast.error('Rental policy not configured. Set VITE_RENTAL_POLICY_ID in .env');
      return;
    }
    if (!nft.lenderKioskId) {
      toast.error('Cannot resolve lender kiosk ID for this listing.');
      return;
    }
    setRenting(true);
    try {
      const tx = new Transaction();

      // rental::rent(lender_kiosk, rental_policy, nft_id, duration_epochs, payment)
      // The contract auto-transfers the RentalAccessToken to the borrower (tx sender).
      // No buyer kiosk argument is needed.
      const totalMist = BigInt(nft.pricePerEpochMist) * BigInt(duration);
      const [paymentCoin] = tx.splitCoins(tx.gas, [totalMist]);

      tx.moveCall({
        target: `${PACKAGE_ID}::rental::rent`,
        arguments: [
          tx.object(nft.lenderKioskId),   // &mut Kiosk (lender's)
          tx.object(RENTAL_POLICY_ID),     // &mut RentalPolicy
          tx.pure.id(nft.id),             // nft_id: ID
          tx.pure.u64(duration),           // duration_epochs: u64
          paymentCoin,                     // Coin<SUI> (split to exact amount by contract)
        ]
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`Successfully rented for ${duration} epoch(s)! RentalAccessToken issued to your wallet.`);
            setSelectedNft(null);
          },
          onError: (e) => toast.error('Rental failed: ' + e.message),
          onSettled: () => setRenting(false)
        }
      );
    } catch (error) {
      console.error(error);
      toast.error('Failed to construct rental transaction.');
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
              <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.04em]">
                RENTAL<br />
                <span className="text-white/20">MARKET</span>
              </h1>
            </div>
            <p className="text-white/40 text-lg font-light max-w-xl leading-relaxed">
              Borrow utility and access by renting Sui Genesis assets from the community.
            </p>
          </div>
          <div className="flex items-center gap-6 md:gap-12 pb-4">
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
          <div className="flex items-center justify-between gap-4 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-6 md:px-8 py-3 rounded-full border border-white/20 text-[10px] font-medium tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all text-center">
              FILTER
            </button>
            <button className="flex-1 md:flex-none px-6 md:px-8 py-3 rounded-full border border-white/20 text-[10px] font-medium tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all text-center">
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-[900px] w-full grid grid-cols-1 md:grid-cols-2 border border-white/10 bg-black overflow-hidden relative"
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
                      <Repeat className="w-5 h-5" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">RENTAL_AGREEMENT</span>
                    </div>
                    <div className="space-y-2">
                       <h2 className="text-4xl md:text-5xl font-light tracking-tighter uppercase leading-none">{selectedNft.name}</h2>
                       <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">ID: {selectedNft.id.slice(0, 16)}...</p>
                    </div>
                  </div>

                  <div className="space-y-4 border-t border-white/10 pt-8">
                    <div className="flex justify-between items-center">
                      <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">DURATION_EPOCHS</p>
                      <span className="text-[9px] text-white/20 uppercase tracking-widest">{selectedNft.maxDuration} EPOCHS MAX</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <input 
                        type="range" 
                        min="1" 
                        max={selectedNft.maxDuration} 
                        value={duration}
                        onChange={(e) => setDuration(parseInt(e.target.value))}
                        className="flex-1 h-1 bg-white/10 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-none"
                      />
                      <span className="w-16 text-right text-2xl font-light tracking-tighter">{duration.toString().padStart(2, '0')}</span>
                    </div>
                  </div>

                  <div className="border border-white/10 p-6 space-y-4 bg-white/1">
                    <div className="flex items-center gap-3 text-emerald-500">
                      <ShieldCheck className="w-4 h-4" />
                      <p className="text-[10px] font-medium uppercase tracking-[0.4em]">TERMS_OF_SERVICE</p>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed uppercase tracking-widest">
                      Issuance of a <span className="text-white">RentalAccessToken</span> bounds utility access for {duration} epochs. Asset remains locked in lender's primary kiosk for duration.
                    </p>
                  </div>
                  
                  <div className="flex justify-between items-end border-t border-white/10 pt-8">
                    <div className="space-y-1">
                      <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">PAYLOAD_TOTAL</p>
                      <p className="text-4xl font-light tracking-tighter text-white">
                        {(Number(selectedNft.pricePerEpoch) * duration).toFixed(2)} SUI
                      </p>
                    </div>
                     <div className="space-y-1 text-right">
                       <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">RATE</p>
                       <p className="text-sm font-medium tracking-widest text-emerald-500">{selectedNft.pricePerEpoch} / EPOCH</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-10">
                  <div className="flex justify-between items-center text-[9px] font-medium uppercase tracking-[0.2em] text-white/40">
                    <span>Protocol rental issuance</span>
                    <span>Secure Kiosk Lock</span>
                  </div>
                  <button 
                    onClick={() => handleRent(selectedNft)}
                    disabled={renting}
                    className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-4"
                  >
                    {renting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        EXECUTING_RENTAL...
                      </>
                    ) : (
                      <>
                        <Clock className="w-5 h-5" />
                        AUTHORIZE_RENTAL
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
