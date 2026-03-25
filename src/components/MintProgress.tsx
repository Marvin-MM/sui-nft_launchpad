import { useSuiClientQuery } from '@mysten/dapp-kit';
import { networkConfig, NETWORK, MINT_CONFIG_ID } from '../lib/sui';
import { motion } from 'framer-motion';

export default function MintProgress() {
  const { data, isLoading } = useSuiClientQuery(
    'getObject',
    {
      id: MINT_CONFIG_ID,
      options: { showContent: true },
    },
    {
      refetchInterval: 15000,
    }
  );

  const mintedCount = (data?.data?.content as any)?.fields?.minted_count || 0;
  const maxSupply = (data?.data?.content as any)?.fields?.max_supply || 10000;
  const progress = (mintedCount / maxSupply) * 100;

  return (
    <div className="w-full space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/40">Total Minted Assets</p>
          <div className="flex items-baseline gap-4">
            <h2 className="text-4xl md:text-6xl font-light tracking-tighter text-white">
              {mintedCount.toLocaleString()}
            </h2>
            <span className="text-lg md:text-xl font-light text-white/10">OF {maxSupply.toLocaleString()}</span>
          </div>
        </div>
        <div className="text-left sm:text-right space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/40">Efficiency</p>
          <p className="text-3xl md:text-4xl font-light tracking-tighter text-white">{progress.toFixed(1)}%</p>
        </div>
      </div>
      
      <div className="h-2 w-full bg-white/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
          className="h-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.2)]"
        />
      </div>

      <div className="flex justify-between text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">
         <span>Cycle Progress</span>
         <span>Network Synchronized</span>
      </div>
    </div>
  );
}

