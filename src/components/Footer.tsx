import React from 'react';
import { Link } from 'react-router-dom';
import { Twitter, Disc as Discord, Github, Globe, Terminal } from 'lucide-react';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/10 bg-black py-8 md:py-12 mt-auto">
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-8 md:gap-12">
        
        {/* Brand */}
        <Link to="/" className="flex items-center gap-4 group">
          <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-white/40 group-hover:border-white transition-all">
            <Terminal className="w-3 h-3" />
          </div>
          <span className="text-xl font-light tracking-[-0.05em] text-white uppercase">SUI GENESIS</span>
        </Link>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 md:gap-8 text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">
          <Link to="/marketplace" className="hover:text-white transition-colors">MARKET</Link>
          <Link to="/collection" className="hover:text-white transition-colors">VAULT</Link>
          <a href="#" className="hover:text-white transition-colors">DOCS</a>
        </div>

        {/* Socials & Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center gap-6">
            <a href="#" className="text-white/40 hover:text-white transition-colors"><Twitter className="w-4 h-4" /></a>
            <a href="#" className="text-white/40 hover:text-white transition-colors"><Discord className="w-4 h-4" /></a>
            <a href="#" className="text-white/40 hover:text-white transition-colors"><Github className="w-4 h-4" /></a>
          </div>
          <div className="hidden sm:block w-px h-4 bg-white/20" />
          <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] text-white/20 uppercase">
            <Globe className="w-3 h-3" />
            <span>© {currentYear} GENESIS LABS</span>
          </div>
        </div>
        
      </div>
    </footer>
  );
}

