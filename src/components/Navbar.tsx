import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, ShoppingBag, BarChart3, Settings, Wallet, Coins, Repeat, Menu, X, Terminal, Activity } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
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
  const { mutate: disconnect } = useDisconnectWallet();
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
        "fixed top-0 left-0 right-0 z-50 h-16 md:h-20 border-b transition-all duration-700",
        scrolled ? "bg-black border-white/10" : "bg-transparent border-white/5"
      )}>
        <div className="max-w-[1600px] mx-auto px-6 md:px-12 h-full flex items-center justify-between">
          <Link to="/" className="flex items-center gap-4 md:gap-6 group">
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
            
            {account ? (
              <button 
                onClick={() => disconnect()}
                title="Disconnect Wallet"
                className="group px-4 md:px-8 py-2 md:py-3 text-[9px] md:text-[10px] font-medium uppercase tracking-[0.2em] md:tracking-[0.4em] transition-all duration-500 border rounded-full border-white/10 text-white/40 hover:text-red-500 hover:border-red-500 hover:bg-red-500/10 min-w-[100px] sm:min-w-[140px] flex items-center justify-center"
              >
                <div className="group-hover:hidden flex items-center lg:gap-2">
                  <Wallet className="w-3 h-3 inline mr-2" />
                  <span className="hidden sm:inline">{account.address.slice(0, 6)}...{account.address.slice(-4)}</span>
                  <span className="sm:hidden">{account.address.slice(0, 5)}...{account.address.slice(-3)}</span>
                </div>
                <div className="hidden group-hover:flex items-center lg:gap-2">
                  <span>DISCONNECT</span>
                </div>
              </button>
            ) : (
              <ConnectModal
                trigger={
                  <button className="px-4 md:px-8 py-2 md:py-3 text-[9px] md:text-[10px] font-medium uppercase tracking-[0.2em] md:tracking-[0.4em] transition-all duration-500 border rounded-full bg-white text-black border-white hover:bg-black hover:text-white">
                    <Wallet className="w-4 h-4 inline mr-2" />
                    <span className="hidden sm:inline">CONNECT_WALLET</span>
                    <span className="sm:hidden">CONNECT</span>
                  </button>
                }
              />
            )}
            
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
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="fixed inset-0 z-40 bg-black/95 backdrop-blur-md pt-24 pb-8 px-6 lg:hidden flex flex-col overflow-y-auto border-b border-white/10"
          >
             <div className="flex items-center gap-3 text-emerald-500 mb-8 border-b border-white/10 pb-4">
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-medium tracking-[0.4em] uppercase">SYSTEM_MENU_ACTIVE</span>
             </div>

            <div className="flex flex-col gap-4">
              {navItems.map((item, idx) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "group flex items-center justify-between p-5 border transition-all duration-300",
                      isActive 
                        ? "border-emerald-500/50 bg-emerald-500/5 text-white" 
                        : "border-white/5 text-white/40 hover:text-white hover:border-white/20 hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-6">
                      <span className="text-[10px] font-mono opacity-40">0{idx + 1}</span>
                      <span className="text-xl md:text-2xl font-light uppercase tracking-widest">{item.name}</span>
                    </div>
                    <Icon className={cn("w-5 h-5", isActive ? "text-emerald-500" : "opacity-0 group-hover:opacity-100 transition-opacity")} />
                  </Link>
                );
              })}
            </div>

            <div className="mt-auto pt-12">
               <div className="flex items-center justify-between border-t border-white/10 pt-6">
                 <span className="text-[9px] font-medium tracking-[0.4em] uppercase text-white/20">NETWORK_SYNC</span>
                 <span className="text-[9px] font-medium tracking-[0.4em] uppercase text-emerald-500 animate-pulse">OPTIMAL</span>
               </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

