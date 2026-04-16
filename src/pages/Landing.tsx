import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSuiClientQuery } from '@mysten/dapp-kit';
import ThreeDCarousel from '../components/ThreeDCarousel';
import ParticleField from '../components/ParticleField';
import MintProgress from '../components/MintProgress';
import PhaseStatus from '../components/PhaseStatus';
import LiveActivityFeed from '../components/LiveActivityFeed';
import RarityGrid from '../components/RarityGrid';
import { MINT_CONFIG_ID, STAKING_POOL_ID, REWARD_VAULT_ID, PACKAGE_ID } from '../lib/sui';
import {
  ChevronDown, ArrowRight, Shield, Zap, Globe, Users, Cpu, Lock, Layers, Coins,
  Terminal, Activity, Disc as Discord, Twitter,
} from 'lucide-react';

export default function Landing() {
  // ── Live chain stats ────────────────────────────────────────────────────
  const { data: mintConfig } = useSuiClientQuery(
    'getObject',
    { id: MINT_CONFIG_ID, options: { showContent: true } },
    { refetchInterval: 30000, enabled: !!MINT_CONFIG_ID }
  );
  const { data: stakingPool } = useSuiClientQuery(
    'getObject',
    { id: STAKING_POOL_ID, options: { showContent: true } },
    { enabled: !!STAKING_POOL_ID }
  );
  const { data: rewardVault } = useSuiClientQuery(
    'getObject',
    { id: REWARD_VAULT_ID, options: { showContent: true } },
    { enabled: !!REWARD_VAULT_ID }
  );

  const configFields  = (mintConfig?.data?.content as any)?.fields || {};
  const mintFeeField  = configFields.mint_fee;
  const currentFee    = (typeof mintFeeField === 'object' && mintFeeField?.fields?.current_value)
    ? Number(mintFeeField.fields.current_value) / 1e9
    : 0;
  const mintedCount   = Number(configFields.minted_count || 0);
  const maxSupply     = Number(configFields.max_supply   || 10000);
  const remaining     = maxSupply - mintedCount;

  const stakingFields = (stakingPool?.data?.content as any)?.fields || {};
  const totalStaked   = Number(stakingFields.total_staked || 0);

  const vaultFields   = (rewardVault?.data?.content as any)?.fields || {};
  const sgrMinted     = Number(vaultFields.total_minted || 0) / 1e9;

  // Suppress unused-var warning while keeping the query result accessible
  void sgrMinted;
  void PACKAGE_ID;

  // ── Technology features ─────────────────────────────────────────────────
  const features = [
    {
      icon: Shield,
      title: 'KIOSK ENFORCEMENT',
      desc: 'Royalties enforced at the protocol level through the Sui Kiosk standard. No bypass possible.',
    },
    {
      icon: Lock,
      title: 'TIMELOCK GOVERNANCE',
      desc: 'All fee, pause, and royalty changes require a timelock delay + optional multi-signature approval.',
    },
    {
      icon: Cpu,
      title: 'COMMIT-REVEAL MINT',
      desc: 'Front-run-resistant minting using Sui on-chain randomness for verifiable, fair trait assignment.',
    },
    {
      icon: Coins,
      title: 'SGR STAKING REWARDS',
      desc: 'Stake Genesis NFTs to earn SGR reward tokens. Claim autonomously — no admin bottleneck.',
    },
    {
      icon: Layers,
      title: 'EVOLVING TRAITS',
      desc: 'Dynamic trait system with user-editable metadata, official admin traits, and lock mechanics.',
    },
    {
      icon: Globe,
      title: 'RENTAL MARKETPLACE',
      desc: 'Delegate NFT access via time-bounded rental contracts. Keep ownership, monetize usage.',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative bg-black text-white"
    >
      <ParticleField />

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col border-b border-white/10 pt-20 overflow-hidden">
        <div className="max-w-[1600px] mx-auto w-full px-6 grow flex flex-col lg:flex-row items-center gap-12 border-x border-white/10">

          {/* Hero Left Content */}
          <div className="flex-1 py-12 lg:py-24 space-y-12 text-left">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-4 text-accent-primary">
                <Terminal className="w-4 h-4" />
                <span className="text-[10px] font-medium tracking-[0.5em] uppercase">SUI GENESIS PROTOCOL v1.0.4</span>
              </div>
              <h1 className="text-6xl sm:text-[80px] md:text-[140px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                DIGITAL<br />
                <span className="text-white/20">PRESTIGE</span>
              </h1>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="text-xl md:text-2xl text-white/40 font-light leading-relaxed max-w-2xl"
            >
              Deploying advanced asset standards on Sui.
              Experience <span className="text-white">on-chain rarity</span> through the lens of a production-grade terminal.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center gap-8"
            >
              <Link to="/mint" className="group flex items-center gap-4">
                <div className="px-8 md:px-12 py-4 md:py-5 rounded-full bg-white text-black font-medium tracking-widest uppercase hover:bg-black hover:text-white border border-white transition-all duration-300">
                  MINT ACCESS
                </div>
                <div className="w-12 h-12 rounded-full border border-white/20 flex items-center justify-center group-hover:bg-white group-hover:text-black transition-all">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
              <Link
                to="/marketplace"
                className="text-[10px] font-medium tracking-[0.4em] text-white/40 hover:text-white uppercase transition-colors"
              >
                EXPLORE SECONDARY
              </Link>
            </motion.div>

            {/* Live mint fee indicator */}
            {currentFee > 0 && (
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/30 uppercase">
                Current Mint Fee: {currentFee.toFixed(4)} SUI
              </p>
            )}

            {/* Terminal Stats Bar — live chain data */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-12 border-t border-white/10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
                {[
                  {
                    label: 'MINTED',
                    value: mintedCount > 0 ? mintedCount.toLocaleString() : '—',
                    sub: `/ ${maxSupply.toLocaleString()}`,
                  },
                  {
                    label: 'REMAINING',
                    value: remaining > 0 ? remaining.toLocaleString() : '0',
                    sub: 'NFTs',
                  },
                  {
                    label: 'STAKED',
                    value: totalStaked > 0 ? totalStaked.toLocaleString() : '—',
                    sub: 'IN VAULT',
                  },
                ].map((s) => (
                  <div key={s.label} className="space-y-1">
                    <p className="text-[10px] font-medium text-white/20 tracking-widest uppercase">{s.label}</p>
                    <p className="text-2xl font-light tracking-tighter">{s.value}</p>
                    {s.sub && (
                      <p className="text-[9px] text-white/20 tracking-widest uppercase">{s.sub}</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Hero Right Content - Carousel */}
          <div className="flex-1 w-full relative min-h-[500px] lg:min-h-0">
            <ThreeDCarousel />
          </div>
        </div>
      </section>

      {/* ── Protocol Navigation Pills ─────────────────────────────────────── */}
      <section className="py-10 md:py-12 border-b border-white/10 bg-black">
        <div className="max-w-[1600px] mx-auto px-6 border-x border-white/10">
          <div className="flex flex-wrap gap-4 items-center justify-between py-6">
            <span className="text-[10px] font-medium text-white/20 tracking-[0.4em] uppercase hidden md:block">
              PROTOCOL MODULES
            </span>
            <div className="flex flex-wrap gap-3">
              {[
                { label: 'MINT',        href: '/mint',        desc: 'Standard · Dutch · Commit-Reveal' },
                { label: 'MARKETPLACE', href: '/marketplace', desc: 'Buy & Sell' },
                { label: 'RENTAL',      href: '/rental',      desc: 'Delegate Access' },
                { label: 'MY VAULT',    href: '/collection',  desc: 'Stake · Forge · Trade' },
                { label: 'ANALYTICS',   href: '/analytics',   desc: 'Live Stats' },
              ].map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="group flex flex-col px-5 py-3 border border-white/10 hover:border-white hover:bg-white transition-all duration-300"
                >
                  <span className="text-[10px] font-medium tracking-[0.3em] uppercase group-hover:text-black text-white">
                    {item.label}
                  </span>
                  <span className="text-[9px] text-white/30 group-hover:text-black/60 tracking-widest mt-0.5">
                    {item.desc}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Network Trust Bar ─────────────────────────────────────────────── */}
      <section className="py-12 md:py-16 border-b border-white/10 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 flex flex-wrap justify-between items-center gap-8 md:gap-12 opacity-30 hover:opacity-100 transition-opacity duration-700">
          {['SUI NETWORK', 'MYSTEN LABS', 'MOVE LANG', 'GENESIS DAO', 'CYBERSEC'].map((brand, i) => (
            <div
              key={brand}
              className="flex items-center gap-8 md:gap-12 w-full sm:w-auto justify-between sm:justify-start"
            >
              <span className="text-xs md:text-sm font-medium tracking-[0.4em] text-white uppercase whitespace-nowrap">
                {brand}
              </span>
              {i < 4 && <div className="hidden sm:block w-px h-4 bg-white/20" />}
            </div>
          ))}
        </div>
      </section>

      {/* ── Live Activity Section ─────────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-black">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10 border-x border-white/10">
          <div className="lg:col-span-6 p-6 md:p-12 lg:p-24 space-y-16 md:space-y-24">
            <div className="space-y-6 md:space-y-8">
              <div className="flex items-center gap-4 text-emerald-500">
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-medium tracking-[0.4em] uppercase">LIVE NETWORK ACTIVITY</span>
              </div>
              <h2 className="text-6xl md:text-[100px] font-light tracking-[-0.05em] uppercase leading-[0.85]">
                LAUNCH<br /><span className="text-white/20">DISTRIBUTION</span>
              </h2>
            </div>
            <PhaseStatus />
          </div>
          <div className="lg:col-span-6 p-6 md:p-12 lg:p-24 bg-white/1 flex flex-col justify-between space-y-16">
            <MintProgress />
            <LiveActivityFeed />
          </div>
        </div>
      </section>

      {/* ── Rarity Grid Section ───────────────────────────────────────────── */}
      <section className="border-b border-white/10 overflow-hidden bg-black">
        <div className="max-w-[1600px] mx-auto border-x border-white/10">
          <div className="p-6 md:p-12 lg:p-24 border-b border-white/10 flex flex-col lg:flex-row lg:items-end justify-between gap-12 lg:gap-24">
            <div className="space-y-6 md:space-y-8">
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">ENGINE v1.4.0</p>
              <h2 className="text-6xl md:text-[100px] font-light tracking-[-0.05em] uppercase leading-[0.85]">
                TRAIT<br /><span className="text-white/20">HIERARCHY</span>
              </h2>
            </div>
            <p className="text-white/40 max-w-sm text-lg md:text-xl font-light leading-relaxed">
              Every Sui Genesis asset is mathematically generated from 8 distinct trait categories. Explore the probability matrix.
            </p>
          </div>
          <div className="bg-white/1">
            <RarityGrid />
          </div>
        </div>
      </section>

      {/* ── Technology Section ────────────────────────────────────────────── */}
      <section className="border-b border-white/10 bg-black">
        <div className="max-w-[1600px] mx-auto border-x border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 border-l border-t border-white/10">
            {features.map((f) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="border-r border-b border-white/10 p-12 md:p-16 lg:p-24 space-y-8 hover:bg-white/2 transition-colors group"
              >
                <div className="w-16 h-16 border border-white/20 flex items-center justify-center text-white/40 group-hover:bg-white group-hover:text-black group-hover:border-white transition-all duration-500">
                  <f.icon className="w-6 h-6" />
                </div>
                <div className="space-y-6">
                  <h3 className="text-2xl font-light tracking-widest uppercase text-white">{f.title}</h3>
                  <p className="text-white/40 text-lg font-light leading-relaxed">{f.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────────── */}
      <section className="py-24 md:py-40 border-b border-white/10 relative overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-6 relative z-10 text-center space-y-12">
          <div className="space-y-6">
            <h2 className="text-5xl sm:text-7xl md:text-[140px] font-thin tracking-[-0.06em] leading-none uppercase">
              JOIN THE<br />
              <span className="text-white/20">NETWORK</span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-12 justify-center">
            <Link
              to="/mint"
              className="px-10 md:px-20 py-5 md:py-6 rounded-full bg-white text-black font-medium tracking-widest uppercase hover:bg-black hover:text-white border border-white transition-all duration-500"
            >
              MINT ACCESS TOKEN
            </Link>
            <div className="flex items-center gap-8">
              <a href="#" className="p-4 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white transition-all">
                <Discord className="w-6 h-6" />
              </a>
              <a href="#" className="p-4 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white transition-all">
                <Twitter className="w-6 h-6" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </motion.div>
  );
}
