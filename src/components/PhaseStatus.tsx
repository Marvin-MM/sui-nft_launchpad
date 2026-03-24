import { useState, useEffect } from 'react';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import { networkConfig, NETWORK, MINT_CONFIG_ID } from '../lib/sui';
import { motion } from 'framer-motion';
import { Clock, CheckCircle2, Lock, Activity, Shield, Zap } from 'lucide-react';

export default function PhaseStatus() {
  const [timeLeft, setTimeLeft] = useState<number>(3600); // 1 hour mock

  const { data } = useSuiClientQuery(
    'getObject',
    {
      id: MINT_CONFIG_ID,
      options: { showContent: true },
    }
  );

  const phase = (data?.data?.content as any)?.fields?.phase || 0;
  const allowlistPrice = (data?.data?.content as any)?.fields?.allowlist_price || '1000000000';
  const publicPrice = (data?.data?.content as any)?.fields?.public_price || '2000000000';

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10 border border-white/10 bg-white/2">
      {[
        { id: 0, name: 'Upcoming Cycle', label: 'Cycle 0', price: 'TBA', icon: Activity, desc: 'Preparation and internal testing phase.' },
        { id: 1, name: 'Allowlist Access', label: 'Cycle 1', price: `${Number(allowlistPrice) / 1e9} SUI`, icon: Shield, desc: 'Priority access for whitelisted contributors.' },
        { id: 2, name: 'Public Distribution', label: 'Cycle 2', price: `${Number(publicPrice) / 1e9} SUI`, icon: Zap, desc: 'Open market access for global participants.' },
      ].map((p) => {
        const isActive = phase === p.id;
        const isCompleted = phase > p.id;
        
        return (
          <motion.div
            key={p.id}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className={`p-10 space-y-8 relative overflow-hidden transition-colors duration-700 ${
              isActive ? 'bg-white/3' : 'opacity-30'
            }`}
          >
            <div className="flex justify-between items-start">
               <div className="space-y-1">
                 <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">{p.label}</p>
                 <h3 className="text-xl font-light tracking-widest text-white uppercase">{p.name}</h3>
               </div>
               <p.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/20'}`} />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">Network Valuation</p>
              <p className="text-4xl font-light tracking-tighter text-white">{p.price}</p>
            </div>

            <p className="text-xs text-white/40 font-light leading-relaxed h-12">
              {p.desc}
            </p>

            <div className="pt-8 border-t border-white/5 flex items-center justify-between">
               {isActive ? (
                 <div className="flex items-center gap-3">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                   <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-500 uppercase">ACTIVE PROTOCOL</span>
                 </div>
               ) : isCompleted ? (
                 <span className="text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">TERMINATED</span>
               ) : (
                 <span className="text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">PENDING ACTIVATION</span>
               )}

               {isActive && p.id === 0 && (
                 <p className="text-sm font-light tracking-widest text-white/60 font-mono">
                   {formatTime(timeLeft)}
                 </p>
               )}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

