import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import ThreeDCarousel from '../components/ThreeDCarousel';
import ParticleField from '../components/ParticleField';
import MintProgress from '../components/MintProgress';
import PhaseStatus from '../components/PhaseStatus';
import LiveActivityFeed from '../components/LiveActivityFeed';
import RarityGrid from '../components/RarityGrid';
import { ChevronDown, ArrowRight, Shield, Zap, Globe, Users, Cpu, Lock, Layers, Terminal, Activity, Disc as Discord, Twitter } from 'lucide-react';

export default function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative bg-black text-white"
    >
      <ParticleField />
      
      {/* Hero Section */}
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
              <Link to="/marketplace" className="text-[10px] font-medium tracking-[0.4em] text-white/40 hover:text-white uppercase transition-colors">
                EXPLORE SECONDARY
              </Link>
            </motion.div>

            {/* Terminal Stats Bar */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="pt-12 border-t border-white/10"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 md:gap-12">
                {[
                  { label: 'FLOOR', value: '1.25 SUI' },
                  { label: 'OWNERS', value: '2,408' },
                  { label: 'VOLUME', value: '124K' },
                ].map((s) => (
                  <div key={s.label} className="space-y-1">
                    <p className="text-[10px] font-medium text-white/20 tracking-widest uppercase">{s.label}</p>
                    <p className="text-2xl font-light tracking-tighter">{s.value}</p>
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

      {/* Network Trust Bar */}
      <section className="py-12 md:py-16 border-b border-white/10 overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 flex flex-wrap justify-between items-center gap-8 md:gap-12 opacity-30 hover:opacity-100 transition-opacity duration-700">
          {['SUI NETWORK', 'MYSTEN LABS', 'MOVE LANG', 'GENESIS DAO', 'CYBERSEC'].map((brand, i) => (
            <div key={brand} className="flex items-center gap-8 md:gap-12 w-full sm:w-auto justify-between sm:justify-start">
              <span className="text-xs md:text-sm font-medium tracking-[0.4em] text-white uppercase whitespace-nowrap">{brand}</span>
              {i < 4 && <div className="hidden sm:block w-px h-4 bg-white/20" />}
            </div>
          ))}
        </div>
      </section>

      {/* Live Activity Section */}
      <section className="border-b border-white/10 bg-black">
        <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-white/10 border-x border-white/10">
          <div className="lg:col-span-6 p-6 md:p-12 lg:p-24 space-y-16 md:space-y-24">
            <div className="space-y-6 md:space-y-8">
              <div className="flex items-center gap-4 text-emerald-500">
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-medium tracking-[0.4em] uppercase">LIVE NETWORK ACTIVITY</span>
              </div>
              <h2 className="text-6xl md:text-[100px] font-light tracking-[-0.05em] uppercase leading-[0.85]">LAUNCH<br /><span className="text-white/20">DISTRIBUTION</span></h2>
            </div>
            <PhaseStatus />
          </div>
          <div className="lg:col-span-6 p-6 md:p-12 lg:p-24 bg-white/1 flex flex-col justify-between space-y-16">
            <MintProgress />
            <LiveActivityFeed />
          </div>
        </div>
      </section>

      {/* Rarity Grid Section */}
      <section className="border-b border-white/10 overflow-hidden bg-black">
        <div className="max-w-[1600px] mx-auto border-x border-white/10">
          <div className="p-6 md:p-12 lg:p-24 border-b border-white/10 flex flex-col lg:flex-row lg:items-end justify-between gap-12 lg:gap-24">
            <div className="space-y-6 md:space-y-8">
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">ENGINE v1.4.0</p>
              <h2 className="text-6xl md:text-[100px] font-light tracking-[-0.05em] uppercase leading-[0.85]">TRAIT<br /><span className="text-white/20">HIERARCHY</span></h2>
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

      {/* Technology Section */}
      <section className="border-b border-white/10 bg-black">
        <div className="max-w-[1600px] mx-auto border-x border-white/10">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-white/10">
            {[
              { 
                icon: Shield, 
                title: 'KIOSK SECURITY', 
                desc: 'Native royalty enforcement and asset security at the protocol level.'
              },
              { 
                icon: Cpu, 
                title: 'MOVE ARCHITECTURE', 
                desc: 'Resource-oriented programming for memory-safe digital assets.'
              },
              { 
                icon: Layers, 
                title: 'EVOLVING METADATA', 
                desc: 'Dynamic state updates allowing assets to evolve over time.'
              },
            ].map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="p-12 md:p-16 lg:p-24 space-y-8 hover:bg-white/2 transition-colors group"
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

      {/* Final CTA */}
      <section className="py-24 md:py-40 border-b border-white/10 relative overflow-hidden">
        <div className="max-w-[1600px] mx-auto px-6 relative z-10 text-center space-y-12">
          <div className="space-y-6">
            <h2 className="text-5xl sm:text-7xl md:text-[140px] font-thin tracking-[-0.06em] leading-none uppercase">
              JOIN THE<br />
              <span className="text-white/20">NETWORK</span>
            </h2>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-12 justify-center">
            <Link to="/mint" className="px-10 md:px-20 py-5 md:py-6 rounded-full bg-white text-black font-medium tracking-widest uppercase hover:bg-black hover:text-white border border-white transition-all duration-500">
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
