import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuiClient } from '@mysten/dapp-kit';
import { Network, Activity, Coins, ArrowRightLeft, Zap } from 'lucide-react';
import { PACKAGE_ID } from '../lib/sui';

interface AppEvent {
  id: string;
  type: string;
  parsedJson: any;
  timestampMs: string;
}

export default function LiveActivityFeed() {
  const suiClient = useSuiClient();
  const [events, setEvents] = useState<AppEvent[]>([]);

  useEffect(() => {
    // Fetch recent history from ALL package events
    suiClient.queryEvents({
      query: { MoveEventModule: { package: PACKAGE_ID, module: 'events' } },
      order: 'descending',
      limit: 20,
    }).then((res) => setEvents(res.data as any)).catch(console.error);

    // Subscribe to live events
    let unsubscribe: () => Promise<boolean>;
    const setupSubscription = async () => {
      try {
        if ('subscribeEvent' in suiClient) {
          unsubscribe = await (suiClient as any).subscribeEvent({
            filter: { MoveEventModule: { package: PACKAGE_ID, module: 'events' } },
            onMessage: (event: any) => {
              setEvents(prev => [event as any, ...prev].slice(0, 20));
            },
          });
        }
      } catch (err) {
        console.error('Failed to subscribe to live events', err);
      }
    };
    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe().catch(console.error);
      }
    };
  }, [suiClient]);

  const getEventLabel = (type: string): string => {
    if (type.includes('NFTMinted'))           return 'NFT MINTED';
    if (type.includes('NFTBurned'))           return 'NFT BURNED';
    if (type.includes('NFTStaked'))           return 'NFT STAKED';
    if (type.includes('NFTUnstaked'))         return 'NFT UNSTAKED';
    if (type.includes('RewardsClaimed'))      return 'REWARDS CLAIMED';
    if (type.includes('NFTPurchased'))        return 'NFT PURCHASED';
    if (type.includes('NFTListedForSale'))    return 'NFT LISTED';
    if (type.includes('NFTListingCancelled')) return 'LISTING CANCELLED';
    if (type.includes('NFTListedForRent'))    return 'LISTED FOR RENT';
    if (type.includes('NFTRented'))           return 'NFT RENTED';
    if (type.includes('NFTRentalEnded'))      return 'RENTAL ENDED';
    if (type.includes('MintCommitted'))       return 'MINT COMMITTED';
    if (type.includes('MintRevealed'))        return 'MINT REVEALED';
    if (type.includes('AuctionCreated'))      return 'AUCTION CREATED';
    if (type.includes('AuctionMint'))         return 'AUCTION MINT';
    if (type.includes('AuctionSettled'))      return 'AUCTION SETTLED';
    if (type.includes('UserAuctionCreated'))  return 'USER AUCTION';
    if (type.includes('UserAuctionSold'))     return 'AUCTION SOLD';
    if (type.includes('NFTUpgraded'))         return 'NFT UPGRADED';
    if (type.includes('NFTsMerged'))          return 'NFTs MERGED';
    if (type.includes('TraitAdded'))          return 'TRAIT ADDED';
    if (type.includes('TraitUpdated'))        return 'TRAIT UPDATED';
    if (type.includes('StorageSet'))          return 'STORAGE SET';
    if (type.includes('PhaseChanged'))        return 'PHASE CHANGED';
    if (type.includes('MultiSig'))            return 'GOVERNANCE';
    if (type.includes('ParameterChange'))     return 'PARAM CHANGE';
    // Generic fallback: strip module path
    const parts = type.split('::');
    const last = parts[parts.length - 1]?.split('<')[0] || '';
    return last.replace(/([A-Z])/g, ' $1').trim().toUpperCase() || 'NETWORK EVENT';
  };

  const getEventIcon = (type: string) => {
    if (type.includes('Minted') || type.includes('Revealed'))
      return <Activity className="w-4 h-4 text-emerald-500" />;
    if (type.includes('Purchased') || type.includes('Listed') || type.includes('Auction'))
      return <Coins className="w-4 h-4 text-amber-500" />;
    if (type.includes('Staked') || type.includes('Unstaked') || type.includes('Rewards'))
      return <Zap className="w-4 h-4 text-blue-400" />;
    if (type.includes('Rent') || type.includes('Rental'))
      return <ArrowRightLeft className="w-4 h-4 text-purple-400" />;
    if (type.includes('Trait') || type.includes('Upgraded') || type.includes('Merged'))
      return <Network className="w-4 h-4 text-white/40" />;
    return <ArrowRightLeft className="w-4 h-4 text-white/30" />;
  };

  const getEventDetail = (event: AppEvent): string => {
    const json = event.parsedJson || {};
    if (json.creator)       return `BY ${String(json.creator).slice(0, 6)}...${String(json.creator).slice(-4)}`;
    if (json.staker)        return `BY ${String(json.staker).slice(0, 6)}...${String(json.staker).slice(-4)}`;
    if (json.buyer)         return `BY ${String(json.buyer).slice(0, 6)}...${String(json.buyer).slice(-4)}`;
    if (json.borrower)      return `BY ${String(json.borrower).slice(0, 6)}...${String(json.borrower).slice(-4)}`;
    if (json.seller)        return `BY ${String(json.seller).slice(0, 6)}...${String(json.seller).slice(-4)}`;
    if (json.lender)        return `BY ${String(json.lender).slice(0, 6)}...${String(json.lender).slice(-4)}`;
    if (json.price_mist)    return `${(Number(json.price_mist) / 1e9).toFixed(4)} SUI`;
    if (json.amount_claimed) return `${(Number(json.amount_claimed) / 1e9).toFixed(2)} SGR`;
    return `TX: ${(event as any).id?.txDigest?.slice(0, 12) || '...'}`;
  };

  return (
    <div className="space-y-6 pt-12 mt-12 border-t border-white/10">
      <div className="flex items-center gap-3 text-white/40">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </div>
        <h3 className="text-[10px] font-medium tracking-[0.4em] uppercase">LIVE WEBSOCKET STREAM</h3>
      </div>

      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence initial={false}>
          {events.length === 0 && (
            <p className="text-xs font-light tracking-widest text-white/20">
              Awaiting network confirmation events...
            </p>
          )}
          {events.map((event) => (
            <motion.div
              key={(event as any).id?.txDigest + (event as any).id?.eventSeq || Math.random().toString()}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="p-4 border border-white/5 bg-white/2 hover:bg-white/5 transition-colors flex items-start gap-4"
            >
              <div className="p-2 rounded-lg bg-black/50 border border-white/10">
                {getEventIcon(event.type)}
              </div>
              <div className="space-y-1 overflow-hidden">
                <div className="flex justify-between items-center w-full gap-4">
                  <p className="text-[10px] font-bold tracking-widest leading-none truncate text-white uppercase">
                    {getEventLabel(event.type)}
                  </p>
                  {event.timestampMs && (
                    <p className="text-[9px] text-white/20 whitespace-nowrap">
                      {new Date(Number(event.timestampMs)).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <p className="text-xs text-white/40 truncate">
                  <span className="font-mono text-white/60">{getEventDetail(event)}</span>
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
