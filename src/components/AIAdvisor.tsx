import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Brain, Loader2, Terminal, Info } from 'lucide-react';
import { aiService } from '../services/aiService';

export default function AIAdvisor() {
  const [loading, setLoading] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);

  const getAdvice = async () => {
    setLoading(true);
    try {
      const res = await aiService.getTraitSuggestion({
        distribution: [
          { trait: 'Chrome Body', count: 12 },
          { trait: 'Laser Eyes', count: 5 },
          { trait: 'Gold Aura', count: 2 },
        ]
      });
      setAdvice(res.suggestion);
    } catch (error) {
      console.error(error);
      setAdvice("ADVISOR_ERROR: NEURAL_LINK_TIMEOUT. RETRY_INITIALIZATION.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border border-white/10 bg-white/1 p-10 space-y-10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-white">
          <Terminal className="w-4 h-4 text-white/40" />
          <h3 className="text-[10px] font-medium tracking-[0.4em] uppercase">AI MINT ADVISOR v2.4</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[9px] font-bold tracking-widest text-emerald-500 uppercase">ONLINE</span>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        {advice ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-8"
          >
            <div className="flex gap-4">
               <span className="text-[10px] font-mono text-white/20">LOG_01:</span>
               <p className="text-xl font-light text-white leading-relaxed italic border-l border-white/10 pl-6">
                 "{advice}"
               </p>
            </div>
            <button 
              onClick={() => setAdvice(null)}
              className="text-[10px] font-medium tracking-[0.4em] text-white/20 hover:text-white transition-colors uppercase flex items-center gap-2"
            >
              <Info className="w-3 h-3" />
              Reset Parameters
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-10"
          >
            <div className="flex gap-4">
              <span className="text-[10px] font-mono text-white/20">INFO:</span>
              <p className="text-sm font-light text-white/40 leading-relaxed max-w-sm">
                Request a neural cross-analysis of collection traits to optimize your acquisition strategy.
              </p>
            </div>
            <button
              onClick={getAdvice}
              disabled={loading}
              className="group relative flex items-center justify-center w-full py-5 border border-white/10 text-white font-medium tracking-[0.2em] uppercase transition-all duration-300 hover:bg-white hover:text-black"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  ANALYZING_VARIANTS
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Sparkles className="w-4 h-4 opacity-40 group-hover:opacity-100" />
                  EXECUTE ANALYSIS
                </div>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

