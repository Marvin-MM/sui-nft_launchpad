import { useSuiClientQuery } from '@mysten/dapp-kit';
import { MINT_CONFIG_ID } from '../lib/sui';
import { motion } from 'framer-motion';
import { Activity, Shield, Zap } from 'lucide-react';

export default function PhaseStatus() {
  const { data } = useSuiClientQuery(
    'getObject',
    {
      id: MINT_CONFIG_ID,
      options: { showContent: true },
    }
  );

  const configFields = (data?.data?.content as any)?.fields || {};

  // current_phase: u8 — 0=PAUSED, 1=ALLOWLIST, 2=PUBLIC
  const phase = Number(configFields.current_phase ?? 2);

  // allowlist_price_mist is a direct u64 field
  const allowlistPrice = configFields.allowlist_price_mist ?? '1000000000';

  // mint_fee is TimeLockConfig<u64> — must unwrap .fields.current_value
  const mintFeeField = configFields.mint_fee;
  const publicPrice = (typeof mintFeeField === 'object' && mintFeeField?.fields?.current_value)
    ? String(mintFeeField.fields.current_value)
    : '2000000000';

  // paused is TimeLockConfig<bool> — must unwrap .fields.current_value
  const pausedField = configFields.paused;
  const isPaused = (typeof pausedField === 'object' && pausedField?.fields?.current_value !== undefined)
    ? Boolean(pausedField.fields.current_value)
    : false;

  const maxSupply   = Number(configFields.max_supply   || 10000);
  const mintedCount = Number(configFields.minted_count || 0);
  const remaining   = maxSupply - mintedCount;

  const phases = [
    {
      id: 0,
      name: 'Preparation',
      label: 'Cycle 0',
      price: 'PAUSED',
      icon: Activity,
      desc: 'Protocol initialized. All minting deactivated.',
    },
    {
      id: 1,
      name: 'Allowlist Access',
      label: 'Cycle 1',
      price: `${(Number(allowlistPrice) / 1e9).toFixed(4)} SUI`,
      icon: Shield,
      desc: 'Priority access for whitelisted contributors.',
    },
    {
      id: 2,
      name: 'Public Distribution',
      label: 'Cycle 2',
      price: `${(Number(publicPrice) / 1e9).toFixed(4)} SUI`,
      icon: Zap,
      desc: 'Open market access for global participants.',
    },
  ];

  return (
    <div className="space-y-0">
      {/* Paused Banner */}
      {(isPaused || phase === 0) && (
        <div className="flex items-center gap-4 px-6 py-3 border border-red-500/30 bg-red-500/5 text-red-500 text-[10px] tracking-[0.4em] uppercase font-medium">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
          PROTOCOL PAUSED — MINTING SUSPENDED BY ADMIN
        </div>
      )}

      {/* Phase Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10 border border-white/10 bg-white/2">
        {phases.map((p) => {
          const isActive    = phase === p.id;
          const isCompleted = phase > p.id;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className={`p-6 md:p-10 space-y-8 relative overflow-hidden transition-colors duration-700 ${
                isActive ? 'bg-white/3' : 'opacity-30'
              }`}
            >
              {/* Header */}
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">
                    {p.label}
                  </p>
                  <h3 className="text-xl font-light tracking-widest text-white uppercase">
                    {p.name}
                  </h3>
                </div>
                <p.icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-white/20'}`} />
              </div>

              {/* Price */}
              <div className="space-y-1">
                <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">
                  Network Valuation
                </p>
                <p className="text-4xl font-light tracking-tighter text-white">{p.price}</p>
              </div>

              {/* Description */}
              <p className="text-xs text-white/40 font-light leading-relaxed h-12">
                {p.desc}
              </p>

              {/* Footer */}
              <div className="pt-8 border-t border-white/5 flex items-center justify-between">
                {isActive ? (
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold tracking-[0.2em] text-emerald-500 uppercase">
                      {isPaused ? 'PROTOCOL PAUSED' : 'ACTIVE PROTOCOL'}
                    </span>
                  </div>
                ) : isCompleted ? (
                  <span className="text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">
                    TERMINATED
                  </span>
                ) : (
                  <span className="text-[10px] font-bold tracking-[0.2em] text-white/20 uppercase">
                    PENDING ACTIVATION
                  </span>
                )}

                {/* Remaining supply — replaces the old mock countdown timer */}
                {isActive && (
                  <span className="text-[10px] font-mono text-white/40 uppercase tracking-widest">
                    {remaining.toLocaleString()} REMAINING
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
