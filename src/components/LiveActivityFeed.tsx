import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuiClient } from '@mysten/dapp-kit';
import { Network, Activity, Coins, ArrowRightLeft } from 'lucide-react';
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
    // Fetch some recent history first
    suiClient.queryEvents({
      query: { MoveModule: { package: PACKAGE_ID, module: 'mint' } },
      order: 'descending',
      limit: 10
    }).then((res) => setEvents(res.data as any)).catch(console.error);

    // Subscribe to live events
    let unsubscribe: () => Promise<boolean>;
    const setupSubscription = async () => {
      try {
        if ('subscribeEvent' in suiClient) {
          unsubscribe = await (suiClient as any).subscribeEvent({
            filter: { Package: PACKAGE_ID },
            onMessage: (event: any) => {
              setEvents(prev => [event as any, ...prev].slice(0, 10));
            }
          });
        }
      } catch (err) {
        console.error("Failed to subscribe to live events", err);
      }
    };
    setupSubscription();

    return () => {
      if (unsubscribe) {
        unsubscribe().catch(console.error);
      }
    };
  }, [suiClient]);

  const getEventIcon = (type: string) => {
    if (type.includes('mint::')) return <Activity className="w-4 h-4 text-emerald-500" />;
    if (type.includes('royalty::') || type.includes('transfer_policy::')) return <Coins className="w-4 h-4 text-amber-500" />;
    return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
  };

  const getEventName = (type: string) => {
    const parts = type.split('::');
    if (parts.length > 2) return `${parts[1].toUpperCase()}_${parts[2].split('<')[0].toUpperCase()}`;
    return 'NETWORK_EVENT';
  };

  return (
    <div className="space-y-6 pt-12 mt-12 border-t border-white/10">
      <div className="flex items-center gap-3 text-white/40">
        <div className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
        </div>
        <h3 className="text-[10px] font-medium tracking-[0.4em] uppercase">LIVE WEBSOCKET STREAM</h3>
      </div>
      
      <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        <AnimatePresence initial={false}>
          {events.length === 0 && (
            <p className="text-xs font-light tracking-widest text-white/20 italic">Awaiting network confirmation events...</p>
          )}
          {events.map((event) => (
             <motion.div
               key={event.id?.txDigest + event.id?.eventSeq || Math.random().toString()}
               initial={{ opacity: 0, y: -20, scale: 0.95 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               className="p-4 border border-white/5 bg-white/2 hover:bg-white/5 transition-colors flex items-start gap-4"
             >
               <div className="p-2 rounded-lg bg-black/50 border border-white/10">
                 {getEventIcon(event.type)}
               </div>
               <div className="space-y-1 overflow-hidden">
                 <div className="flex justify-between items-center w-full gap-4">
                   <p className="text-[10px] font-bold tracking-widest leading-none truncate text-white uppercase">{getEventName(event.type)}</p>
                   {event.timestampMs && (
                     <p className="text-[9px] text-white/20 whitespace-nowrap">
                       {new Date(Number(event.timestampMs)).toLocaleTimeString()}
                     </p>
                   )}
                 </div>
                 <p className="text-xs text-white/40 truncate">
                   TX: <span className="font-mono text-white/60">{event.id?.txDigest}</span>
                 </p>
               </div>
             </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
