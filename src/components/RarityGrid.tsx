import { motion } from 'framer-motion';

const traits = [
  { category: 'Background', values: [{ name: 'Electric Violet', rarity: '5%' }, { name: 'Deep Space', rarity: '12%' }, { name: 'Nebula', rarity: '8%' }] },
  { category: 'Body', values: [{ name: 'Chrome', rarity: '2%' }, { name: 'Matte Black', rarity: '15%' }, { name: 'Gold Plated', rarity: '1%' }] },
  { category: 'Eyes', values: [{ name: 'Laser Beam', rarity: '4%' }, { name: 'Cybernetic', rarity: '10%' }, { name: 'Holographic', rarity: '6%' }] },
  { category: 'Head', values: [{ name: 'Halo', rarity: '3%' }, { name: 'Cyber Horns', rarity: '7%' }, { name: 'Data Stream', rarity: '5%' }] },
];

export default function RarityGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10 border border-white/10 bg-white/1">
      {traits.map((trait, i) => (
        <motion.div
          key={trait.category}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          viewport={{ once: true }}
          className="p-10 space-y-12 hover:bg-white/1 transition-colors group"
        >
          <div className="space-y-4">
            <h3 className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">{trait.category}</h3>
            <div className="h-px w-8 bg-white/20 group-hover:w-full transition-all duration-700" />
          </div>
          
          <div className="space-y-6">
            {trait.values.map((v) => (
              <div key={v.name} className="flex justify-between items-baseline group/item">
                <span className="text-sm font-light text-white/60 group-hover/item:text-white transition-colors uppercase tracking-widest">{v.name}</span>
                <span className={`text-[10px] font-mono ${
                  v.rarity.includes('1%') || v.rarity.includes('2%') ? 'text-emerald-500' : 'text-white/20'
                }`}>
                  {v.rarity}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

