import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { networkConfig, NETWORK, NFT_TYPE, PACKAGE_ID, UPGRADE_CONFIG_ID, STAKING_POOL_ID, TRANSFER_POLICY_ID } from '../lib/sui';
import { Wallet, Search, Filter, LayoutGrid, List, Loader2, Coins, Sparkles, X, Info, Zap, Lock, Unlock, Repeat, Flame, Layers, Terminal, Activity, ArrowUpRight } from 'lucide-react';
import NFTCard from '../components/NFTCard';
import { toast } from 'react-hot-toast';
import { useKiosk } from '../hooks/useKiosk';
import ConfirmModal from '../components/ConfirmModal';

export default function MyCollection() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Upgrade Forge States
  const [forgeMode, setForgeMode] = useState(false);
  const [targetNft, setTargetNft] = useState<any | null>(null);
  const [burnNft, setBurnNft] = useState<any | null>(null);
  const [confirmBurn, setConfirmBurn] = useState(false);

  // Staking States
  const [stakingInstalled, setStakingInstalled] = useState(false);
  const [checkingExtension, setCheckingExtension] = useState(false);

  // Kiosk utility
  const { kioskId, kioskCapId } = useKiosk();

  // Check Kiosk for Staking Extension when Staking Modal opens
  useEffect(() => {
    if (activeModal === 'stake' && selectedNft?.kioskId) {
      const checkExtension = async () => {
        setCheckingExtension(true);
        try {
          const fields = await suiClient.getDynamicFields({ parentId: selectedNft.kioskId });
          const hasStaking = fields.data.some(f => f?.name?.type?.includes('StakingExtension'));
          setStakingInstalled(hasStaking);
        } catch (e) {
          console.error("Failed to query kiosk dynamic fields", e);
        } finally {
          setCheckingExtension(false);
        }
      };
      checkExtension();
    }
  }, [activeModal, selectedNft, suiClient]);

  // Queries for the left rail stats
  const { data: suiBalance } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address || '' },
    { enabled: !!account }
  );

  const { data: stakingPool } = useSuiClientQuery(
    'getObject',
    { id: STAKING_POOL_ID, options: { showContent: true } },
    { enabled: !!STAKING_POOL_ID }
  );

  const [kioskObjects, setKioskObjects] = useState<any[]>([]);
  const [loadingKiosk, setLoadingKiosk] = useState(false);

  useEffect(() => {
    async function fetchKioskItems() {
      if (!kioskId) return;
      setLoadingKiosk(true);
      try {
        let allFields: any[] = [];
        let hasNextPage = true;
        let cursor: string | null | undefined = null;
        
        // Loop through paginated dynamic fields
        while (hasNextPage) {
          const res: any = await suiClient.getDynamicFields({
            parentId: kioskId,
            cursor,
          });
          allFields = [...allFields, ...res.data];
          hasNextPage = res.hasNextPage;
          cursor = res.nextCursor;
        }

        // Kiosk item keys are 0x2::kiosk::Item where value is { id: string }
        const itemIds = allFields
          .filter((f) => f.name.type.includes('kiosk::Item'))
          .map((f) => f.name.value.id || f.objectId); // Fallback to field objectId if needed, though name.value.id is correct

        if (itemIds.length === 0) {
          setKioskObjects([]);
          return;
        }

        // Fetch the actual objects
        const objects = await suiClient.multiGetObjects({
          ids: itemIds,
          options: { showContent: true, showDisplay: true, showType: true },
        });

        // Filter only our specific SuiGenesis NFTs (in case the kiosk holds other things)
        const genesisNfts = objects.filter((o) => o?.data?.type?.includes(NFT_TYPE.split('::')[2]));
        setKioskObjects(genesisNfts);
      } catch (err) {
        console.error('Failed fetching kiosk items:', err);
      } finally {
        setLoadingKiosk(false);
      }
    }
    fetchKioskItems();
  }, [kioskId, suiClient]);

  const nfts = useMemo(() => {
    if (!kioskObjects.length) return [];
    return kioskObjects.map((obj: any) => {
      const content = obj.data?.content as any;
      const display = obj.data?.display?.data as any;
      return {
        id: obj.data?.objectId,
        name: display?.name || content?.fields?.name || 'Sui Genesis Asset',
        image: display?.image_url || `https://picsum.photos/seed/${obj.data?.objectId}/600/600`,
        rarityScore: content?.fields?.rarity_score || 0,
        staked: content?.fields?.staked || false,
        traits: content?.fields?.traits || [],
        // In a full implementation fetching from Kiosk dynamic fields, 
        // these would be the specific Kiosk IDs the NFT is stored in.
        // For demonstration of the 4-arg PTB, we mock them using the user's primary kiosk if found.
        kioskId: kioskId,
        kioskCapId: kioskCapId,
      };
    });
  }, [kioskObjects, kioskId, kioskCapId]);

  const filteredNfts = nfts.filter(nft => 
    nft.name.toLowerCase().includes(search.toLowerCase()) ||
    nft.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleAction = (nft: any, action: string) => {
    if (forgeMode) {
      if (!targetNft) setTargetNft(nft);
      else if (!burnNft && nft.id !== targetNft.id) setBurnNft(nft);
      return;
    }
    setSelectedNft(nft);
    setActiveModal(action);
  };

  const executeUpgrade = async () => {
    if (!targetNft || !burnNft || !account) return;
    if (!UPGRADE_CONFIG_ID) {
      toast.error('Upgrade system not configured. Set VITE_UPGRADE_CONFIG_ID in .env');
      setConfirmBurn(false);
      return;
    }
    try {
      const tx = new Transaction();
      
      // upgrade::upgrade_nft(config, burn_kiosk, burn_cap, burn_nft_id, target_kiosk, target_cap, target_nft_id)
      tx.moveCall({
        target: `${PACKAGE_ID}::upgrade::upgrade_nft`,
        arguments: [
          tx.object(UPGRADE_CONFIG_ID),          // &UpgradeConfig
          tx.object(burnNft.kioskId),            // &mut burn Kiosk
          tx.object(burnNft.kioskCapId),         // &KioskOwnerCap
          tx.pure.id(burnNft.id),               // burn_nft_id: ID
          tx.object(targetNft.kioskId),          // &mut target Kiosk
          tx.object(targetNft.kioskCapId),       // &KioskOwnerCap
          tx.pure.id(targetNft.id),             // target_nft_id: ID
        ]
      });

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success('Asset successfully incinerated and target upgraded.');
            setTargetNft(null);
            setBurnNft(null);
            setForgeMode(false);
          },
          onError: () => toast.error('Forge transaction failed.')
        }
      );
    } catch (e) {
      toast.error('Failed to construct PTB.');
    }
  };

  const handleProtocolAction = async (actionType: string) => {
    if (!selectedNft || !account) return;

    if (actionType === 'stake') {
      if (!STAKING_POOL_ID) {
        toast.error('Staking pool not configured. Set VITE_STAKING_POOL_ID in .env');
        return;
      }
      try {
        const tx = new Transaction();
        
        // If the staking extension is not installed, add it first in the same PTB
        if (!stakingInstalled) {
          tx.moveCall({
            target: `${PACKAGE_ID}::staking::install_extension`,
            arguments: [
              tx.object(selectedNft.kioskId),
              tx.object(selectedNft.kioskCapId)
            ]
          });
        }

        // staking::stake(pool, kiosk, kiosk_cap, nft_id)
        tx.moveCall({
          target: `${PACKAGE_ID}::staking::stake`,
          arguments: [
            tx.object(STAKING_POOL_ID),            // &mut StakingPool
            tx.object(selectedNft.kioskId),        // &mut Kiosk
            tx.object(selectedNft.kioskCapId),     // &KioskOwnerCap
            tx.pure.id(selectedNft.id),           // nft_id: ID
          ]
        });

        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => {
              toast.success('Asset successfully staked in Vault.');
              setActiveModal(null);
            },
            onError: () => toast.error('Staking transaction failed.')
          }
        );
      } catch (e) {
        toast.error('Failed to construct staking PTB.');
      }
    } else if (actionType === 'unstake') {
      // NOTE: Unstaking in the current contract (staking::unstake) requires &mut RewardMintCap.
      // If RewardMintCap is not a shared object, normal users cannot execute this PTB.
      toast.error('Unstaking currently disabled. Contract requires Admin RewardMintCap.');
    } else {
      toast.success(`${actionType} action submitted.`);
      setActiveModal(null);
    }
  };

  if (!account) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center space-y-12">
        <div className="w-24 h-24 rounded-full border border-white/10 flex items-center justify-center text-white/20">
          <Terminal className="w-10 h-10" />
        </div>
        <div className="space-y-4 max-w-md">
          <h2 className="text-4xl font-light tracking-tighter uppercase">AUTH_REQUIRED</h2>
          <p className="text-white/40 font-light leading-relaxed">
            Please establish a secure connection to your Sui wallet to access your distributed asset vault.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white selection:bg-white/10">
      {/* Marquee Header */}
      <div className="border-b border-white/10 overflow-hidden bg-black py-4">
        <div className="flex whitespace-nowrap animate-marquee">
          {[...Array(10)].map((_, i) => (
            <span key={i} className="text-[9px] font-medium uppercase tracking-[0.6em] mx-12 text-white/20">
              SUI_GENESIS_VAULT • VERIFIED_ASSETS • ON_CHAIN_IDENTITY • SUI_GENESIS_VAULT • VERIFIED_ASSETS • ON_CHAIN_IDENTITY •
            </span>
          ))}
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-screen border-x border-white/10">
        {/* Left Rail - Stats */}
        <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/10 p-6 md:p-12 lg:p-16 space-y-12 md:space-y-24 bg-white/1">
          <div className="space-y-12">
            <div className="flex items-center gap-2 text-white/20">
               <Activity className="w-3 h-3" />
               <p className="text-[10px] font-medium tracking-[0.4em] uppercase">SYSTEM_BALANCE</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-5xl lg:text-7xl font-light tracking-tighter text-white">
                {suiBalance ? (Number(suiBalance.totalBalance) / 1_000_000_000).toFixed(2) : '0.00'}
              </h2>
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">NATIVE SUI</p>
            </div>
            <button className="w-full py-6 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all">
              REFRESH_STATE
            </button>
          </div>

          <div className="space-y-12">
            <div className="flex items-center gap-2 text-white/20">
               <Zap className="w-3 h-3" />
               <p className="text-[10px] font-medium tracking-[0.4em] uppercase">REWARD_STAKING</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-5xl lg:text-7xl font-light tracking-tighter text-white">
                {stakingPool?.data?.content?.dataType === 'moveObject' 
                  ? ((stakingPool.data.content.fields as any).reward_rate_per_epoch || '0')
                  : '0'}
              </h2>
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">REWARD / EPOCH</p>
            </div>
          </div>

          <div className="pt-12 md:pt-24 hidden lg:block">
            <div className="aspect-square border border-white/10 flex items-center justify-center p-12 text-center group cursor-pointer hover:bg-white transition-all bg-white/1">
              <p className="text-[10px] font-medium tracking-[0.4em] leading-relaxed uppercase group-hover:text-black">
                Scale protocol engagement to increase distribution weight
              </p>
            </div>
          </div>
        </div>

        {/* Main Content - Collection */}
        <div className="lg:col-span-9 p-6 md:p-12 lg:p-24 space-y-16 md:space-y-24">
          <div className="flex flex-col items-start justify-between gap-8 md:gap-12 border-b border-white/10 pb-8 md:pb-12">
            <div className="space-y-6">
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">STORAGE_INDEX_03</p>
              <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                ASSET<br /><span className="text-white/20">INVENTORY</span>
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 md:gap-8 w-full md:w-auto">
              <button
                onClick={() => {
                  setForgeMode(!forgeMode);
                  setTargetNft(null);
                  setBurnNft(null);
                }}
                className={`flex items-center gap-3 px-8 py-4 border text-[10px] font-medium tracking-[0.4em] uppercase transition-all ${
                  forgeMode ? 'bg-white text-black border-white' : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
                }`}
              >
                <Flame className="w-4 h-4" />
                {forgeMode ? 'EXIT_FORGE' : 'ENTER_UPGRADE_FORGE'}
              </button>
              <div className="relative group border-b border-white/20 pb-2 focus-within:border-white transition-all">
                <input 
                  type="text" 
                  placeholder="UID_SEARCH"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-transparent focus:outline-none text-[10px] font-medium tracking-[0.4em] text-white uppercase placeholder:text-white/20 w-full sm:w-48"
                />
              </div>
            </div>
          </div>

          {/* Upgrade Forge Progress Banner */}
          <AnimatePresence>
            {forgeMode && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="p-6 md:p-8 border border-emerald-500/30 bg-emerald-500/5 mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 md:gap-0"
              >
                <div className="flex items-center gap-6 md:gap-12 w-full md:w-auto">
                   <div className="space-y-1">
                     <p className="text-[10px] font-medium tracking-[0.4em] text-emerald-500/50 uppercase">TARGET_ASSET</p>
                     <p className="text-sm font-medium tracking-widest text-emerald-500">{targetNft ? targetNft.name : 'SELECT_TARGET'}</p>
                   </div>
                   <div className="w-12 h-px bg-emerald-500/20" />
                   <div className="space-y-1">
                     <p className="text-[10px] font-medium tracking-[0.4em] text-orange-500/50 uppercase">BURN_MATERIAL</p>
                     <p className="text-sm font-medium tracking-widest text-orange-500">{burnNft ? burnNft.name : 'SELECT_MATERIAL'}</p>
                   </div>
                </div>
                {targetNft && burnNft && (
                  <button 
                    onClick={() => setConfirmBurn(true)}
                    className="px-8 py-4 w-full md:w-auto bg-emerald-500 text-black font-bold tracking-[0.4em] uppercase hover:bg-emerald-400 transition-colors"
                  >
                    INCINERATE_&_UPGRADE
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 divide-y sm:divide-y-0 sm:gap-[1px] bg-white/10 border border-white/10">
            {filteredNfts.length === 0 && !loadingKiosk && (
              <div className="col-span-1 sm:col-span-2 xl:col-span-3 p-12 text-center text-white/40 font-light tracking-widest uppercase bg-black">
                NO_ASSETS_FOUND_IN_VAULT
              </div>
            )}
            {loadingKiosk && (
              <div className="col-span-1 sm:col-span-2 xl:col-span-3 p-12 flex justify-center bg-black">
                 <Loader2 className="w-8 h-8 animate-spin text-white/20" />
              </div>
            )}
            {filteredNfts.map((nft) => (
              <div 
                key={nft.id} 
                className={`p-6 md:p-8 lg:p-12 space-y-8 md:space-y-12 group transition-all cursor-pointer bg-black ${
                  targetNft?.id === nft.id ? 'bg-emerald-500/10 !ring-2 !ring-emerald-500 !ring-inset z-10' : 
                  burnNft?.id === nft.id ? 'bg-orange-500/10 !ring-2 !ring-orange-500 !ring-inset z-10' : 
                  'hover:bg-white/5'
                }`} 
                onClick={() => handleAction(nft, 'view')}
              >
                <div className="aspect-square border border-white/10 overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-700">
                  <img 
                    src={nft.image} 
                    alt={nft.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                  {nft.staked && (
                    <div className="absolute top-0 right-0 px-4 py-2 bg-white text-black text-[9px] font-medium tracking-[0.4em] uppercase">
                      STAKED
                    </div>
                  )}
                </div>
                <div className="space-y-6">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <h3 className="text-xl font-light tracking-widest uppercase">{nft.name}</h3>
                      <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase group-hover:text-white/40">GENESIS_ID #{nft.id.slice(0, 8)}</p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Action Modals */}
      <AnimatePresence>
        {activeModal && selectedNft && (
          <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-black/95 backdrop-blur-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-[1200px] w-full grid grid-cols-1 lg:grid-cols-2 border border-white/10 bg-black relative max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
            >
              <div className="aspect-square lg:border-r border-white/10 bg-white/1 relative flex items-center justify-center p-6 sm:p-12">
                <img 
                  src={selectedNft.image} 
                  alt={selectedNft.name} 
                  className="w-full h-full object-cover filter contrast-125 select-none"
                  referrerPolicy="no-referrer"
                />
                <button 
                  onClick={() => setActiveModal(null)}
                  className="absolute top-6 right-6 lg:left-6 lg:right-auto p-2 bg-black/60 border border-white/20 hover:border-white transition-all text-white/40 hover:text-white backdrop-blur-sm z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-8 md:p-12 lg:p-16 xl:p-24 flex flex-col justify-between space-y-12">
                 <div className="space-y-8 md:space-y-12">
                    <div className="flex items-center gap-4 text-white/40">
                       <Sparkles className="w-4 h-4" />
                       <span className="text-[10px] font-medium tracking-[0.4em] uppercase">ASSET_INSPECTOR</span>
                    </div>
                    <div className="space-y-4">
                       <h2 className="text-4xl md:text-6xl font-light tracking-tighter uppercase leading-none">{selectedNft.name}</h2>
                       <p className="text-[10px] font-mono text-white/20 truncate">{selectedNft.id}</p>
                    </div>

                    <div className="p-10 border border-white/10 bg-white/1 space-y-6">
                       <div className="flex items-center gap-3 text-white/40">
                          <Info className="w-4 h-4" />
                          <p className="text-[10px] font-medium tracking-[0.4em] uppercase">TRANSACTION_PROTOCOL</p>
                       </div>
                       <p className="text-xs font-light text-white/60 leading-relaxed tracking-widest uppercase">
                         {activeModal === 'stake' && `locking asset in secure kiosk for yield generation. reward tier: Alpha. finalization required.`}
                         {activeModal === 'rent' && `initiating rental contract. asset usage rights will be delegated while ownership persists.`}
                         {activeModal === 'burn' && `DANGER: permanent asset termination. cross-chain data destruction will occur.`}
                         {activeModal === 'merge' && `merging multiple identities. asset entropy will increase. original data will be purged.`}
                         {activeModal === 'view' && `full provenance established. asset data is permanently inscribed on the sui blockchain.`}
                       </p>
                    </div>

                    <div className="space-y-4 pt-8 border-t border-white/10">
                       {activeModal === 'stake' && checkingExtension && (
                          <div className="flex items-center gap-2 text-white/40 pb-4">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span className="text-[10px] uppercase tracking-widest">Querying Kiosk Extension Status...</span>
                          </div>
                       )}
                       {activeModal === 'stake' && !checkingExtension && !stakingInstalled && (
                          <div className="px-4 py-3 bg-white/5 border border-white/10 flex gap-3 text-[10px] text-white/50 uppercase tracking-widest leading-relaxed mb-4">
                            <Zap className="w-3 h-3 mt-0.5 text-white/80 shrink-0" />
                            <span>Notice: StakingExtension not found in your Kiosk. Installation will be bundled into this transaction.</span>
                          </div>
                       )}
                       <div className="flex justify-between items-center text-[10px] font-medium tracking-[0.4em] uppercase">
                         <span className="text-white/20">Gas_Estimate</span>
                         <span className="text-white">~0.008 SUI</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-4 pt-8 border-t border-white/10">
                    {!selectedNft.staked ? (
                      <button 
                        onClick={() => handleProtocolAction('stake')}
                        disabled={checkingExtension}
                        className="w-full py-6 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-50"
                      >
                        {checkingExtension ? 'VALIDATING_KIOSK...' : 'STAKE_ASSET_IN_VAULT'}
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleProtocolAction('unstake')}
                        className="w-full py-6 bg-transparent text-white font-medium tracking-[0.4em] uppercase hover:bg-white/5 border border-white/20 hover:border-white transition-all duration-500"
                      >
                        UNSTAKE_AND_CLAIM
                      </button>
                    )}
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {burnNft && targetNft && (
        <ConfirmModal 
          isOpen={confirmBurn}
          onClose={() => setConfirmBurn(false)}
          onConfirm={executeUpgrade}
          title="ASSET INCINERATION"
          message={`WARNING: You are about to permanently burn "${burnNft.name}" out of existence in order to upgrade "${targetNft.name}". This logic executes on-chain and is cryptographically irreversible.`}
          isDangerous={true}
          confirmText="EXECUTE_BURN"
        />
      )}
    </div>
  );
}

