import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { NETWORK, PACKAGE_ID } from '../lib/sui';
import { Activity, ExternalLink } from 'lucide-react';

export default function LiveFeed() {
  // Fetch real events from the package events module
  const { data: eventData } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::NFTMinted` },
      limit: 3,
      order: 'descending',
    },
    {
      refetchInterval: 10000, // Poll every 10 seconds
    }
  );

  const events = useMemo(() => {
    if (!eventData?.data) return [];
    return eventData.data.map((event: any) => ({
      id: event.id.txDigest,
      minter: event.parsedJson?.creator || 'Unknown',
      nftName: event.parsedJson?.name || 'SUI_GENESIS_ASSET',
      timestamp: Number(event.timestampMs || Date.now()),
    }));
  }, [eventData]);

  if (events.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-40 w-80 pointer-events-none hidden md:block">
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-black border border-emerald-500/50 p-4 pointer-events-auto flex items-center gap-4 shadow-2xl transition-all hover:bg-emerald-500/5"
            >
              <div className="w-10 h-10 border border-emerald-500 flex items-center justify-center text-emerald-500 bg-emerald-500/10 shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[10px] font-medium tracking-[0.2em] text-white uppercase truncate">
                  {event.nftName} MINTED
                </p>
                <p className="text-[10px] font-mono text-emerald-500/80 truncate uppercase tracking-widest">
                  BY {event.minter.slice(0, 6)}...{event.minter.slice(-4)}
                </p>
              </div>
              <a 
                href={`https://suiscan.xyz/${NETWORK}/tx/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/20 hover:text-white transition-colors"
                title="View on Suiscan"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
