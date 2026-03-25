import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { networkConfig, NETWORK, MIST_PER_SUI, PACKAGE_ID, MINT_CONFIG_ID } from '../lib/sui';
import { 
  Settings, ShieldAlert, Users, Coins, Percent, 
  Pause, Play, Plus, Trash2, Loader2, Save, 
  ArrowRight, Info, AlertTriangle, Upload, BarChart3, Terminal, Activity, Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Admin() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('phases');
  const [feeInputs, setFeeInputs] = useState({ allowlist: '0', public: '0' });
  const [royaltyInput, setRoyaltyInput] = useState('0');

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDangerous?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const { data: adminCapData, isLoading: checkingAdmin } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address || '',
      filter: { StructType: `${PACKAGE_ID}::mint::AdminCap` },
    },
    { enabled: !!account }
  );

  const isAdmin = adminCapData?.data && adminCapData.data.length > 0;

  const { data: mintConfig } = useSuiClientQuery(
    'getObject',
    {
      id: MINT_CONFIG_ID,
      options: { showContent: true },
    }
  );

  const currentPhase = mintConfig?.data?.content?.dataType === 'moveObject' 
    ? (mintConfig.data.content.fields as any).current_phase || 0 
    : 0;

  // Sync chain data to inputs once loaded
  useMemo(() => {
    if (mintConfig?.data?.content?.dataType === 'moveObject') {
       const f = mintConfig.data.content.fields as any;
       setFeeInputs({
         allowlist: (Number(f.allowlist_price_mist) / Number(MIST_PER_SUI)).toString(),
         public: (Number(f.mint_fee) / Number(MIST_PER_SUI)).toString()
       });
       setRoyaltyInput(f.royalty_bps?.toString() || '0');
    }
  }, [mintConfig]);

  const treasuryBalance = useMemo(() => {
    if (mintConfig?.data?.content?.dataType !== 'moveObject') return '0.00';
    const balanceMist = (mintConfig.data.content.fields as any).balance || 0;
    return (Number(balanceMist) / Number(MIST_PER_SUI)).toFixed(2);
  }, [mintConfig]);

  const handleAction = async (action: string, params: any = {}) => {
    if (!account) return;
    setLoading(true);
    try {
      const tx = new Transaction();
      const adminCapId = adminCapData?.data?.[0]?.data?.objectId;
      
      if (!adminCapId) {
        throw new Error("Missing AdminCap");
      }

      if (action === 'Withdraw') {
        tx.moveCall({
          target: `${PACKAGE_ID}::mint::withdraw_treasury`,
          arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID)]
        });
      } else if (action === 'Update Phase') {
        tx.moveCall({
          target: `${PACKAGE_ID}::mint::set_phase`,
          arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u8(params.phase)]
        });
      } else if (action === 'Update Fees') {
        tx.moveCall({
          target: `${PACKAGE_ID}::mint::set_allowlist_price`,
          arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u64(Number(feeInputs.allowlist) * Number(MIST_PER_SUI))]
        });
        tx.moveCall({
          target: `${PACKAGE_ID}::mint::set_mint_fee`,
          arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u64(Number(feeInputs.public) * Number(MIST_PER_SUI))]
        });
      } else if (action === 'Halt Protocol') {
        tx.moveCall({
          target: `${PACKAGE_ID}::mint::set_paused`,
          arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.bool(true)]
        });
      } else {
        toast.error(`Action ${action} requires specialized capability objects not in config.`);
        setLoading(false);
        setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        return;
      }

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`${action} confirmed on-chain.`);
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          },
          onError: (e) => toast.error(`Transaction failed: ${e.message}`)
        }
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Protocol action failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/20" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center space-y-12">
        <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center text-white/20">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-light tracking-tighter uppercase">AUTH_REVOKED</h2>
          <p className="text-white/40 font-light leading-relaxed">
            Administrative access denied. Sign-in with an authorized principal wallet containing the <span className="text-white">AdminCap</span> metadata.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen border-x border-white/10 grid grid-cols-1 lg:grid-cols-12 bg-black">
      {/* Sidebar Nav */}
      <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/10 p-6 md:p-12 lg:p-16 space-y-12 md:space-y-24 bg-white/1">
        <div className="space-y-12">
          <div className="flex items-center gap-4 text-white">
             <Terminal className="w-4 h-4 text-white/40" />
             <span className="text-[10px] font-medium tracking-[0.4em] uppercase">ADMIN_TERMINAL</span>
          </div>
          <div className="space-y-4">
             {['PHASES', 'ALLOWLIST', 'FEES', 'ROYALTIES', 'AUCTIONS', 'SYSTEM'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab.toLowerCase())}
                  className={`w-full group flex items-center justify-between py-2 border-b transition-all duration-500 uppercase tracking-[0.4em] text-[10px] ${
                    activeTab === tab.toLowerCase() ? 'border-white text-white' : 'border-white/5 text-white/20 hover:text-white/40'
                  }`}
                >
                  {tab}
                  <ArrowRight className={`w-3 h-3 transition-transform ${activeTab === tab.toLowerCase() ? 'translate-x-0 opacity-100' : '-translate-x-2 opacity-0 group-hover:opacity-40'}`} />
                </button>
             ))}
          </div>
        </div>

        <div className="space-y-12 pt-24 border-t border-white/10">
           <div className="space-y-6">
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">NETWORK_BALANCE</p>
              <div className="space-y-2">
                 <p className="text-4xl font-light tracking-tighter text-white">{treasuryBalance} <span className="text-sm text-white/20">SUI</span></p>
              </div>
              <button 
                onClick={() => setConfirmConfig({
                  isOpen: true,
                  title: 'TREASURY_WITHDRAWAL',
                  message: 'Authorize the withdrawal of accumulated network fees to the prime administrator wallet.',
                  onConfirm: () => handleAction('Withdraw', {})
                })}
                className="w-full py-4 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all"
              >
                WITHDRAW_FUNDS
              </button>
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="lg:col-span-9 p-6 md:p-12 lg:p-24 space-y-16 md:space-y-24">
        <AnimatePresence mode="wait">
          {activeTab === 'phases' && (
            <motion.div
              key="phases"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <div className="flex items-center gap-4 text-emerald-500">
                   <Activity className="w-4 h-4" />
                   <span className="text-[10px] font-medium tracking-[0.4em] uppercase">MODULE_STATUS: VERIFIED</span>
                </div>
                <h1 className="text-6xl sm:text-[80px] md:text-[140px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                  PHASE<br /><span className="text-white/20">SCHEDULER</span>
                </h1>
                <p className="text-lg md:text-xl text-white/40 font-light leading-relaxed max-w-2xl">
                  Update the cryptographically enforced minting cycles. Changes are permanent upon finalization.
                </p>
              </div>

              <div className="divide-y border border-white/10 divide-white/10 border-collapse">
                {[
                  { id: 0, name: 'Cycle 0: Preparation', desc: 'Protocol initialized. Public minting deactivated.' },
                  { id: 1, name: 'Cycle 1: Contributors', desc: 'White-signed identifiers only.' },
                  { id: 2, name: 'Cycle 2: Distribution', desc: 'Sui Network global access enabled.' },
                ].map((p) => {
                  const isActive = currentPhase === p.id;
                  return (
                  <div key={p.id} className={`grid grid-cols-1 md:grid-cols-4 items-center p-8 md:p-12 gap-6 md:gap-0 transition-all group ${isActive ? 'bg-emerald-500/5' : 'hover:bg-white/1'}`}>
                    <div className="md:col-span-2 space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">INDEX_0{p.id}</p>
                        <h4 className="text-xl md:text-2xl font-light tracking-tight text-white uppercase">{p.name}</h4>
                      </div>
                      <p className="text-[11px] text-white/40 leading-relaxed font-light uppercase tracking-widest">{p.desc}</p>
                    </div>
                    <div className="flex justify-start md:justify-center">
                      <div className={`px-4 py-1 border text-[9px] font-medium tracking-[0.4em] uppercase ${
                        isActive ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/5' : 'border-white/10 text-white/10'
                      }`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div className="flex justify-start md:justify-end">
                      {!isActive && (
                        <button 
                          onClick={() => setConfirmConfig({
                            isOpen: true,
                            title: 'MODIFY_PROTOCOL_PHASE',
                            message: `Are you sure you want to enforce "${p.name}" as the active distribution cycle?`,
                            onConfirm: () => handleAction('Update Phase', { phase: p.id })
                          })}
                          disabled={loading}
                          className="px-8 py-3 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50"
                        >
                          ACTIVATE
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'allowlist' && (
            <motion.div
              key="allowlist"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[140px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                  ROOT<br /><span className="text-white/20">VAULT</span>
                </h1>
                <p className="text-lg md:text-xl text-white/40 font-light leading-relaxed max-w-2xl uppercase">
                  Manage the cryptographic Merkle root for allowlisted identifiers.
                </p>
              </div>

              <div className="p-12 md:p-24 border-2 border-dashed border-white/5 bg-white/1 flex flex-col items-center justify-center space-y-8 md:space-y-12 text-center group hover:border-white transition-all">
                <div className="w-20 h-20 rounded-full border border-white/10 flex items-center justify-center text-white/20 group-hover:text-white transition-all">
                  <Upload className="w-8 h-8" />
                </div>
                <div className="space-y-4">
                  <p className="text-xl md:text-2xl font-light tracking-tight text-white uppercase">INGEST_DATA_STREAM</p>
                  <p className="text-[10px] text-white/20 font-medium uppercase tracking-[0.4em]">DROP .CSV FILE (SINGLE STREAM ADDRS)</p>
                </div>
                <button className="w-full sm:w-auto px-8 md:px-12 py-4 border border-white text-[10px] font-medium tracking-[0.4em] uppercase bg-white text-black hover:bg-black hover:text-white transition-all">
                  SELECT_LOCAL_STREAM
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'fees' && (
            <motion.div
              key="fees"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[140px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                  FEE<br /><span className="text-white/20">ENGINE</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  Adjust the economic parameters of the Genesis protocol distribution cycles.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border border-white/10 divide-white/10 bg-white/1">
                <div className="p-8 md:p-12 space-y-6 md:space-y-8 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">CYCLE_1_VALUATION (SUI)</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                    <input 
                      type="number" 
                      value={feeInputs.allowlist}
                      onChange={(e) => setFeeInputs(p => ({ ...p, allowlist: e.target.value }))}
                      className="w-full py-4 bg-transparent focus:outline-none font-light text-5xl md:text-6xl tracking-tighter text-white" 
                    />
                    <span className="absolute right-0 bottom-4 text-white/10 font-light text-xl uppercase tracking-widest">SUI</span>
                  </div>
                </div>
                <div className="p-8 md:p-12 space-y-6 md:space-y-8 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">CYCLE_2_VALUATION (SUI)</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                    <input 
                      type="number" 
                      value={feeInputs.public}
                      onChange={(e) => setFeeInputs(p => ({ ...p, public: e.target.value }))}
                      className="w-full py-4 bg-transparent focus:outline-none font-light text-5xl md:text-6xl tracking-tighter text-white" 
                    />
                    <span className="absolute right-0 bottom-4 text-white/10 font-light text-xl uppercase tracking-widest">SUI</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setConfirmConfig({
                  isOpen: true,
                  title: 'UPDATE_FEES',
                  message: 'Modify the economic parameters and distribution valuations. This takes effect immediately.',
                  onConfirm: () => handleAction('Update Fees', {})
                })}
                className="w-full py-8 border border-white text-[11px] font-medium tracking-[0.6em] uppercase hover:bg-white hover:text-black transition-all"
              >
                UPDATE_FINANCIAL_CONSTRAINTS
              </button>
            </motion.div>
          )}

          {activeTab === 'royalties' && (
            <motion.div
              key="royalties"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[140px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                  ROYALTY<br /><span className="text-white/20">CONFIG</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  Manage secondary market enforcement policies and update creator split distributions.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border border-white/10 divide-white/10 bg-white/1">
                <div className="p-8 md:p-12 space-y-6 md:space-y-8 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">BASIS_POINTS (BPS)</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                    <input 
                      type="number" 
                      value={royaltyInput} 
                      onChange={(e) => setRoyaltyInput(e.target.value)}
                      className="w-full py-4 bg-transparent focus:outline-none font-light text-5xl md:text-6xl tracking-tighter text-white" 
                    />
                    <span className="absolute right-0 bottom-4 text-white/10 font-light text-xl uppercase tracking-widest">%</span>
                  </div>
                  <p className="text-[9px] font-light uppercase tracking-widest text-white/40">500 BPS = 5.00% SECONDARY FEE</p>
                </div>
                <div className="p-8 md:p-12 space-y-6 md:space-y-8 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PAYEE_ADDRESS_SPLIT</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                    <input type="text" defaultValue="0x2...4f8a" className="w-full py-4 bg-transparent focus:outline-none font-light text-xl md:text-2xl tracking-tighter text-white font-mono" />
                  </div>
                  <p className="text-[9px] font-light uppercase tracking-widest text-white/40">TREASURY DESTINATION (SINGLE ADDRESS)</p>
                </div>
              </div>

              <button 
                onClick={() => setConfirmConfig({
                  isOpen: true,
                  title: 'UPDATE_ROYALTIES',
                  message: 'Modifying the secondary transfer policy. This will affect all new global market listings immediately.',
                  onConfirm: () => handleAction('Update Royalties', {})
                })}
                className="w-full py-8 border border-white text-[11px] font-medium tracking-[0.6em] uppercase hover:bg-white hover:text-black transition-all"
              >
                DEPLOY_POLICY_REVISION
              </button>
            </motion.div>
          )}

          {activeTab === 'auctions' && (
             <motion.div
               key="auctions"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               className="space-y-16 md:space-y-24"
             >
               <div className="space-y-8">
                 <h1 className="text-6xl sm:text-[80px] md:text-[140px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                   AUCTION<br /><span className="text-white/20">ENGINE</span>
                 </h1>
                 <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                   Configure dynamic pricing modules for incentivized distribution models.
                 </p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border border-white/10 divide-white/10 bg-white/1">
                 <div className="p-8 lg:p-12 space-y-6 md:space-y-8 group">
                   <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">START_PRICE (SUI)</label>
                   <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                     <input type="number" defaultValue="50.0" className="w-full py-4 bg-transparent focus:outline-none font-light text-4xl md:text-5xl tracking-tighter text-white" />
                   </div>
                 </div>
                 <div className="p-8 lg:p-12 space-y-6 md:space-y-8 group">
                   <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">FLOOR_PRICE (SUI)</label>
                   <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                     <input type="number" defaultValue="10.0" className="w-full py-4 bg-transparent focus:outline-none font-light text-4xl md:text-5xl tracking-tighter text-white" />
                   </div>
                 </div>
                 <div className="p-8 lg:p-12 space-y-6 md:space-y-8 group">
                   <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">DECAY_RATE (/EPOCH)</label>
                   <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                     <input type="number" defaultValue="2.5" className="w-full py-4 bg-transparent focus:outline-none font-light text-4xl md:text-5xl tracking-tighter text-white" />
                   </div>
                 </div>
               </div>

               <button 
                 onClick={() => setConfirmConfig({
                   isOpen: true,
                   title: 'UPDATE_AUCTION_CURVE',
                   message: 'Deploying updated Dutch Auction curve. Modifying these parameters during an active auction phase may cause price synchronization delays.',
                   onConfirm: () => handleAction('Update Auction', {})
                 })}
                 className="w-full py-8 border border-white text-[11px] font-medium tracking-[0.6em] uppercase hover:bg-white hover:text-black transition-all"
               >
                 CALIBRATE_AUCTION_CURVE
               </button>
             </motion.div>
          )}

          {activeTab === 'system' && (
            <motion.div
              key="system"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[140px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                  SYSTEM<br /><span className="text-white/20">SECURITY</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  Emergency protocols and cryptographic collection lifecycle management.
                </p>
              </div>

              <div className="p-8 md:p-12 border border-red-500/20 bg-red-500/2 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-12">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-4 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[10px] font-medium tracking-[0.4em] uppercase">PRIORITY_ALPHA: TERMINATION</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-white/40 font-light leading-relaxed uppercase tracking-widest">
                    immediate cessation of protocol operations. all distribution cycles will be frozen permanently.
                  </p>
                </div>
                <button 
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'EMERGENCY_HALT',
                    message: 'CRITICAL WARNING: This will immediately freeze all network distributions and protocol operations.',
                    isDangerous: true,
                    onConfirm: () => handleAction('Halt Protocol', {})
                  })}
                  className="w-full md:w-auto px-8 md:px-16 py-4 md:py-6 bg-red-500 text-white text-[11px] font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-red-500 border border-red-500 transition-all flex items-center justify-center gap-4"
                >
                  <Pause className="w-4 h-4" />
                  EXECUTE_HALT
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmConfig.onConfirm}
        title={confirmConfig.title}
        message={confirmConfig.message}
        isDangerous={confirmConfig.isDangerous}
      />
    </div>
  );
}

