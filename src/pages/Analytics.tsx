import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import {
  MINT_CONFIG_ID,
  PACKAGE_ID,
  STAKING_POOL_ID,
  REWARD_VAULT_ID,
  MARKETPLACE_CONFIG_ID,
  RENTAL_POLICY_ID,
} from '../lib/sui';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';
import { Brain, Loader2, Sparkles } from 'lucide-react';
import { aiService } from '../services/aiService';

// Suppress unused-import warnings for IDs that are imported per spec
// but not yet wired to their own queries in this component.
void MARKETPLACE_CONFIG_ID;
void RENTAL_POLICY_ID;

export default function Analytics() {
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // ── MintConfig ─────────────────────────────────────────────────────────────
  const { data: mintConfig, isLoading: loadingConfig } = useSuiClientQuery(
    'getObject',
    { id: MINT_CONFIG_ID, options: { showContent: true } },
  );

  // ── Mint events (for distribution chart) ──────────────────────────────────
  const { data: eventData, isLoading: loadingEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveModule: { package: PACKAGE_ID, module: 'mint' } },
      limit: 50,
      order: 'descending',
    },
  );

  // ── StakingPool — total_staked & reward_rate ───────────────────────────────
  const { data: stakingPool } = useSuiClientQuery(
    'getObject',
    { id: STAKING_POOL_ID, options: { showContent: true } },
    { enabled: !!STAKING_POOL_ID },
  );

  // ── RewardVault — total SGR minted ─────────────────────────────────────────
  const { data: rewardVault } = useSuiClientQuery(
    'getObject',
    { id: REWARD_VAULT_ID, options: { showContent: true } },
    { enabled: !!REWARD_VAULT_ID },
  );

  // ── NFTStaked events — staking history chart ───────────────────────────────
  const { data: stakingEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::NFTStaked` },
      limit: 50,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID },
  );

  // ── NFTPurchased events — marketplace volume ───────────────────────────────
  const { data: purchaseEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::NFTPurchased` },
      limit: 50,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID },
  );

  // ── NFTRented events — rental activity ────────────────────────────────────
  const { data: rentalEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::NFTRented` },
      limit: 50,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID },
  );

  // ── TraitAdded events — trait distribution ────────────────────────────────
  const { data: traitEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::TraitAdded` },
      limit: 100,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID },
  );

  // ── RewardsClaimed events ─────────────────────────────────────────────────
  const { data: rewardsEvents } = useSuiClientQuery(
    'queryEvents',
    {
      query: { MoveEventType: `${PACKAGE_ID}::events::RewardsClaimed` },
      limit: 50,
      order: 'descending',
    },
    { enabled: !!PACKAGE_ID },
  );

  // ── Combined loading indicator ────────────────────────────────────────────
  const isLoading = loadingConfig || loadingEvents;

  // ── Stats derivation ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    // Minted count from MintConfig
    const content = mintConfig?.data?.content as any;
    const minted  = Number(content?.fields?.minted_count ?? 0);
    const total   = Number(content?.fields?.max_supply   ?? 10000); // FIX: was total_supply

    // Staked count from StakingPool (NOT from a .staked field on NFTs)
    const poolFields  = (stakingPool?.data?.content as any)?.fields ?? {};
    const totalStaked = Number(poolFields.total_staked ?? 0);
    const rewardRate  = (() => {
      const rf = poolFields.reward_rate_per_epoch;
      return typeof rf === 'object'
        ? Number(rf?.fields?.current_value ?? 0)
        : Number(rf ?? 0);
    })();

    // SGR minted from RewardVault
    const vaultFields = (rewardVault?.data?.content as any)?.fields ?? {};
    const sgrMinted   = Number(vaultFields.total_minted ?? 0) / 1e9;

    // Marketplace volume from NFTPurchased events
    const marketVol = (purchaseEvents?.data ?? []).reduce((sum: number, e: any) => {
      return sum + Number(e.parsedJson?.price_mist ?? 0);
    }, 0) / 1e9;

    // Rental activity count
    const rentalCount = rentalEvents?.data?.length ?? 0;

    // Total rewards claimed
    const totalClaimed = (rewardsEvents?.data ?? []).reduce((sum: number, e: any) => {
      return sum + Number(e.parsedJson?.amount_claimed ?? 0);
    }, 0) / 1e9;

    return {
      minted,
      total,
      staked: totalStaked,
      rewardRate,
      sgrMinted,
      marketVol,
      rentalCount,
      totalClaimed,
    };
  }, [mintConfig, stakingPool, rewardVault, purchaseEvents, rentalEvents, rewardsEvents]);

  // ── Mint distribution chart ───────────────────────────────────────────────
  const mintData = useMemo(() => {
    if (!eventData?.data) return [];
    const grouped: Record<string, { epoch: string; minted: number }> = {};
    eventData.data.forEach((e: any) => {
      const date = new Date(Number(e.timestampMs)).toLocaleDateString(
        undefined,
        { month: 'short', day: 'numeric' },
      );
      if (!grouped[date]) grouped[date] = { epoch: date, minted: 0 };
      grouped[date].minted += 1;
    });
    return Object.values(grouped).reverse();
  }, [eventData]);

  // ── Staking TVL chart — built from NFTStaked events (FIX) ────────────────
  const stakingData = useMemo(() => {
    if (!stakingEvents?.data || stakingEvents.data.length === 0) return [];

    const grouped: Record<string, number> = {};
    stakingEvents.data.forEach((e: any) => {
      const date = new Date(Number(e.timestampMs ?? 0)).toLocaleDateString(
        undefined,
        { month: 'short', day: 'numeric' },
      );
      grouped[date] = (grouped[date] ?? 0) + 1;
    });

    let cumulative = 0;
    return Object.entries(grouped)
      .reverse()
      .map(([date, count]) => {
        cumulative += count;
        return { epoch: date, staked: cumulative };
      });
  }, [stakingEvents]);

  // ── Marketplace volume chart ──────────────────────────────────────────────
  const marketData = useMemo(() => {
    if (!purchaseEvents?.data) return [];
    const grouped: Record<string, { date: string; volume: number; count: number }> = {};
    purchaseEvents.data.forEach((e: any) => {
      const date = new Date(Number(e.timestampMs ?? 0)).toLocaleDateString(
        undefined,
        { month: 'short', day: 'numeric' },
      );
      if (!grouped[date]) grouped[date] = { date, volume: 0, count: 0 };
      grouped[date].volume += Number(e.parsedJson?.price_mist ?? 0) / 1e9;
      grouped[date].count  += 1;
    });
    return Object.values(grouped).reverse();
  }, [purchaseEvents]);

  // ── Trait distribution — from TraitAdded events, static fallback (FIX) ───
  const traitData = useMemo(() => {
    if (!traitEvents?.data || traitEvents.data.length === 0) {
      return [
        { name: 'Background', value: 32, rarity: 'Common' },
        { name: 'Body',       value: 14, rarity: 'Rare' },
        { name: 'Eyes',       value: 8,  rarity: 'Rare' },
        { name: 'Head',       value: 5,  rarity: 'Epic' },
        { name: 'Aura',       value: 2,  rarity: 'Legendary' },
      ];
    }

    const traitCounts: Record<string, number> = {};
    traitEvents.data.forEach((e: any) => {
      const key = e.parsedJson?.trait_key ?? 'unknown';
      traitCounts[key] = (traitCounts[key] ?? 0) + 1;
    });

    const total = Object.values(traitCounts).reduce((a, b) => a + b, 0);
    return Object.entries(traitCounts)
      .map(([name, count]) => ({
        name,
        value: total > 0 ? Math.round((count / total) * 100) : 0,
        rarity:
          count <= 2  ? 'Mythic'   :
          count <= 10 ? 'Rare'     :
          count <= 30 ? 'Common'   : 'Abundant',
      }))
      .sort((a, b) => a.value - b.value) // rarest first
      .slice(0, 8);
  }, [traitEvents]);

  // ── AI summary ────────────────────────────────────────────────────────────
  const getAiSummary = async () => {
    setLoadingAI(true);
    try {
      const res = await aiService.getCollectionSummary({
        minted:  stats.minted,
        staked:  stats.staked,
        floor:   0,
        volume:  stats.marketVol,
      });
      setAiSummary(res.summary);
    } catch (error) {
      console.error(error);
      setAiSummary(
        `${stats.minted.toLocaleString()} Genesis assets minted ` +
        `(${stats.total > 0 ? ((stats.minted / stats.total) * 100).toFixed(1) : '0.0'}% of supply). ` +
        `${stats.staked.toLocaleString()} staked. ` +
        `${stats.sgrMinted.toFixed(2)} SGR distributed. ` +
        `${stats.marketVol.toFixed(2)} SUI marketplace volume.`,
      );
    } finally {
      setLoadingAI(false);
    }
  };

  // ── Network / contract phase ──────────────────────────────────────────────
  const mintFields      = (mintConfig?.data?.content as any)?.fields;
  const contractPhase   = Number(mintFields?.current_phase ?? 2);
  const pausedField     = mintFields?.paused;
  const isProtocolPaused =
    typeof pausedField === 'object'
      ? Boolean(pausedField?.fields?.current_value)
      : Boolean(pausedField);

  const statusLabel =
    isProtocolPaused       ? 'PROTOCOL_PAUSED' :
    contractPhase === 1    ? 'ALLOWLIST_PHASE'  :
    contractPhase === 2    ? 'PUBLIC_PHASE'      : 'PAUSED';

  // ── Stat cards ────────────────────────────────────────────────────────────
  const statCards = [
    {
      label:  'TOTAL_MINTED',
      value:  stats.minted.toLocaleString(),
      suffix: `/ ${stats.total.toLocaleString()}`,
    },
    {
      label:  'TOTAL_STAKED',
      value:  stats.staked.toLocaleString(),
      suffix: 'IN VAULT',
    },
    {
      label:  'SGR_MINTED',
      value:  stats.sgrMinted.toFixed(2),
      suffix: 'SGR TOKENS',
    },
    {
      label:  'REWARD_RATE',
      value:  stats.rewardRate.toLocaleString(),
      suffix: 'SGR / EPOCH',
    },
    {
      label:  'MARKET_VOLUME',
      value:  stats.marketVol.toFixed(2),
      suffix: 'SUI VOL',
    },
    {
      label:  'ACTIVE_RENTALS',
      value:  stats.rentalCount.toLocaleString(),
      suffix: 'RENTALS',
    },
    {
      label:  'REWARDS_PAID',
      value:  stats.totalClaimed.toFixed(2),
      suffix: 'SGR CLAIMED',
    },
    {
      label:  'MINT_PROGRESS',
      value:  stats.total > 0
        ? ((stats.minted / stats.total) * 100).toFixed(1)
        : '0.0',
      suffix: '% COMPLETE',
    },
  ];

  // ── Shared chart styles ───────────────────────────────────────────────────
  const tooltipStyle = {
    background:    '#000000',
    border:        '1px solid rgba(255,255,255,0.2)',
    color:         '#ffffff',
    fontSize:      '10px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.2em',
  };

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/10">
      <div className="max-w-[1600px] mx-auto border-x border-white/10 min-h-screen">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="p-6 md:p-12 border-b border-white/10 space-y-8 bg-white/1">
          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-8 md:gap-12">
            <div className="space-y-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/20">
                SUI_GENESIS_NETWORK
              </p>
              <h1 className="text-6xl sm:text-[80px] md:text-[110px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                ANALYTICS<br />
                <span className="text-white/20">TERMINAL</span>
              </h1>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 md:gap-12 w-full md:w-auto">
              {/* Dynamic contract status */}
              <div className="space-y-4 w-full sm:w-auto">
                <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/20">
                  SYS_STATUS
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 ${
                      isProtocolPaused
                        ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'
                        : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                    }`}
                  />
                  <p
                    className={`text-lg md:text-xl font-light uppercase tracking-widest ${
                      isProtocolPaused ? 'text-red-500' : 'text-emerald-500'
                    }`}
                  >
                    {statusLabel}
                  </p>
                </div>
              </div>

              <button
                onClick={getAiSummary}
                disabled={loadingAI}
                className="w-full sm:w-auto px-8 py-4 border border-white text-[10px] font-medium uppercase tracking-[0.4em] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-3"
              >
                {loadingAI
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Brain className="w-4 h-4" />}
                {aiSummary ? 'REFRESH_AI' : 'GENERATE_AI'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Stats Grid (8 cards, 2 rows of 4) ──────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 divide-x divide-white/10 border-b border-white/10">
          {statCards.map((stat) => (
            <div
              key={stat.label}
              className="p-6 md:p-8 space-y-4 hover:bg-white/1 transition-colors group border-b border-white/10 lg:border-b-0"
            >
              <p className="text-[9px] font-medium uppercase tracking-[0.3em] text-white/20 group-hover:text-white/40">
                {stat.label}
              </p>
              <div className="space-y-1">
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-white/20" />
                ) : (
                  <>
                    <h2 className="text-2xl md:text-3xl font-light tracking-tighter leading-none">
                      {stat.value}
                    </h2>
                    <p className="text-[9px] font-medium text-white/40 uppercase tracking-[0.3em]">
                      {stat.suffix}
                    </p>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* ── AI Summary Card ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {aiSummary && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-white/10 bg-white/5 text-white overflow-hidden"
            >
              <div className="p-8 md:p-12 space-y-6">
                <div className="flex items-center gap-3 text-emerald-500">
                  <Sparkles className="w-4 h-4" />
                  <h3 className="text-[10px] font-medium uppercase tracking-[0.4em]">
                    AI_SYNTHESIS
                  </h3>
                </div>
                <p className="text-xl md:text-2xl font-light tracking-wide leading-relaxed uppercase">
                  "{aiSummary}"
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Charts Row 1: Mint Distribution (60%) + Staking TVL (40%) ──── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 divide-x divide-white/10">

          {/* Mint Distribution */}
          <div className="lg:col-span-3 p-8 md:p-12 space-y-12 border-b border-white/10">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/20">
                NETWORK_METRIC
              </p>
              <h3 className="text-3xl font-light tracking-tighter uppercase">DISTRIBUTION</h3>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mintData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff"
                    opacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="epoch"
                    stroke="#ffffff"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    stroke="#ffffff"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    cursor={{ fill: '#ffffff', opacity: 0.05 }}
                  />
                  <Bar dataKey="minted" fill="#ffffff" fillOpacity={1} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Staking TVL */}
          <div className="lg:col-span-2 p-8 md:p-12 space-y-12 border-b border-white/10">
            <div className="space-y-2">
              <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/20">
                PROTOCOL_ADOPTION
              </p>
              <h3 className="text-3xl font-light tracking-tighter uppercase">STAKING_TVL</h3>
            </div>
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stakingData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#ffffff"
                    opacity={0.1}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="epoch"
                    stroke="#ffffff"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    stroke="#ffffff"
                    fontSize={10}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area
                    type="monotone"
                    dataKey="staked"
                    stroke="#ffffff"
                    fill="#ffffff"
                    fillOpacity={0.1}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── Charts Row 2: Marketplace Volume (full width) ───────────────── */}
        <div className="p-8 md:p-12 space-y-12 border-b border-white/10">
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/20">
              MARKETPLACE_METRIC
            </p>
            <h3 className="text-3xl font-light tracking-tighter uppercase">MARKET_VOLUME</h3>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={marketData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#ffffff"
                  opacity={0.1}
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  stroke="#ffffff"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                />
                <YAxis
                  stroke="#ffffff"
                  fontSize={10}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: '#ffffff', opacity: 0.05 }}
                />
                <Bar dataKey="volume" fill="#ffffff" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Trait Distribution ──────────────────────────────────────────── */}
        <div className="border-t border-white/10">
          <div className="p-8 md:p-12 border-b border-white/10">
            <h3 className="text-3xl font-light tracking-tighter uppercase">TRAIT_DISTRIBUTION</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-x divide-y md:divide-y-0 divide-white/10">
            {traitData.map((trait) => (
              <div
                key={trait.name}
                className="p-8 space-y-6 hover:bg-white/1 transition-colors group"
              >
                <div className="flex justify-between items-end">
                  <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-white/60 group-hover:text-white">
                    {trait.name}
                  </p>
                  <p className="text-[10px] font-medium uppercase tracking-[0.4em] text-emerald-500">
                    {trait.rarity}
                  </p>
                </div>
                <div className="space-y-4">
                  <div className="h-[2px] w-full bg-white/10 group-hover:bg-white/20 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${Math.min(trait.value * 5, 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                      className="h-full bg-white"
                    />
                  </div>
                  <p className="text-[10px] font-medium text-white/40 uppercase tracking-[0.4em]">
                    PREVALENCE: {trait.value}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
