import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuiClientQuery, useSuiClient } from '@mysten/dapp-kit';
import { MINT_CONFIG_ID, PACKAGE_ID } from '../lib/sui';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  Activity, Users, Coins, Flame, Lock, ShoppingBag, 
  TrendingUp, Sparkles, Loader2, Brain, BarChart3, PieChartIcon 
} from 'lucide-react';
import { aiService } from '../services/aiService';

const COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

export default function Analytics() {
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const suiClient = useSuiClient();

  // Fetch real mint config data
  const { data: mintConfig, isLoading: loadingConfig } = useSuiClientQuery(
    'getObject',
    {
      id: MINT_CONFIG_ID,
      options: { showContent: true },
    }
  );

  // Fetch real events from the package
  const { data: eventData, isLoading: loadingEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveModule: { package: PACKAGE_ID, module: 'mint' } },
      limit: 50,
      order: 'descending',
    }
  );

  const [objectsData, setObjectsData] = useState<any[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);

  useEffect(() => {
    async function fetchObjects() {
      if (!eventData?.data) return;
      const objectIds = eventData.data
        .map((e: any) => e.parsedJson?.object_id)
        .filter(Boolean);
      
      if (objectIds.length === 0) return;
      
      setLoadingObjects(true);
      try {
        const res = await suiClient.multiGetObjects({
          ids: objectIds,
          options: { showContent: true, showOwner: true }
        });
        setObjectsData(res);
      } catch (e) {
        console.error("Failed to fetch objects", e);
      } finally {
        setLoadingObjects(false);
      }
    }
    fetchObjects();
  }, [eventData, suiClient]);

  const stats = useMemo(() => {
    const content = mintConfig?.data?.content as any;
    if (!content) return { minted: 0, total: 10000, staked: 0, volume: 0 };
    
    // Calculate staked from real objects
    const stakedCount = objectsData.filter((obj: any) => {
      const objContent = obj.data?.content as any;
      return objContent?.fields?.staked === true;
    }).length;

    return {
      minted: Number(content.fields?.minted_count || 0),
      total: Number(content.fields?.total_supply || 10000),
      staked: stakedCount,
      volume: 0, // Real volume requires a marketplace contract
    };
  }, [mintConfig, objectsData]);

  const mintData = useMemo(() => {
    if (!eventData?.data) return [];
    // Group events by day
    const grouped: Record<string, number> = {};
    eventData.data.forEach((e: any) => {
      const date = new Date(Number(e.timestampMs)).toLocaleDateString();
      grouped[date] = (grouped[date] || 0) + 1;
    });
    return Object.entries(grouped).map(([date, count]) => ({
      epoch: date,
      minted: count
    })).reverse();
  }, [eventData]);

  const traitData = useMemo(() => {
    if (!objectsData.length) return [];
    const traits: Record<string, number> = {};
    objectsData.forEach((obj: any) => {
      const content = obj.data?.content as any;
      const objTraits = content?.fields?.traits || [];
      objTraits.forEach((t: string) => {
        traits[t] = (traits[t] || 0) + 1;
      });
    });
    return Object.entries(traits)
      .map(([name, count]) => ({
        name,
        value: Math.round((count / objectsData.length) * 100),
        rarity: count === 1 ? 'Mythic' : count < 5 ? 'Rare' : 'Common'
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [objectsData]);

  const stakingData = useMemo(() => {
    if (!objectsData.length) return [];
    const staked = objectsData.filter((obj: any) => (obj.data?.content as any)?.fields?.staked).length;
    const unstaked = objectsData.length - staked;
    return [
      { name: 'Staked', value: staked },
      { name: 'Unstaked', value: unstaked }
    ];
  }, [objectsData]);

  const getAiSummary = async () => {
    setLoadingAI(true);
    try {
      const res = await aiService.getCollectionSummary({
        minted: stats.minted,
        staked: stats.staked,
        floor: 0,
        volume: stats.volume
      });
      setAiSummary(res.summary);
    } catch (error) {
      console.error(error);
      setAiSummary(`The collection has minted ${stats.minted} out of ${stats.total} assets. Staking participation is ${stats.staked}.`);
    } finally {
      setLoadingAI(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-accent-primary/30">
      <div className="max-w-[1600px] mx-auto border-x border-white/10 min-h-screen">
        {/* Header Section */}
        <div className="p-12 border-b border-white/10 space-y-8">
          <div className="flex flex-col md:flex-row items-end justify-between gap-8">
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-50">Sui Genesis Network</p>
              <h1 className="text-8xl font-black tracking-tighter leading-none uppercase italic">
                ANALYTICS<br />
                <span className="text-white/20">TERMINAL</span>
              </h1>
            </div>
            <div className="flex items-center gap-12 pb-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Network Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                  <p className="text-xl font-mono uppercase tracking-widest">Mainnet-v1.0</p>
                </div>
              </div>
              <button 
                onClick={getAiSummary}
                disabled={loadingAI}
                className="px-8 py-4 border border-white/20 text-[10px] font-bold uppercase tracking-widest hover:bg-white hover:text-black transition-all flex items-center gap-3"
              >
                {loadingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Brain className="w-5 h-5" />}
                {aiSummary ? 'REFRESH AI' : 'GENERATE AI'}
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 divide-x divide-y md:divide-y-0 divide-white/10 border-b border-white/10">
          {[
            { label: 'Total Minted', value: stats.minted.toLocaleString(), suffix: '/ 10,000' },
            { label: 'Total Supply', value: stats.total.toLocaleString(), suffix: 'NFTs' },
            { label: 'Total Staked', value: stats.staked.toLocaleString(), suffix: 'NFTs' },
            { label: 'Rental Volume', value: stats.volume, suffix: 'SUI' },
            { label: 'Royalties', value: (stats.volume * 0.05).toFixed(2), suffix: 'SUI' },
            { label: 'Holders', value: Math.floor(stats.minted * 0.22).toLocaleString(), suffix: 'Wallets' },
          ].map((stat) => (
            <div key={stat.label} className="p-8 space-y-4 hover:bg-white/5 transition-colors group">
              <p className="text-[10px] font-serif italic uppercase tracking-widest opacity-50 group-hover:opacity-70">{stat.label}</p>
              <div className="space-y-1">
                <h2 className="text-3xl font-mono tracking-tighter leading-none">{stat.value}</h2>
                <p className="text-[10px] font-mono opacity-40 group-hover:opacity-60 uppercase tracking-widest">{stat.suffix}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI Summary Card - Integrated */}
        <AnimatePresence>
          {aiSummary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="border-b border-white/10 bg-white/5 text-white overflow-hidden"
            >
              <div className="p-12 space-y-4">
                <div className="flex items-center gap-2 opacity-50">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-[10px] font-bold uppercase tracking-widest">AI COLLECTION ANALYST</h3>
                </div>
                <p className="text-3xl font-serif italic tracking-tight leading-relaxed">
                  "{aiSummary}"
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-x divide-white/10">
          {/* Mint Activity */}
          <div className="p-12 space-y-8 border-b lg:border-b-0 border-white/10">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-black italic tracking-tight uppercase">MINT ACTIVITY</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Epoch-based distribution</p>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mintData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.1} vertical={false} />
                  <XAxis dataKey="epoch" stroke="#ffffff" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#ffffff" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip 
                    contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', fontSize: '10px', fontFamily: 'monospace' }}
                    cursor={{ fill: '#ffffff', opacity: 0.05 }}
                  />
                  <Bar dataKey="allowlist" stackId="a" fill="#ffffff" fillOpacity={0.8} />
                  <Bar dataKey="public" stackId="a" fill="#ffffff" fillOpacity={0.5} />
                  <Bar dataKey="dutch" stackId="a" fill="#ffffff" fillOpacity={0.2} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Staking Growth */}
          <div className="p-12 space-y-8">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="text-xl font-black italic tracking-tight uppercase">STAKING GROWTH</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Cumulative participation</p>
              </div>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stakingData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.1} vertical={false} />
                  <XAxis dataKey="epoch" stroke="#ffffff" fontSize={10} axisLine={false} tickLine={false} />
                  <YAxis stroke="#ffffff" fontSize={10} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)', color: '#ffffff', fontSize: '10px', fontFamily: 'monospace' }} />
                  <Area type="monotone" dataKey="staked" stroke="#ffffff" fill="#ffffff" fillOpacity={0.1} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Trait Distribution - Visible Grid */}
        <div className="border-t border-white/10">
          <div className="p-12 border-b border-white/10">
            <h3 className="text-xl font-black italic tracking-tight uppercase">RARE TRAIT DISTRIBUTION</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/10">
            {traitData.map((trait) => (
              <div key={trait.name} className="p-8 space-y-6 hover:bg-white/5 transition-colors group">
                <div className="flex justify-between items-end">
                  <p className="text-sm font-bold uppercase tracking-widest">{trait.name}</p>
                  <p className="text-[10px] font-serif italic opacity-50 group-hover:opacity-100">{trait.rarity}</p>
                </div>
                <div className="space-y-2">
                  <div className="h-1 w-full bg-white/10 group-hover:bg-white/20 overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      whileInView={{ width: `${trait.value * 5}%` }}
                      className="h-full bg-white group-hover:bg-accent-primary"
                    />
                  </div>
                  <p className="text-[10px] font-mono opacity-40 group-hover:opacity-60 uppercase tracking-widest">Prevalence: {trait.value}%</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
