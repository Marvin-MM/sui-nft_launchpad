import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery, ConnectModal, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { networkConfig, NETWORK, MIST_PER_SUI, formatSui, PACKAGE_ID, MINT_CONFIG_ID } from '../lib/sui';
import { useStore } from '../store/useStore';
import { toast } from 'react-hot-toast';
import confetti from 'canvas-confetti';
import { Coins, ShieldCheck, AlertCircle, Loader2, Minus, Plus, Wallet, Sparkles, ChevronRight, Terminal, Activity, Cpu } from 'lucide-react';
import AIAdvisor from '../components/AIAdvisor';
import { bcs } from '@mysten/sui/bcs';
import { useKiosk } from '../hooks/useKiosk';
import { resolveKioskArgs, finalizeKiosk } from '../lib/kioskUtils';
import { generateMerkleProof } from '../lib/merkle';
import ConfirmModal from '../components/ConfirmModal';

const ERROR_MAP: Record<string, string> = {
  'ECollectionPaused': 'The collection is currently paused by the admin.',
  'EMaxSupplyReached': 'The maximum supply has been reached.',
  'EInsufficientFee': 'Insufficient SUI to cover the mint fee and gas.',
  'EWalletLimitReached': 'You have reached the maximum mint limit for this wallet.',
};

export default function Mint() {
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const [quantity, setQuantity] = useState(1);
  const [minting, setMinting] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [mintedNft, setMintedNft] = useState<{ id: string; name: string; image: string } | null>(null);
  const [pendingCommitment, setPendingCommitment] = useState<string | null>(null);
  const [confirmConfig, setConfirmConfig] = useState<{isOpen: boolean; action: 'mint' | 'reveal' | null}>({ isOpen: false, action: null });

  const { data: configData } = useSuiClientQuery('getObject', {
    id: MINT_CONFIG_ID,
    options: { showContent: true },
  });

  const { data: systemState } = useSuiClientQuery('getLatestSuiSystemState');
  const currentEpoch = systemState?.epoch || '0';

  const phase = (configData?.data?.content as any)?.fields?.phase || 0;
  const allowlistPrice = (configData?.data?.content as any)?.fields?.allowlist_price || '1000000000';
  const publicPrice = (configData?.data?.content as any)?.fields?.public_price || '2000000000';
  const currentPrice = phase === 1 ? allowlistPrice : publicPrice;
  const totalPrice = BigInt(currentPrice) * BigInt(quantity);

  const [mintStrategy, setMintStrategy] = useState<'standard' | 'dutch' | 'commit'>('standard');
  const { kioskId, kioskCapId } = useKiosk();

  const handleMint = async () => {
    if (!account) return;
    setMinting(true);

    try {
      const tx = new Transaction();
      // Split exact payment
      const [feeCoin] = tx.splitCoins(tx.gas, [totalPrice]);
      
      // Abstracted dynamic Kiosk resolution
      const { kioskArg, capArg, isNew } = resolveKioskArgs(tx, kioskId, kioskCapId);

      if (mintStrategy === 'dutch') {
        tx.moveCall({
          target: `${PACKAGE_ID}::mint::mint_via_auction`,
          arguments: [
            tx.object(MINT_CONFIG_ID),
            feeCoin,
            tx.pure.u64(quantity),
            kioskArg,
            capArg
          ],
        });
      } else if (mintStrategy === 'commit') {
        // Step 1 of True RNG Commit-Reveal flow
        tx.moveCall({
          target: `${PACKAGE_ID}::commit_reveal::request_mint`,
          arguments: [
            tx.object(MINT_CONFIG_ID),
            feeCoin,
            tx.pure.u64(quantity),
            kioskArg,
            capArg
          ],
        });
        toast('Commitment requested. Reveal transaction will be required shortly.', { icon: 'ℹ️' });
      } else {
        if (phase === 1) {
          // Off-chain Merkle tree logic
          const siblingHashes = generateMerkleProof(account.address);
          tx.moveCall({
            target: `${PACKAGE_ID}::allowlist::mint_allowlist`,
            arguments: [
              tx.object(MINT_CONFIG_ID),
              feeCoin,
              tx.pure.u64(quantity),
              tx.pure(bcs.vector(bcs.vector(bcs.u8())).serialize(siblingHashes)),
              kioskArg,
              capArg
            ],
          });
        } else {
          // Public distribution
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::mint_to_kiosk`,
            arguments: [
              tx.object(MINT_CONFIG_ID),
              feeCoin,
              tx.pure.u64(quantity),
              kioskArg,
              capArg
            ],
          });
        }
      }

      // Secure the Kiosk creation if one was generated in this block
      if (isNew) {
        finalizeKiosk(tx, kioskArg, capArg, account.address);
      }

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            toast.success('Mint transaction submitted! Waiting for confirmation...');
            try {
              const txResult = await suiClient.waitForTransaction({
                digest: result.digest,
                options: { showObjectChanges: true }
              });
              
              const createdObjects = txResult.objectChanges?.filter(change => change.type === 'created') || [];
              
              if (mintStrategy === 'commit') {
                const commitmentObj = createdObjects.find((obj: any) => obj.objectType.includes('MintCommitment'));
                if (commitmentObj) {
                  setPendingCommitment((commitmentObj as any).objectId);
                  return;
                }
              }
              
              const mintedObjectId = createdObjects.length > 0 ? (createdObjects[0] as any).objectId : result.digest;
              
              confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFFFFF', '#333333', '#8b5cf6'],
              });
              setShowCelebration(true);
              setMintedNft({
                id: mintedObjectId,
                name: `Genesis Asset`,
                image: `https://picsum.photos/seed/${mintedObjectId}/600/600`,
              });
            } catch (e) {
              console.error("Failed to fetch transaction details", e);
              toast.success('Mint successful!');
            }
          },
          onError: (error) => {
            const msg = error.message;
            const knownError = Object.keys(ERROR_MAP).find(k => msg.includes(k));
            toast.error(knownError ? ERROR_MAP[knownError] : 'Transaction failed. Please try again.');
          },
          onSettled: () => setMinting(false),
        }
      );
    } catch (error) {
      console.error(error);
      toast.error('Failed to build transaction.');
      setMinting(false);
    }
  };

  const handleReveal = async () => {
    if (!account || !pendingCommitment) return;
    setMinting(true);

    try {
      const tx = new Transaction();
      // Step 2: Pass MintCommitment and 0x8 Randomness
      tx.moveCall({
        target: `${PACKAGE_ID}::commit_reveal::reveal`,
        arguments: [
          tx.object(MINT_CONFIG_ID),
          tx.object(pendingCommitment),
          tx.object('0x8')
        ]
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: async (result) => {
            toast.success('Reveal successful! Decrypting traits...');
            setPendingCommitment(null);
            
            try {
              const txResult = await suiClient.waitForTransaction({
                digest: result.digest,
                options: { showObjectChanges: true }
              });
              const createdObjects = txResult.objectChanges?.filter(change => change.type === 'created') || [];
              const mintedObjectId = createdObjects.length > 0 ? (createdObjects[0] as any).objectId : result.digest;
              
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#FFFFFF', '#333333', '#8b5cf6'] });
              setShowCelebration(true);
              setMintedNft({
                id: mintedObjectId,
                name: `Genesis Asset`,
                image: `https://picsum.photos/seed/${mintedObjectId}/600/600`,
              });
            } catch (e) {
              toast.success('Reveal successful!');
            }
          },
          onError: (error) => toast.error('Reveal failed. Try again.'),
          onSettled: () => setMinting(false),
        }
      );
    } catch (e) {
      toast.error('Failed to build reveal transaction.');
      setMinting(false);
    }
  };

  if (!account) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center space-y-12">
        <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center text-white/20">
          <Terminal className="w-10 h-10" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-light tracking-tighter uppercase">INITIALIZATION REQUIRED</h2>
          <p className="text-white/40 font-light leading-relaxed">
            Authentication failed. Please establish a secure connection to your Sui wallet to proceed with asset distribution.
          </p>
        </div>
        <ConnectModal
          trigger={
            <button className="px-12 py-5 border border-white text-white font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all duration-500">
              ESTABLISH CONNECTION
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto min-h-screen border-x border-white/10 grid grid-cols-1 lg:grid-cols-12">
      
      {/* Left Column - Mint Controls */}
      <div className="lg:col-span-8 p-6 md:p-12 lg:p-24 space-y-16 md:space-y-24 border-b lg:border-b-0 lg:border-r border-white/10">
        <div className="space-y-8">
          <div className="flex items-center gap-4 text-emerald-500">
             <Activity className="w-4 h-4" />
             <span className="text-[10px] font-medium tracking-[0.4em] uppercase">SYSTEM_NODE: ACTIVE</span>
          </div>
          <h1 className="text-5xl sm:text-7xl md:text-[120px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
            ASSET<br />
            <span className="text-white/20">DISTRIBUTION</span>
          </h1>
          <p className="text-xl text-white/40 font-light leading-relaxed max-w-2xl">
            Protocol Version 1.0.4 - Operating under <span className="text-white">Cycle {phase}</span> constraints.
            {phase === 1 ? ' Restricted to allowlisted identifiers only.' : ' Public distribution phase is currently active.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10 border border-white/10 bg-white/1">
           <div className="p-6 md:p-10 space-y-8 md:space-y-12">
              <div className="space-y-2">
                 <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">VALUATION / UNIT</p>
                 <p className="text-4xl sm:text-5xl font-light tracking-tighter text-white">
                   {formatSui(currentPrice)}<span className="text-xl text-white/20 ml-2">SUI</span>
                 </p>
              </div>

              <div className="space-y-6">
                <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">QUANTITY_LOCK</p>
                <div className="flex items-center gap-12">
                   <div className="flex items-center gap-8 py-2 border-b border-white/20">
                      <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="text-white/40 hover:text-white transition-colors">
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-4xl font-light w-12 text-center">{quantity.toString().padStart(2, '0')}</span>
                      <button onClick={() => setQuantity(Math.min(5, quantity + 1))} className="text-white/40 hover:text-white transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                   </div>
                   <div className="space-y-1">
                      <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">LIMIT</p>
                      <p className="text-sm font-medium text-white/40">05 MAX</p>
                   </div>
                </div>
              </div>
           </div>

           <div className="p-6 md:p-10 space-y-8 md:space-y-12 bg-white/1">
              <div className="space-y-6">
                 <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">STRATEGY_SELECTOR</p>
                 <div className="flex flex-col gap-4">
                    {[
                      { id: 'standard', name: 'Standard distribution' },
                      { id: 'dutch', name: 'Incentivized auction' },
                      { id: 'commit', name: 'Committed allocation' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setMintStrategy(s.id as any)}
                        className={`flex items-center justify-between py-2 border-b transition-all duration-500 uppercase tracking-widest text-[9px] ${
                          mintStrategy === s.id ? 'border-white text-white' : 'border-white/5 text-white/20 hover:text-white/40'
                        }`}
                      >
                        {s.name}
                        {mintStrategy === s.id && <ChevronRight className="w-3 h-3" />}
                      </button>
                    ))}
                 </div>
                 
                 {/* Dutch Auction Decay UI */}
                 <AnimatePresence>
                   {mintStrategy === 'dutch' && (
                     <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="pt-4 space-y-2">
                       <div className="flex justify-between items-center text-[9px] uppercase tracking-widest font-medium text-white/40">
                         <span>Current Epoch: {currentEpoch}</span>
                         <span className="text-emerald-500">Decaying</span>
                       </div>
                       <div className="h-1 w-full bg-white/10 overflow-hidden">
                         <motion.div 
                           initial={{ width: '100%' }}
                           animate={{ width: '60%' }} 
                           transition={{ duration: 200, ease: "linear" }}
                           className="h-full bg-white/40" 
                         />
                       </div>
                     </motion.div>
                   )}
                 </AnimatePresence>
              </div>

              <div className="space-y-2">
                 <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PAYLOAD_TOTAL</p>
                 <p className="text-4xl sm:text-5xl font-light tracking-tighter text-white">
                   {formatSui(totalPrice)}<span className="text-xl text-white/20 ml-2">SUI</span>
                 </p>
              </div>
           </div>
        </div>

        <div className="space-y-8">
           <button
             onClick={() => setConfirmConfig({ isOpen: true, action: 'mint' })}
             disabled={minting}
             className={`w-full py-8 text-[11px] font-medium tracking-[0.6em] uppercase transition-all duration-700 disabled:opacity-30 border ${
               minting 
                 ? 'bg-transparent border-white/20 text-white/40 cursor-wait' 
                 : 'bg-white text-black border-white hover:bg-black hover:text-white'
             }`}
           >
             {minting ? 'EXECUTING_PROTOCOL...' : 'INITIALIZE_MINT_SEQUENCE'}
           </button>
           
           <div className="flex items-center gap-4 text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">
             <ShieldCheck className="w-3 h-3 text-emerald-500" />
             <span>Secured by Sui Kiosk Architecture</span>
           </div>
        </div>
      </div>

      {/* Right Column - Context */}
      <div className="lg:col-span-4 p-6 md:p-12 lg:p-24 space-y-12 bg-white/1">
        <AIAdvisor />
        
        <div className="space-y-10">
          <h3 className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase">NETWORK_STATUS</h3>
          <div className="space-y-8">
            {[
              { label: 'Network Fee', value: '~0.008 SUI' },
              { label: 'Asset Standard', value: 'SUI_NFT_0.2' },
              { label: 'Vault Status', value: 'Synchronized' },
              { label: 'Gas Prediction', value: 'Low' },
            ].map((item) => (
              <div key={item.label} className="flex justify-between items-baseline border-b border-white/5 pb-4">
                <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">{item.label}</p>
                <p className="text-xs font-medium text-white tracking-widest uppercase">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 border border-white/5 bg-white/1 space-y-4">
          <div className="flex items-center gap-3 text-amber-500/50">
            <Cpu className="w-4 h-4" />
            <span className="text-[10px] font-medium tracking-[0.2em] uppercase leading-none">Processor_Note</span>
          </div>
          <p className="text-[11px] font-light text-white/30 leading-relaxed uppercase tracking-widest">
            distribution occurs directly to your verified kiosk endpoint. ensure adequate gas for transaction finalization.
          </p>
        </div>
      </div>

      {/* Success Modal */}
      <AnimatePresence>
        {showCelebration && mintedNft && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="max-w-[1000px] w-full grid grid-cols-1 md:grid-cols-2 border border-white/10 bg-black overflow-hidden"
            >
              <div className="aspect-square border-r border-white/10 p-6 md:p-12 bg-white/1">
                 <img 
                   src={mintedNft.image} 
                   alt={mintedNft.name} 
                   className="w-full h-full object-cover filter contrast-125 select-none"
                   referrerPolicy="no-referrer"
                 />
              </div>
              
              <div className="p-8 md:p-12 lg:p-24 flex flex-col justify-between space-y-12">
                 <div className="space-y-8">
                    <div className="flex items-center gap-4 text-accent-primary">
                       <Sparkles className="w-5 h-5" />
                       <span className="text-[10px] font-medium tracking-[0.4em] uppercase">DISTRIBUTION_SUCCESS</span>
                    </div>
                    <div className="space-y-2">
                       <h2 className="text-4xl md:text-6xl font-light tracking-tighter uppercase leading-none">{mintedNft.name}</h2>
                       <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">GENESIS_PROTOCOL / ID: {mintedNft.id.slice(0, 8)}</p>
                    </div>
                    <div className="flex items-center gap-6 pt-8 border-t border-white/10">
                       <div className="space-y-1">
                          <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">TIER_CLASS</p>
                          <p className="text-sm font-medium tracking-widest uppercase">LEGENDARY_ASSET</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">NETWORK</p>
                          <p className="text-sm font-medium tracking-widest uppercase text-emerald-500">SUI_MAINNET</p>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4">
                    <button 
                      onClick={() => setShowCelebration(false)}
                      className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500"
                    >
                      VIEW_ASSET_VAULT
                    </button>
                    <button 
                      onClick={() => setShowCelebration(false)}
                      className="w-full py-6 border border-white/10 text-white/40 font-medium tracking-[0.4em] uppercase hover:text-white transition-all"
                    >
                      TERMINATE_WINDOW
                    </button>
                 </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Reveal Mystery Box Modal */}
      <AnimatePresence>
        {pendingCommitment && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl"
          >
            <div className="max-w-[600px] w-full border border-white/10 bg-black p-8 md:p-12 space-y-8 md:space-y-12 text-center">
               <div className="w-24 h-24 mx-auto border border-white/20 flex items-center justify-center">
                 <Sparkles className="w-8 h-8 text-white/40 animate-pulse" />
               </div>
               <div className="space-y-4">
                 <h2 className="text-2xl md:text-3xl font-light tracking-tighter uppercase">COMMITMENT_SECURED</h2>
                 <p className="text-[10px] font-medium tracking-[0.4em] text-white/40 uppercase leading-relaxed">
                   Your commitment hash has been recorded on-chain. Execute the reveal transaction to securely fetch global randomness and generate your asset.
                 </p>
               </div>
               <button 
                 onClick={() => setConfirmConfig({ isOpen: true, action: 'reveal' })}
                 disabled={minting}
                 className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-50"
               >
                 {minting ? 'DECRYPTING_TRAITS...' : 'EXECUTE_REVEAL'}
               </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        onClose={() => setConfirmConfig({ isOpen: false, action: null })}
        onConfirm={() => {
          if (confirmConfig.action === 'mint') handleMint();
          else if (confirmConfig.action === 'reveal') handleReveal();
        }}
        title={confirmConfig.action === 'mint' ? "AUTHORIZE DISTRIBUTION" : "DECRYPT RECORD"}
        message={confirmConfig.action === 'mint' 
          ? `You are about to authorize a transfer of ${formatSui(totalPrice)} SUI to acquire ${quantity} Genesis Asset(s). This on-chain action is cryptographically irreversible.` 
          : "You are about to execute a cryptographic reveal via the Sui network randomness beacon to finalize your asset traits. Proceed?"}
        confirmText={confirmConfig.action === 'mint' ? "AUTHORIZE_MINT" : "AUTHORIZE_REVEAL"}
      />
    </div>
  );
}

