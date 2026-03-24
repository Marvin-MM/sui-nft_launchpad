import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Disc as Discord, Github, Globe, Shield, Terminal, ArrowUpRight } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative z-10 border-t border-white/10 bg-black pt-32 pb-12 overflow-hidden">
      <div className="max-w-[1600px] mx-auto border-x border-white/10">
        <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-white/10">
          
          {/* Brand Column */}
          <div className="col-span-1 md:col-span-2 p-12 space-y-12">
            <div className="space-y-6">
              <Link to="/" className="flex items-center gap-4 group">
                <div className="w-10 h-10 rounded-full border border-white/20 flex items-center justify-center text-white/40 group-hover:border-white transition-all">
                  <Terminal className="w-4 h-4" />
                </div>
                <span className="text-2xl font-light tracking-[-0.05em] text-white uppercase">SUI GENESIS</span>
              </Link>
              <p className="text-white/40 text-lg font-light max-w-md leading-relaxed">
                The premier digital asset protocol on Sui. 
                Experience institutional-grade infrastructure for on-chain rarity.
              </p>
            </div>
            
            <div className="flex gap-8">
              {[
                { Icon: Twitter, label: 'TWITTER' },
                { Icon: Discord, label: 'DISCORD' },
                { Icon: Github, label: 'GITHUB' }
              ].map((social) => (
                <a 
                  key={social.label}
                  href="#" 
                  className="flex items-center gap-2 text-[10px] font-medium tracking-[0.2em] text-white/40 hover:text-white transition-colors uppercase"
                >
                  <social.Icon className="w-4 h-4" />
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          <div className="p-12 space-y-8">
            <h4 className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">ECOSYSTEM</h4>
            <ul className="space-y-6">
              {['LAUNCHPAD', 'MARKETPLACE', 'STAKING', 'ANALYTICS'].map((link) => (
                <li key={link}>
                  <a href="#" className="group flex items-center justify-between text-white/40 hover:text-white transition-colors text-xs font-light tracking-widest">
                    {link}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="p-12 space-y-8">
            <h4 className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">RESOURCES</h4>
            <ul className="space-y-6">
              {['DOCUMENTATION', 'DEVELOPER API', 'WHITEPAPER', 'BRAND KIT'].map((link) => (
                <li key={link}>
                  <a href="#" className="group flex items-center justify-between text-white/40 hover:text-white transition-colors text-xs font-light tracking-widest">
                    {link}
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-12 p-12 border-t border-white/10 bg-white/1">
          <div className="flex flex-wrap items-center gap-12 text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">
            <span>© {currentYear} GENESIS LABS</span>
            <a href="#" className="hover:text-white transition-all underline underline-offset-8 decoration-white/5 hover:decoration-white/20">PRIVACY</a>
            <a href="#" className="hover:text-white transition-all underline underline-offset-8 decoration-white/5 hover:decoration-white/20">TERMS</a>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 pr-8 border-r border-white/10">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-medium tracking-[0.2em] text-white/40 uppercase">MAINNET v1.0.4</span>
            </div>
            <div className="flex items-center gap-3">
              <Globe className="w-4 h-4 text-white/20" />
              <span className="text-[10px] font-medium tracking-[0.2em] text-white/40 uppercase">UPTIME 100%</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

