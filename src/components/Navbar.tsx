import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectModal, useCurrentAccount } from '@mysten/dapp-kit';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ShoppingBag, BarChart3, Settings, Wallet, Coins, Repeat, Menu, X, Terminal, Activity } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Index', path: '/', icon: LayoutDashboard },
  { name: 'Mint', path: '/mint', icon: Coins },
  { name: 'Vault', path: '/collection', icon: Wallet },
  { name: 'Market', path: '/marketplace', icon: ShoppingBag },
  { name: 'Rentals', path: '/rentals', icon: Repeat },
  { name: 'Stats', path: '/analytics', icon: BarChart3 },
  { name: 'Admin', path: '/admin', icon: Settings },
];

export default function Navbar() {
  const location = useLocation();
  const account = useCurrentAccount();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-50 h-24 border-b transition-all duration-700",
        scrolled ? "bg-black border-white/10" : "bg-transparent border-white/5"
      )}>
        <div className="max-w-[1600px] mx-auto px-12 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-6 group">
            <div className="w-10 h-10 border border-white/20 flex items-center justify-center group-hover:border-white transition-all duration-700">
               <span className="text-sm font-light tracking-tighter">S_G</span>
            </div>
            <div className="hidden lg:flex flex-col">
               <span className="text-[10px] font-medium tracking-[0.4em] uppercase text-white/20 group-hover:text-white transition-all duration-700">
                 PROTO_PROTOCOL <span className="text-white/40 ml-2">V1.0.4</span>
               </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-12">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-[0.4em] transition-all duration-500 py-2",
                    isActive 
                      ? "text-white" 
                      : "text-white/20 hover:text-white"
                  )}
                >
                  {item.name}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-8">
            <div className="hidden sm:flex items-center gap-4 text-emerald-500/40">
               <Activity className="w-3 h-3" />
               <span className="text-[9px] font-medium tracking-[0.4em] uppercase">MAINNET_SYNC</span>
            </div>
            
            <ConnectModal
              trigger={
                <button className={cn(
                  "px-8 py-3 text-[10px] font-medium uppercase tracking-[0.4em] transition-all duration-500 border",
                  account 
                    ? "border-white/10 text-white/40 hover:text-white hover:border-white" 
                    : "bg-white text-black border-white hover:bg-black hover:text-white"
                )}>
                  {account ? account.address.slice(0, 6) + '...' + account.address.slice(-4) : 'INIT_AUTH'}
                </button>
              }
            />
            
            <button 
              className="lg:hidden p-2 text-white/40 hover:text-white"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black pt-32 pb-6 px-12 lg:hidden flex flex-col overflow-y-auto"
          >
            <div className="flex flex-col gap-12">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "text-4xl font-light uppercase tracking-tighter transition-all",
                      isActive 
                        ? "text-white" 
                        : "text-white/20 hover:text-white"
                    )}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

