import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { networkConfig, NETWORK, PACKAGE_ID } from '../lib/sui';
import { Activity, ExternalLink } from 'lucide-react';

interface MintEvent {
  id: string;
  minter: string;
  nftName: string;
  timestamp: number;
}

export default function LiveFeed() {
  // Fetch real events from the package
  const { data: eventData } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveModule: { package: PACKAGE_ID, module: 'mint' } },
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
      minter: event.parsedJson?.minter || 'Unknown',
      nftName: event.parsedJson?.name || 'Sui Genesis NFT',
      timestamp: Number(event.timestampMs || Date.now()),
    }));
  }, [eventData]);

  return (
    <div className="fixed bottom-6 left-6 z-40 w-80 pointer-events-none">
      <div className="flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {events.map((event) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card p-4 pointer-events-auto flex items-center gap-3 shadow-2xl"
            >
              <div className="w-10 h-10 rounded-lg bg-accent-primary/20 flex items-center justify-center text-accent-primary">
                <Activity className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{event.nftName} Minted</p>
                <p className="text-xs text-white/40 truncate">
                  By {event.minter.slice(0, 6)}...{event.minter.slice(-4)}
                </p>
              </div>
              <a 
                href={`https://suiscan.xyz/${NETWORK}/tx/${event.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-white/20 hover:text-white transition-colors"
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
