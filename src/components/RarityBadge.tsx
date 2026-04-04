import { motion } from 'framer-motion';

interface RarityBadgeProps {
  score: number;
}

export default function RarityBadge({ score }: RarityBadgeProps) {
  const getTier = (s: number) => {
    if (s >= 90) return { label: 'LEGENDARY', color: 'from-accent-amber to-orange-600', shadow: 'shadow-accent-amber/50' };
    if (s >= 75) return { label: 'EPIC', color: 'from-accent-primary to-purple-600', shadow: 'shadow-accent-primary/50' };
    if (s >= 50) return { label: 'RARE', color: 'from-accent-secondary to-blue-600', shadow: 'shadow-accent-secondary/50' };
    if (s >= 25) return { label: 'UNCOMMON', color: 'from-green-500 to-emerald-600', shadow: 'shadow-green-500/50' };
    return { label: 'COMMON', color: 'from-white/20 to-white/10', shadow: 'shadow-white/20' };
  };

  const tier = getTier(score);

  return (
    <div className="flex items-center gap-2">
      <div className={`px-3 py-1 rounded bg-linear-to-r ${tier.color} text-[10px] font-black tracking-widest uppercase shadow-lg ${tier.shadow}`}>
        {tier.label}
      </div>
      <div className="px-3 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-black tracking-widest uppercase text-white/60">
        SCORE: {score}
      </div>
    </div>
  );
}
