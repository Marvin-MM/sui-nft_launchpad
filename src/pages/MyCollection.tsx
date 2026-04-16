import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import {
  networkConfig, NETWORK, NFT_TYPE, PACKAGE_ID, UPGRADE_CONFIG_ID,
  STAKING_POOL_ID, TRANSFER_POLICY_ID, REWARD_VAULT_ID,
  MARKETPLACE_CONFIG_ID, RENTAL_POLICY_ID,
} from '../lib/sui';
import {
  Wallet, Search, Filter, LayoutGrid, List, Loader2, Coins, Sparkles, X,
  Info, Zap, Lock, Unlock, Repeat, Flame, Layers, Terminal, Activity,
  ArrowUpRight, Tag, ShoppingCart, Home, Gavel,
} from 'lucide-react';
import NFTCard from '../components/NFTCard';
import { toast } from 'react-hot-toast';
import { useKiosk } from '../hooks/useKiosk';
import ConfirmModal from '../components/ConfirmModal';
import WalrusImage from '../components/WalrusImage';
import useRewardToken from '../hooks/useRewardToken';

// ── Tab config (outside component to avoid re-creation on every render) ──────
const MODAL_TABS = [
  { id: 'asset',   label: 'ASSET',   icon: Sparkles },
  { id: 'stake',   label: 'STAKE',   icon: Zap },
  { id: 'traits',  label: 'TRAITS',  icon: Tag },
  { id: 'market',  label: 'MARKET',  icon: ShoppingCart },
  { id: 'rental',  label: 'RENTAL',  icon: Home },
  { id: 'auction', label: 'AUCTION', icon: Gavel },
] as const;

type ModalTab = typeof MODAL_TABS[number]['id'];

export default function MyCollection() {
  const account      = useCurrentAccount();
  const suiClient    = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [search, setSearch]       = useState('');
  const [view, setView]           = useState<'grid' | 'list'>('grid');
  const [selectedNft, setSelectedNft] = useState<any | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // Upgrade Forge States
  const [forgeMode, setForgeMode]   = useState(false);
  const [targetNft, setTargetNft]   = useState<any | null>(null);
  const [burnNft, setBurnNft]       = useState<any | null>(null);
  const [confirmBurn, setConfirmBurn] = useState(false);

  // Staking States
  const [stakingInstalled, setStakingInstalled]     = useState(false);
  const [checkingExtension, setCheckingExtension]   = useState(false);

  // Trait management state
  const [traitKey, setTraitKey]         = useState('');
  const [traitValue, setTraitValue]     = useState('');
  const [activeTraitAction, setActiveTraitAction] = useState<'add' | 'update' | 'remove' | null>(null);
  const [lockEpochs, setLockEpochs]     = useState('1');

  // Marketplace listing state
  const [listPrice, setListPrice]   = useState('');
  const [listExpiry, setListExpiry] = useState('30');

  // Rental listing state
  const [rentalPrice, setRentalPrice]           = useState('');
  const [rentalMaxDuration, setRentalMaxDuration] = useState('7');

  // User auction state
  const [auctionStartPrice, setAuctionStartPrice]   = useState('');
  const [auctionFloorPrice, setAuctionFloorPrice]   = useState('');
  const [auctionDecayEpochs, setAuctionDecayEpochs] = useState('10');

  // Modal tab
  const [modalTab, setModalTab] = useState<ModalTab>('asset');

  // Kiosk utility
  const { kioskId, kioskCapId } = useKiosk();

  // ── Check StakingExtension when Stake tab becomes active ──────────────────
  useEffect(() => {
    if (modalTab === 'stake' && selectedNft?.kioskId) {
      const checkExtension = async () => {
        setCheckingExtension(true);
        try {
          const fields = await suiClient.getDynamicFields({ parentId: selectedNft.kioskId });
          const hasStaking = fields.data.some(
            (f: any) => f?.name?.type?.includes('StakingExtension')
          );
          setStakingInstalled(hasStaking);
        } catch (e) {
          console.error('Failed to query kiosk dynamic fields', e);
        } finally {
          setCheckingExtension(false);
        }
      };
      checkExtension();
    }
  }, [modalTab, selectedNft, suiClient]);

  // ── Queries for left-rail stats ────────────────────────────────────────────
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

  const { balance: sgrBalance, loading: sgrLoading, symbol: sgrSymbol } = useRewardToken();

  // ── Kiosk item fetching ────────────────────────────────────────────────────
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

        while (hasNextPage) {
          const res: any = await suiClient.getDynamicFields({ parentId: kioskId, cursor });
          allFields  = [...allFields, ...res.data];
          hasNextPage = res.hasNextPage;
          cursor      = res.nextCursor;
        }

        const itemIds = allFields
          .filter((f) => f.name.type.includes('kiosk::Item'))
          .map((f) => f.name.value.id || f.objectId);

        if (itemIds.length === 0) { setKioskObjects([]); return; }

        const objects = await suiClient.multiGetObjects({
          ids: itemIds,
          options: { showContent: true, showDisplay: true, showType: true },
        });

        const genesisNfts = objects.filter(
          (o) => o?.data?.type?.includes(NFT_TYPE.split('::')[2])
        );
        setKioskObjects(genesisNfts);
      } catch (err) {
        console.error('Failed fetching kiosk items:', err);
      } finally {
        setLoadingKiosk(false);
      }
    }
    fetchKioskItems();
  }, [kioskId, suiClient]);

  // ── Derive NFT list from raw kiosk objects ────────────────────────────────
  const nfts = useMemo(() => {
    if (!kioskObjects.length) return [];
    return kioskObjects.map((obj: any) => {
      const content     = obj.data?.content as any;
      const display     = obj.data?.display?.data as any;
      const fields      = content?.fields || {};
      
      let rawImageUrl = display?.image_url || null;
      if (!rawImageUrl && fields?.image_url) {
        rawImageUrl = typeof fields.image_url === 'string'
          ? fields.image_url
          : fields.image_url?.fields?.url ?? fields.image_url?.url ?? null;
      }

      return {
        id:          obj.data?.objectId,
        name:        display?.name        || fields?.name        || 'Sui Genesis Asset',
        description: display?.description || fields?.description || '',
        image:       typeof rawImageUrl === 'string' ? rawImageUrl : null,
        mimeType:    fields?.mime_type    || undefined,
        rarityScore: fields?.rarity_score || 0,
        // NOTE: In the new staking contract the NFT is stored in the StakingExtension
        // bag inside the kiosk, NOT as a field on the NFT struct. Proper staked detection
        // would require querying the staking pool's `entries` table. Keeping the legacy
        // field-based approach here as a best-effort fallback.
        staked:      fields?.staked       || false,
        traits:      fields?.traits       || [],
        kioskId,
        kioskCapId,
      };
    });
  }, [kioskObjects, kioskId, kioskCapId]);

  const filteredNfts = nfts.filter(
    (nft) =>
      nft.name.toLowerCase().includes(search.toLowerCase()) ||
      nft.id.toLowerCase().includes(search.toLowerCase())
  );

  // ── Action dispatcher ─────────────────────────────────────────────────────
  const handleAction = (nft: any, action: string) => {
    if (forgeMode) {
      if (!targetNft) setTargetNft(nft);
      else if (!burnNft && nft.id !== targetNft.id) setBurnNft(nft);
      return;
    }
    setSelectedNft(nft);
    setActiveModal(action);
    setModalTab(action === 'stake' ? 'stake' : 'asset');
  };

  // ── Upgrade Forge PTB ─────────────────────────────────────────────────────
  const executeUpgrade = async () => {
    if (!targetNft || !burnNft || !account) return;
    if (!UPGRADE_CONFIG_ID) {
      toast.error('Upgrade system not configured. Set VITE_UPGRADE_CONFIG_ID in .env');
      setConfirmBurn(false);
      return;
    }
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PACKAGE_ID}::upgrade::upgrade_nft`,
        arguments: [
          tx.object(UPGRADE_CONFIG_ID),
          tx.object(burnNft.kioskId),
          tx.object(burnNft.kioskCapId),
          tx.pure.id(burnNft.id),
          tx.object(targetNft.kioskId),
          tx.object(targetNft.kioskCapId),
          tx.pure.id(targetNft.id),
        ],
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
          onError: () => toast.error('Forge transaction failed.'),
        }
      );
    } catch (e) {
      toast.error('Failed to construct PTB.');
    }
  };

  // ── Protocol action handler ───────────────────────────────────────────────
  const handleProtocolAction = async (actionType: string) => {
    if (!selectedNft || !account) return;

    // ── STAKE ──────────────────────────────────────────────────────────────
    if (actionType === 'stake') {
      if (!STAKING_POOL_ID) {
        toast.error('Staking pool not configured. Set VITE_STAKING_POOL_ID in .env');
        return;
      }
      try {
        // Pre-flight: detect if the NFT is LOCKED in the kiosk.
        // kiosk::take aborts with EItemIsLocked (code 8) on locked items.
        const kioskFields = await suiClient.getDynamicFields({ parentId: selectedNft.kioskId });
        const lockField = kioskFields.data.find(
          (f: any) =>
            f?.name?.type?.includes('kiosk::Lock') &&
            (f?.name?.value?.id === selectedNft.id ||
              String(f?.name?.value?.id).toLowerCase() === selectedNft.id.toLowerCase())
        );
        const hasAnyLock = kioskFields.data.some(
          (f: any) => f?.name?.type?.includes('kiosk::Lock')
        );
        const isLocked = !!lockField || hasAnyLock;

        if (isLocked) {
          toast.error(
            'Staking unavailable: Your NFT is locked in the Kiosk by the royalty TransferPolicy. ' +
            'The staking contract (staking::stake) calls kiosk::take internally, which aborts on locked items. ' +
            'This is a contract-level limitation — contact the collection admin to enable staking for locked NFTs.',
            { duration: 10000, icon: '🔒' }
          );
          return;
        }

        const tx = new Transaction();
        if (!stakingInstalled) {
          tx.moveCall({
            target: `${PACKAGE_ID}::staking::install_extension`,
            arguments: [
              tx.object(selectedNft.kioskId),
              tx.object(selectedNft.kioskCapId),
            ],
          });
        }
        tx.moveCall({
          target: `${PACKAGE_ID}::staking::stake`,
          arguments: [
            tx.object(STAKING_POOL_ID),
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => {
              toast.success('Asset successfully staked in Vault.');
              setActiveModal(null);
            },
            onError: (err: any) => {
              const msg = err?.message || '';
              if (msg.includes('abort code: 8') || msg.includes('EItemIsLocked')) {
                toast.error(
                  'Staking failed: NFT is locked in the Kiosk (EItemIsLocked). ' +
                  'This NFT must be placed but not locked to stake.',
                  { duration: 8000 }
                );
              } else if (msg.includes('abort code: 4') || msg.includes('EExtensionNotInstalled')) {
                toast.error('Staking extension not installed. Please try again.');
              } else {
                toast.error('Staking transaction failed: ' + (msg || 'Unknown error'));
              }
            },
          }
        );
      } catch (e: any) {
        console.error('Staking PTB error:', e);
        toast.error('Failed to prepare staking transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── UNSTAKE (with RewardVault) ─────────────────────────────────────────
    else if (actionType === 'unstake') {
      if (!REWARD_VAULT_ID) {
        toast.error('RewardVault not configured. Set VITE_REWARD_VAULT_ID in .env');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::staking::unstake`,
          arguments: [
            tx.object(STAKING_POOL_ID),
            tx.object(REWARD_VAULT_ID),        // RewardVault shared object
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.object(TRANSFER_POLICY_ID),     // needed to re-lock the NFT
            tx.pure.id(selectedNft.id),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Unstaked and rewards claimed.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Unstake failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare unstake transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── CLAIM_REWARDS ──────────────────────────────────────────────────────
    else if (actionType === 'claim_rewards') {
      if (!REWARD_VAULT_ID) {
        toast.error('RewardVault not configured. Set VITE_REWARD_VAULT_ID in .env');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::staking::claim_rewards`,
          arguments: [
            tx.object(STAKING_POOL_ID),
            tx.object(REWARD_VAULT_ID),
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Rewards claimed successfully.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Claim failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare claim transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── EMERGENCY_UNSTAKE (no vault — forfeits rewards) ────────────────────
    else if (actionType === 'emergency_unstake') {
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::staking::emergency_unstake`,
          arguments: [
            tx.object(STAKING_POOL_ID),
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.object(TRANSFER_POLICY_ID),
            tx.pure.id(selectedNft.id),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => {
              toast.success('Emergency unstake complete. All pending rewards were forfeited.');
              setActiveModal(null);
            },
            onError: (err: any) =>
              toast.error('Emergency unstake failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare emergency unstake: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── ADD_TRAIT ─────────────────────────────────────────────────────────
    else if (actionType === 'add_trait') {
      if (!traitKey.trim() || !traitValue.trim()) {
        toast.error('Trait key and value required.');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::traits::add_trait`,
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(traitKey.trim()))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(traitValue.trim()))),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Trait added.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Add trait failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare trait transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── UPDATE_TRAIT ──────────────────────────────────────────────────────
    else if (actionType === 'update_trait') {
      if (!traitKey.trim() || !traitValue.trim()) {
        toast.error('Trait key and new value required.');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::traits::update_trait`,
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(traitKey.trim()))),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(traitValue.trim()))),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Trait updated.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Update trait failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare trait transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── REMOVE_TRAIT ──────────────────────────────────────────────────────
    else if (actionType === 'remove_trait') {
      if (!traitKey.trim()) {
        toast.error('Trait key required.');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::traits::remove_trait`,
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(traitKey.trim()))),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Trait removed.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Remove trait failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare trait transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── LOCK_TRAIT ────────────────────────────────────────────────────────
    else if (actionType === 'lock_trait') {
      if (!traitKey.trim()) {
        toast.error('Trait key required.');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::traits::lock_trait`,
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(traitKey.trim()))),
            tx.pure.u64(Number(lockEpochs) || 1),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Trait locked.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Lock trait failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare lock transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── UNLOCK_TRAIT ──────────────────────────────────────────────────────
    else if (actionType === 'unlock_trait') {
      if (!traitKey.trim()) {
        toast.error('Trait key required.');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::traits::unlock_trait`,
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
            tx.pure.vector('u8', Array.from(new TextEncoder().encode(traitKey.trim()))),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Trait unlocked.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Unlock trait failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare unlock transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── LIST_SALE (marketplace) ───────────────────────────────────────────
    else if (actionType === 'list_sale') {
      if (!listPrice || Number(listPrice) <= 0) {
        toast.error('Enter a valid listing price.');
        return;
      }
      if (!MARKETPLACE_CONFIG_ID) {
        toast.error('Marketplace not configured. Set VITE_MARKETPLACE_CONFIG_ID in .env');
        return;
      }
      try {
        const priceMist = BigInt(Math.floor(Number(listPrice) * 1e9));
        const tx = new Transaction();
        // Must call kiosk::list first, then marketplace::list_nft in the same PTB
        tx.moveCall({
          target: '0x2::kiosk::list',
          typeArguments: [NFT_TYPE],
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
            tx.pure.u64(priceMist),
          ],
        });
        tx.moveCall({
          target: `${PACKAGE_ID}::marketplace::list_nft`,
          arguments: [
            tx.object(MARKETPLACE_CONFIG_ID),
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
            tx.pure.u64(priceMist),
            tx.pure.u64(Number(listExpiry) || 30),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('NFT listed for sale.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Listing failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare listing transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── CANCEL_LISTING ────────────────────────────────────────────────────
    else if (actionType === 'cancel_listing') {
      if (!MARKETPLACE_CONFIG_ID) {
        toast.error('Marketplace not configured. Set VITE_MARKETPLACE_CONFIG_ID in .env');
        return;
      }
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::marketplace::cancel_listing`,
          arguments: [
            tx.object(MARKETPLACE_CONFIG_ID),
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
          ],
        });
        // Also delist from kiosk in the same PTB
        tx.moveCall({
          target: '0x2::kiosk::delist',
          typeArguments: [NFT_TYPE],
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Listing cancelled.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Cancel listing failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare cancel transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── LIST_RENT ─────────────────────────────────────────────────────────
    else if (actionType === 'list_rent') {
      if (!rentalPrice || Number(rentalPrice) <= 0) {
        toast.error('Enter rental price per epoch.');
        return;
      }
      if (!RENTAL_POLICY_ID) {
        toast.error('Rental policy not configured. Set VITE_RENTAL_POLICY_ID in .env');
        return;
      }
      try {
        const priceMist = BigInt(Math.floor(Number(rentalPrice) * 1e9));
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::rental::list_for_rent`,
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.object(RENTAL_POLICY_ID),
            tx.pure.id(selectedNft.id),
            tx.pure.u64(priceMist),
            tx.pure.u64(Number(rentalMaxDuration) || 7),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('NFT listed for rent.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Rental listing failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare rental transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── DELIST_RENT ───────────────────────────────────────────────────────
    else if (actionType === 'delist_rent') {
      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::rental::delist`,
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => { toast.success('Rental listing removed.'); setActiveModal(null); },
            onError: (err: any) => toast.error('Delist failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare delist transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    // ── USER_AUCTION (Dutch Auction) ──────────────────────────────────────
    else if (actionType === 'user_auction') {
      if (!auctionStartPrice || !auctionFloorPrice) {
        toast.error('Enter start and floor prices.');
        return;
      }
      if (Number(auctionStartPrice) <= Number(auctionFloorPrice)) {
        toast.error('Start price must exceed floor price.');
        return;
      }
      try {
        const startMist = BigInt(Math.floor(Number(auctionStartPrice) * 1e9));
        const floorMist = BigInt(Math.floor(Number(auctionFloorPrice) * 1e9));
        const tx = new Transaction();
        // Take NFT from kiosk first — it will be escrowed in the auction
        const [nftObj] = tx.moveCall({
          target: '0x2::kiosk::take',
          typeArguments: [NFT_TYPE],
          arguments: [
            tx.object(selectedNft.kioskId),
            tx.object(selectedNft.kioskCapId),
            tx.pure.id(selectedNft.id),
          ],
        });
        // Create the user Dutch auction (NFT passed directly, escrowed in contract)
        tx.moveCall({
          target: `${PACKAGE_ID}::dutch_auction::user_create_auction`,
          arguments: [
            nftObj,
            tx.pure.u64(startMist),
            tx.pure.u64(floorMist),
            tx.pure.u64(Number(auctionDecayEpochs) || 10),
          ],
        });
        signAndExecute(
          { transaction: tx },
          {
            onSuccess: () => {
              toast.success('Dutch auction created. Your NFT is now escrowed in the contract.');
              setActiveModal(null);
            },
            onError: (err: any) =>
              toast.error('Auction creation failed: ' + (err?.message || 'Unknown error')),
          }
        );
      } catch (e: any) {
        toast.error('Failed to prepare auction transaction: ' + (e?.message || 'Unknown error'));
      }
    }

    else {
      toast.success(`${actionType} action submitted.`);
      setActiveModal(null);
    }
  };

  // ── Auth gate ──────────────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
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

        {/* ── Left Rail — Stats ─────────────────────────────────────────────── */}
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
              <Coins className="w-3 h-3" />
              <p className="text-[10px] font-medium tracking-[0.4em] uppercase">REWARD_BALANCE</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-5xl lg:text-7xl font-light tracking-tighter text-white">
                {sgrLoading ? '—' : sgrBalance}
              </h2>
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">{sgrSymbol || 'SGR'}</p>
            </div>
          </div>

          <div className="space-y-12">
            <div className="flex items-center gap-2 text-white/20">
              <Zap className="w-3 h-3" />
              <p className="text-[10px] font-medium tracking-[0.4em] uppercase">REWARD_STAKING</p>
            </div>
            <div className="space-y-2">
              <h2 className="text-5xl lg:text-7xl font-light tracking-tighter text-white">
                {(() => {
                  if (stakingPool?.data?.content?.dataType !== 'moveObject') return '0';
                  const rate = (stakingPool.data.content.fields as any).reward_rate_per_epoch;
                  return typeof rate === 'object' ? String(rate?.fields?.value ?? rate?.fields?.current_value ?? '0') : String(rate || '0');
                })()}
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

        {/* ── Main Content — Collection ──────────────────────────────────────── */}
        <div className="lg:col-span-9 p-6 md:p-12 lg:p-24 space-y-16 md:space-y-24">

          {/* Header */}
          <div className="flex flex-col items-start justify-between gap-8 md:gap-12 border-b border-white/10 pb-8 md:pb-12">
            <div className="space-y-6">
              <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">STORAGE_INDEX_03</p>
              <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.8] tracking-[-0.05em] uppercase">
                ASSET<br /><span className="text-white/20">INVENTORY</span>
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 md:gap-8 w-full md:w-auto">
              <button
                onClick={() => { setForgeMode(!forgeMode); setTargetNft(null); setBurnNft(null); }}
                className={`flex items-center gap-3 px-8 py-4 border text-[10px] font-medium tracking-[0.4em] uppercase transition-all ${
                  forgeMode
                    ? 'bg-white text-black border-white'
                    : 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10'
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

          {/* NFT Grid */}
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
                  targetNft?.id === nft.id
                    ? 'bg-emerald-500/10 !ring-2 !ring-emerald-500 !ring-inset z-10'
                    : burnNft?.id === nft.id
                    ? 'bg-orange-500/10 !ring-2 !ring-orange-500 !ring-inset z-10'
                    : 'hover:bg-white/5'
                }`}
                onClick={() => handleAction(nft, 'view')}
              >
                <div className="aspect-square border border-white/10 overflow-hidden relative grayscale group-hover:grayscale-0 transition-all duration-700">
                  <WalrusImage src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
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
                      <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase group-hover:text-white/40">
                        GENESIS_ID #{nft.id.slice(0, 8)}
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/20 group-hover:text-white transition-colors" />
                  </div>
                  {typeof nft.description === 'string' && nft.description.trim() && (
                    <p className="text-xs font-light text-white/40 line-clamp-2 leading-relaxed">
                      {nft.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Action Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {activeModal && selectedNft && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/95 backdrop-blur-3xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-[1200px] w-full grid grid-cols-1 lg:grid-cols-2 border border-white/10 bg-black relative max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
            >
              {/* Left panel — NFT image */}
              <div className="aspect-square lg:aspect-auto lg:border-r border-white/10 bg-white/1 relative flex items-center justify-center p-6 sm:p-12 min-h-[320px]">
                <WalrusImage
                  src={selectedNft.image}
                  alt={selectedNft.name}
                  className="w-full h-full object-cover filter contrast-125 select-none"
                />
                <button
                  onClick={() => setActiveModal(null)}
                  className="absolute top-6 right-6 lg:left-6 lg:right-auto p-2 bg-black/60 border border-white/20 hover:border-white transition-all text-white/40 hover:text-white backdrop-blur-sm z-10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Right panel — tabbed content */}
              <div className="p-6 md:p-10 lg:p-12 flex flex-col space-y-6">

                {/* NFT name + ID */}
                <div className="space-y-1.5">
                  <h2 className="text-3xl md:text-5xl font-light tracking-tighter uppercase leading-none">
                    {selectedNft.name}
                  </h2>
                  <p className="text-[10px] font-mono text-white/20 truncate">{selectedNft.id}</p>
                </div>

                {/* Tab navigation */}
                <div className="flex gap-1 flex-wrap border-b border-white/10 pb-4">
                  {MODAL_TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setModalTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-[9px] font-medium tracking-[0.3em] uppercase transition-all border ${
                          modalTab === tab.id
                            ? 'bg-white text-black border-white'
                            : 'border-white/10 text-white/40 hover:border-white/30 hover:text-white/70'
                        }`}
                      >
                        <Icon className="w-3 h-3" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* ── ASSET TAB ─────────────────────────────────────────────── */}
                {modalTab === 'asset' && (
                  <div className="flex flex-col space-y-6 flex-1">
                    <div className="flex items-center gap-3 text-white/40">
                      <Sparkles className="w-4 h-4" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">ASSET_INSPECTOR</span>
                    </div>

                    {typeof selectedNft.description === 'string' && selectedNft.description.trim() && (
                      <p className="text-sm font-light text-white/40 leading-relaxed border-l-2 border-white/20 pl-6 py-2">
                        {selectedNft.description}
                      </p>
                    )}

                    <div className="p-6 border border-white/10 bg-white/1 space-y-4">
                      <div className="flex items-center gap-3 text-white/40">
                        <Info className="w-4 h-4" />
                        <p className="text-[10px] font-medium tracking-[0.4em] uppercase">TRANSACTION_PROTOCOL</p>
                      </div>
                      <p className="text-xs font-light text-white/60 leading-relaxed tracking-widest uppercase">
                        Full provenance established. Asset data is permanently inscribed on the Sui blockchain.
                      </p>
                    </div>

                    {/* On-chain traits display */}
                    {Array.isArray(selectedNft.traits) && selectedNft.traits.length > 0 && (
                      <div className="space-y-3">
                        <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">ON-CHAIN_TRAITS</p>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedNft.traits.map((trait: any, i: number) => (
                            <div key={i} className="p-3 border border-white/10 bg-white/1 space-y-1">
                              <p className="text-[9px] font-medium tracking-[0.3em] text-white/40 uppercase">
                                {trait.key ?? trait.trait_type ?? '—'}
                              </p>
                              <p className="text-xs font-medium text-white truncate">{trait.value ?? '—'}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="pt-4 border-t border-white/10 flex justify-between items-center text-[10px] font-medium tracking-[0.4em] uppercase">
                      <span className="text-white/20">RARITY_SCORE</span>
                      <span className="text-white">{selectedNft.rarityScore || '—'}</span>
                    </div>
                  </div>
                )}

                {/* ── STAKE TAB ─────────────────────────────────────────────── */}
                {modalTab === 'stake' && (
                  <div className="flex flex-col space-y-5 flex-1">
                    <div className="flex items-center gap-3 text-white/40">
                      <Zap className="w-4 h-4" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">STAKING_PROTOCOL</span>
                    </div>

                    {checkingExtension && (
                      <div className="flex items-center gap-2 text-white/40">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span className="text-[10px] uppercase tracking-widest">Querying Kiosk Extension Status...</span>
                      </div>
                    )}

                    {!checkingExtension && !stakingInstalled && (
                      <div className="px-4 py-3 bg-white/5 border border-white/10 flex gap-3 text-[10px] text-white/50 uppercase tracking-widest leading-relaxed">
                        <Zap className="w-3 h-3 mt-0.5 text-white/80 shrink-0" />
                        <span>Notice: StakingExtension not found. Installation will be bundled into this transaction.</span>
                      </div>
                    )}

                    <div className="p-5 border border-white/10 bg-white/1 space-y-3">
                      <div className="flex justify-between text-[10px] font-medium tracking-[0.4em] uppercase">
                        <span className="text-white/40">STAKE_STATUS</span>
                        <span className={selectedNft.staked ? 'text-emerald-400' : 'text-white/50'}>
                          {selectedNft.staked ? 'STAKED' : 'NOT_STAKED'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] font-medium tracking-[0.4em] uppercase">
                        <span className="text-white/40">REWARD_RATE</span>
                        <span className="text-white">
                          {(() => {
                            if (stakingPool?.data?.content?.dataType !== 'moveObject') return '0';
                            const rate = (stakingPool.data.content.fields as any).reward_rate_per_epoch;
                            return typeof rate === 'object' ? String(rate?.fields?.value ?? rate?.fields?.current_value ?? '0') : String(rate || '0');
                          })()}{' '}
                          / EPOCH
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] font-medium tracking-[0.4em] uppercase">
                        <span className="text-white/40">GAS_ESTIMATE</span>
                        <span className="text-white">~0.008 SUI</span>
                      </div>
                    </div>

                    <div className="space-y-3 pt-1">
                      {!selectedNft.staked ? (
                        <button
                          onClick={() => handleProtocolAction('stake')}
                          disabled={checkingExtension}
                          className="w-full py-5 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 disabled:opacity-50 text-[10px]"
                        >
                          {checkingExtension ? 'VALIDATING_KIOSK...' : 'STAKE_ASSET_IN_VAULT'}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleProtocolAction('claim_rewards')}
                            className="w-full py-5 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 text-[10px]"
                          >
                            CLAIM_REWARDS
                          </button>
                          <button
                            onClick={() => handleProtocolAction('unstake')}
                            className="w-full py-5 bg-transparent text-white font-medium tracking-[0.4em] uppercase hover:bg-white/5 border border-white/20 hover:border-white transition-all duration-500 text-[10px]"
                          >
                            UNSTAKE_AND_CLAIM
                          </button>
                          <button
                            onClick={() => handleProtocolAction('emergency_unstake')}
                            title="Forfeits all pending rewards. Use only if standard unstake fails."
                            className="w-full py-3 bg-transparent text-red-500/70 font-medium tracking-[0.4em] uppercase hover:bg-red-500/5 border border-red-500/20 hover:border-red-500/50 transition-all duration-500 text-[9px]"
                          >
                            ⚠ EMERGENCY_UNSTAKE (FORFEITS_REWARDS)
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* ── TRAITS TAB ────────────────────────────────────────────── */}
                {modalTab === 'traits' && (
                  <div className="flex flex-col space-y-5 flex-1">
                    <div className="flex items-center gap-3 text-white/40">
                      <Tag className="w-4 h-4" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">TRAIT_MANAGEMENT</span>
                    </div>

                    <div className="px-4 py-3 bg-white/5 border border-white/10 text-[10px] text-white/50 uppercase tracking-widest leading-relaxed">
                      Official traits (rarity, XP) are read-only and cannot be removed.
                    </div>

                    {/* Key / Value inputs */}
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">TRAIT_KEY</label>
                        <input
                          type="text"
                          placeholder="e.g. background"
                          value={traitKey}
                          onChange={(e) => setTraitKey(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">TRAIT_VALUE</label>
                        <input
                          type="text"
                          placeholder="e.g. deep_space"
                          value={traitValue}
                          onChange={(e) => setTraitValue(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    {/* Add / Update / Remove */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleProtocolAction('add_trait')}
                        className="py-4 bg-white text-black font-medium tracking-[0.3em] uppercase hover:bg-black hover:text-white border border-white transition-all text-[9px]"
                      >
                        ADD
                      </button>
                      <button
                        onClick={() => handleProtocolAction('update_trait')}
                        className="py-4 bg-transparent text-white font-medium tracking-[0.3em] uppercase hover:bg-white/5 border border-white/20 hover:border-white transition-all text-[9px]"
                      >
                        UPDATE
                      </button>
                      <button
                        onClick={() => handleProtocolAction('remove_trait')}
                        className="py-4 bg-transparent text-red-500/70 font-medium tracking-[0.3em] uppercase hover:bg-red-500/5 border border-red-500/20 hover:border-red-500/50 transition-all text-[9px]"
                      >
                        REMOVE
                      </button>
                    </div>

                    {/* Lock / Unlock section */}
                    <div className="pt-4 border-t border-white/10 space-y-3">
                      <p className="text-[9px] font-medium tracking-[0.4em] text-white/30 uppercase">LOCK_TRAIT</p>
                      <div className="flex gap-2 items-stretch">
                        <input
                          type="number"
                          placeholder="Epochs"
                          min="1"
                          value={lockEpochs}
                          onChange={(e) => setLockEpochs(e.target.value)}
                          className="w-24 bg-transparent border border-white/20 focus:border-white px-3 py-3 text-[10px] font-medium text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                        <button
                          onClick={() => handleProtocolAction('lock_trait')}
                          className="flex-1 py-3 bg-transparent text-white font-medium tracking-[0.25em] uppercase hover:bg-white/5 border border-white/20 hover:border-white transition-all text-[9px] flex items-center justify-center gap-2"
                        >
                          <Lock className="w-3 h-3" /> LOCK_TRAIT
                        </button>
                        <button
                          onClick={() => handleProtocolAction('unlock_trait')}
                          className="flex-1 py-3 bg-transparent text-white/50 font-medium tracking-[0.25em] uppercase hover:bg-white/5 border border-white/10 hover:border-white/30 transition-all text-[9px] flex items-center justify-center gap-2"
                        >
                          <Unlock className="w-3 h-3" /> UNLOCK
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── MARKET TAB ────────────────────────────────────────────── */}
                {modalTab === 'market' && (
                  <div className="flex flex-col space-y-5 flex-1">
                    <div className="flex items-center gap-3 text-white/40">
                      <ShoppingCart className="w-4 h-4" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">MARKETPLACE_LISTING</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">PRICE (SUI)</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={listPrice}
                          onChange={(e) => setListPrice(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">EXPIRY (EPOCHS)</label>
                        <input
                          type="number"
                          placeholder="30"
                          min="1"
                          value={listExpiry}
                          onChange={(e) => setListExpiry(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <button
                        onClick={() => handleProtocolAction('list_sale')}
                        className="w-full py-5 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 text-[10px]"
                      >
                        LIST_FOR_SALE
                      </button>
                      <button
                        onClick={() => handleProtocolAction('cancel_listing')}
                        className="w-full py-5 bg-transparent text-white font-medium tracking-[0.4em] uppercase hover:bg-white/5 border border-white/20 hover:border-white transition-all duration-500 text-[10px]"
                      >
                        CANCEL_LISTING
                      </button>
                    </div>
                  </div>
                )}

                {/* ── RENTAL TAB ────────────────────────────────────────────── */}
                {modalTab === 'rental' && (
                  <div className="flex flex-col space-y-5 flex-1">
                    <div className="flex items-center gap-3 text-white/40">
                      <Home className="w-4 h-4" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">RENTAL_PROTOCOL</span>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">PRICE PER EPOCH (SUI)</label>
                        <input
                          type="number"
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          value={rentalPrice}
                          onChange={(e) => setRentalPrice(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">MAX DURATION (EPOCHS)</label>
                        <input
                          type="number"
                          placeholder="7"
                          min="1"
                          value={rentalMaxDuration}
                          onChange={(e) => setRentalMaxDuration(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-2">
                      <button
                        onClick={() => handleProtocolAction('list_rent')}
                        className="w-full py-5 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 text-[10px]"
                      >
                        LIST_FOR_RENT
                      </button>
                      <button
                        onClick={() => handleProtocolAction('delist_rent')}
                        className="w-full py-5 bg-transparent text-white font-medium tracking-[0.4em] uppercase hover:bg-white/5 border border-white/20 hover:border-white transition-all duration-500 text-[10px]"
                      >
                        DELIST_RENTAL
                      </button>
                    </div>
                  </div>
                )}

                {/* ── AUCTION TAB ───────────────────────────────────────────── */}
                {modalTab === 'auction' && (
                  <div className="flex flex-col space-y-5 flex-1">
                    <div className="flex items-center gap-3 text-white/40">
                      <Gavel className="w-4 h-4" />
                      <span className="text-[10px] font-medium tracking-[0.4em] uppercase">DUTCH_AUCTION</span>
                    </div>

                    <div className="px-4 py-3 bg-orange-500/5 border border-orange-500/20 space-y-1 text-[10px] text-orange-400/80 uppercase tracking-widest leading-relaxed">
                      <p className="font-semibold">⚠ WARNING</p>
                      <p>Your NFT will be removed from your kiosk and escrowed in the auction contract. This action cannot be undone without winning or cancelling the auction.</p>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">START PRICE (SUI)</label>
                        <input
                          type="number"
                          placeholder="10.00"
                          min="0"
                          step="0.01"
                          value={auctionStartPrice}
                          onChange={(e) => setAuctionStartPrice(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">FLOOR PRICE (SUI)</label>
                        <input
                          type="number"
                          placeholder="1.00"
                          min="0"
                          step="0.01"
                          value={auctionFloorPrice}
                          onChange={(e) => setAuctionFloorPrice(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-medium tracking-[0.4em] text-white/40 uppercase">DECAY EPOCHS</label>
                        <input
                          type="number"
                          placeholder="10"
                          min="1"
                          value={auctionDecayEpochs}
                          onChange={(e) => setAuctionDecayEpochs(e.target.value)}
                          className="w-full bg-transparent border border-white/20 focus:border-white px-4 py-3 text-[10px] font-medium tracking-widest text-white placeholder:text-white/20 focus:outline-none transition-colors"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleProtocolAction('user_auction')}
                      className="w-full py-5 bg-white text-black font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-white border border-white transition-all duration-500 text-[10px]"
                    >
                      CREATE_AUCTION
                    </button>
                  </div>
                )}

              </div>{/* end right panel */}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Forge confirm modal */}
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
