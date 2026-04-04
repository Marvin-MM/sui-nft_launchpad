import { motion } from 'framer-motion';
import { MoreVertical, Lock, Unlock, Repeat, Flame, Layers, Eye } from 'lucide-react';
import RarityBadge from './RarityBadge';
import WalrusImage from './WalrusImage';

interface NFTCardProps {
  key?: string | number;
  nft: {
    id: string;
    name: string;
    /** May be walrus://<blobId>, https://, or null. WalrusImage handles all cases. */
    image: string | null;
    /** Optional MIME type hint from upload time for faster display */
    mimeType?: string;
    rarityScore: number;
    staked: boolean;
    traits: { key: string; value: string }[];
  };
  onAction: (action: string) => void;
}

export default function NFTCard({ nft, onAction }: NFTCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card group relative overflow-hidden transition-all duration-500 hover:border-accent-primary/50 hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]"
    >
      <div className="relative aspect-square overflow-hidden">
        {/* WalrusImage resolves walrus:// URIs via the aggregator, detects MIME type
            from file magic bytes, and renders a proper blob: URL */}
        <WalrusImage
          src={nft.image}
          alt={nft.name}
          mimeType={nft.mimeType}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          loadingPlaceholder={
            <div className="w-full h-full bg-white/5 animate-pulse" />
          }
        />
        <div className="absolute top-4 left-4">
          <RarityBadge score={nft.rarityScore} />
        </div>
        {nft.staked && (
          <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-accent-primary text-white text-[10px] font-black tracking-widest uppercase flex items-center gap-1 shadow-lg shadow-accent-primary/50">
            <Lock className="w-3 h-3" />
            STAKED
          </div>
        )}
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-6">
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => onAction('view')}
              className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-white/20 transition-all flex items-center justify-center gap-2"
            >
              <Eye className="w-3 h-3" />
              VIEW
            </button>
            <button 
              onClick={() => onAction('stake')}
              className="px-4 py-2 bg-accent-primary/80 backdrop-blur-md rounded-xl text-[10px] font-black tracking-widest uppercase hover:bg-accent-primary transition-all flex items-center justify-center gap-2"
            >
              {nft.staked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {nft.staked ? 'UNSTAKE' : 'STAKE'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h3 className="text-xl font-black tracking-tight">{nft.name}</h3>
            <p className="text-xs font-mono text-white/40">ID: {nft.id.slice(0, 10)}...</p>
          </div>
          <div className="relative group/menu">
            <button className="p-2 rounded hover:bg-white/5 transition-colors text-white/40 hover:text-white">
              <MoreVertical className="w-5 h-5" />
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 glass-card p-2 opacity-0 group-hover/menu:opacity-100 pointer-events-none group-hover/menu:pointer-events-auto transition-all duration-200 z-20 shadow-2xl border-white/10">
              {[
                { label: 'List for Rent', icon: Repeat, action: 'rent' },
                { label: 'Burn to Upgrade', icon: Flame, action: 'burn' },
                { label: 'Merge NFT', icon: Layers, action: 'merge' },
              ].map((item) => (
                <button
                  key={item.action}
                  onClick={() => onAction(item.action)}
                  className="w-full px-4 py-2 rounded text-xs font-black tracking-widest uppercase hover:bg-white/5 flex items-center gap-3 text-white/60 hover:text-white transition-all"
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {nft.traits.slice(0, 3).map((trait) => (
            <div key={trait.key} className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-black tracking-widest uppercase text-white/40">
              {trait.key}: <span className="text-white/80">{trait.value}</span>
            </div>
          ))}
          {nft.traits.length > 3 && (
            <div className="px-2 py-1 rounded bg-white/5 border border-white/10 text-[10px] font-black tracking-widest uppercase text-white/40">
              +{nft.traits.length - 3} MORE
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
