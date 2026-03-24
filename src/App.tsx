import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { networkConfig, NETWORK } from './lib/sui';
import Landing from './pages/Landing';
import Mint from './pages/Mint';
import MyCollection from './pages/MyCollection';
import Marketplace from './pages/Marketplace';
import RentalMarketplace from './pages/RentalMarketplace';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import Navbar from './components/Navbar';
import LiveFeed from './components/LiveFeed';
import Footer from './components/Footer';

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={NETWORK}>
        <WalletProvider autoConnect>
          <BrowserRouter>
            <div className="min-h-screen bg-bg text-white selection:bg-accent-primary/30 flex flex-col">
              <Navbar />
              <main className="grow pt-20">
                <AnimatePresence mode="wait">
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/mint" element={<Mint />} />
                    <Route path="/collection" element={<MyCollection />} />
                    <Route path="/marketplace" element={<Marketplace />} />
                    <Route path="/rentals" element={<RentalMarketplace />} />
                    <Route path="/analytics" element={<Analytics />} />
                    <Route path="/admin" element={<Admin />} />
                  </Routes>
                </AnimatePresence>
              </main>
              <Footer />
              <LiveFeed />
              <Toaster 
                position="bottom-right"
                toastOptions={{
                  style: {
                    background: '#1a1a1a',
                    color: '#fff',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                  },
                }}
              />
            </div>
          </BrowserRouter>
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

