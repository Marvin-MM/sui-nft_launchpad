import { motion } from 'framer-motion';

const traits = [
  {
    category: 'Background',
    values: [
      { name: 'Electric Violet', rarity: '5%', score: 95 },
      { name: 'Deep Space', rarity: '12%', score: 88 },
      { name: 'Nebula', rarity: '8%', score: 92 },
    ],
  },
  {
    category: 'Body',
    values: [
      { name: 'Chrome', rarity: '2%', score: 98 },
      { name: 'Matte Black', rarity: '15%', score: 85 },
      { name: 'Gold Plated', rarity: '1%', score: 99 },
    ],
  },
  {
    category: 'Eyes',
    values: [
      { name: 'Laser Beam', rarity: '4%', score: 96 },
      { name: 'Cybernetic', rarity: '10%', score: 90 },
      { name: 'Holographic', rarity: '6%', score: 94 },
    ],
  },
  {
    category: 'Head',
    values: [
      { name: 'Halo', rarity: '3%', score: 97 },
      { name: 'Cyber Horns', rarity: '7%', score: 93 },
      { name: 'Data Stream', rarity: '5%', score: 95 },
    ],
  },
  {
    category: 'Aura',
    values: [
      { name: 'Genesis', rarity: '0.5%', score: 100 },
      { name: 'Ethereal', rarity: '3%', score: 97 },
      { name: 'Void', rarity: '8%', score: 92 },
    ],
  },
  {
    category: 'Frame',
    values: [
      { name: 'Quantum', rarity: '2%', score: 98 },
      { name: 'Neural', rarity: '6%', score: 94 },
      { name: 'Minimal', rarity: '20%', score: 80 },
    ],
  },
  {
    category: 'Overlay',
    values: [
      { name: 'Binary Rain', rarity: '4%', score: 96 },
      { name: 'Circuitry', rarity: '11%', score: 89 },
      { name: 'None', rarity: '35%', score: 65 },
    ],
  },
  {
    category: 'Special',
    values: [
      { name: 'Legendary', rarity: '0.1%', score: 100 },
      { name: 'Artifact', rarity: '1%', score: 99 },
      { name: 'Standard', rarity: '50%', score: 50 },
    ],
  },
];

export default function RarityGrid() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 border-l border-t border-white/10 bg-white/1">
      {traits.map((trait, i) => (
        <motion.div
          key={trait.category}
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: i * 0.1 }}
          viewport={{ once: true }}
          className="border-r border-b border-white/10 p-6 lg:p-10 space-y-8 lg:space-y-12 hover:bg-white/1 transition-colors group"
        >
          <div className="space-y-4">
            <h3 className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">
              {trait.category}
            </h3>
            <div className="h-px w-8 bg-white/20 group-hover:w-full transition-all duration-700" />
          </div>

          <div className="space-y-6">
            {trait.values.map((v, vi) => (
              <div key={v.name} className="space-y-2 group/item">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-light text-white/60 group-hover/item:text-white transition-colors uppercase tracking-widest">
                    {v.name}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      Number(v.rarity.replace('%', '')) < 3
                        ? 'text-emerald-500'
                        : 'text-white/20'
                    }`}
                  >
                    {v.rarity}
                  </span>
                </div>
                <div className="h-[1px] w-full bg-white/5 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${v.score}%` }}
                    transition={{ duration: 1, delay: vi * 0.1 }}
                    viewport={{ once: true }}
                    className={`h-full ${
                      Number(v.rarity.replace('%', '')) < 3
                        ? 'bg-emerald-500'
                        : 'bg-white'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
