import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import {
  PACKAGE_ID, MINT_CONFIG_ID, MIST_PER_SUI,
  STAKING_POOL_ID, REWARD_VAULT_ID, REWARD_MINT_CAP_ID, MARKETPLACE_CONFIG_ID,
  MULTISIG_ADMIN_CAP_ID, DUTCH_AUCTION_ID,
  ADMIN_CAP_TYPE,
} from '../lib/sui';
import {
  Terminal, Activity, AlertTriangle, ArrowRight, Pause, Play,
  Loader2, ShieldAlert, Upload, Lock, Users, Settings,
  CheckCircle, XCircle, Clock, Zap, Coins,
  MessageSquare, Inbox, Circle, AlertCircle, Trash2, ChevronRight,
  ExternalLink, Key, Search, RefreshCw, Filter, X,
} from 'lucide-react';
import { listFeedback, getFeedbackStats, updateFeedback, deleteFeedback, type FeedbackItem, type FeedbackStatus, type FeedbackPriority, type FeedbackStats } from '../services/feedbackService';
import { toast } from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

export default function Admin() {
  /* ── Wallet ─────────────────────────────────────────────────────────── */
  const account = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();

  /* ── UI State ───────────────────────────────────────────────────────── */
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('phases');

  /* ── Inputs ─────────────────────────────────────────────────────────── */
  const [feeInputs, setFeeInputs] = useState({ allowlist: '0', public: '0' });
  const [royaltyInput, setRoyaltyInput] = useState('0');
  const [allowlistRoot, setAllowlistRoot] = useState('');
  const [maxPerWalletAllowlist, setMaxPerWalletAllowlist] = useState('3');
  const [maxPerWalletPublic, setMaxPerWalletPublic] = useState('3');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  /* ── TimeLock proposal inputs (local staging) ────────────────────────── */
  const [pendingFee, setPendingFee] = useState('');
  const [pendingPaused, setPendingPaused] = useState(false);
  const [pendingRoyalty, setPendingRoyalty] = useState('');

  /* ── MultiSig ───────────────────────────────────────────────────────── */
  const [multisigProposalId, setMultisigProposalId] = useState('');
  const [multisigApprove, setMultisigApprove] = useState(true);
  const [multisigNewFee, setMultisigNewFee] = useState('');

  /* ── Setup ──────────────────────────────────────────────────────────── */
  const [setupRewardRate, setSetupRewardRate] = useState('10');
  const [setupMarketFee, setSetupMarketFee] = useState('250');
  const [setupMarketExpiry, setSetupMarketExpiry] = useState('30');
  const [setupAuctionStart, setSetupAuctionStart] = useState('10');
  const [setupAuctionFloor, setSetupAuctionFloor] = useState('1');
  const [setupAuctionDecay, setSetupAuctionDecay] = useState('5');
  const [setupAuctionUnits, setSetupAuctionUnits] = useState('100');
  const [setupMaxSupply, setSetupMaxSupply] = useState('0');

  /* ── Feedback Tab State ─────────────────────────────────────────────── */
  const [adminKey,         setAdminKey]         = useState<string>(() => sessionStorage.getItem('adminApiKey') ?? '');
  const [adminKeyInput,    setAdminKeyInput]     = useState('');
  const [adminKeySet,      setAdminKeySet]       = useState<boolean>(() => !!sessionStorage.getItem('adminApiKey'));
  const [feedbackItems,    setFeedbackItems]     = useState<FeedbackItem[]>([]);
  const [feedbackStats,    setFeedbackStats]     = useState<FeedbackStats | null>(null);
  const [feedbackLoading,  setFeedbackLoading]   = useState(false);
  const [feedbackPage,     setFeedbackPage]      = useState(1);
  const [feedbackTotal,    setFeedbackTotal]     = useState(0);
  const [feedbackFilter,   setFeedbackFilter]    = useState<{ status: string; category: string; priority: string; search: string }>({
    status: '', category: '', priority: '', search: '',
  });
  const [selectedFeedback, setSelectedFeedback]  = useState<FeedbackItem | null>(null);
  const [editNotes,        setEditNotes]         = useState('');
  const [feedbackSearch,   setFeedbackSearch]    = useState('');
  const FEEDBACK_PAGE_LIMIT = 15;

  /* ── Confirm Modal ──────────────────────────────────────────────────── */
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    isDangerous?: boolean;
    onConfirm: () => void;
  }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  /* ── AdminCap Query ─────────────────────────────────────────────────── */
  const { data: adminCapData, isLoading: checkingAdmin } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address || '',
      filter: { StructType: ADMIN_CAP_TYPE },
    },
    { enabled: !!account }
  );
  const isAdmin = !!(adminCapData?.data && adminCapData.data.length > 0);

  /* ── MintConfig Query ───────────────────────────────────────────────── */
  const { data: mintConfig } = useSuiClientQuery('getObject', {
    id: MINT_CONFIG_ID,
    options: { showContent: true },
  });

  /* ── Derived: current phase ─────────────────────────────────────────── */
  const currentPhase = mintConfig?.data?.content?.dataType === 'moveObject'
    ? (mintConfig.data.content.fields as any).current_phase ?? 0
    : 0;

  /* ── Derived: TimeLockConfig fields ─────────────────────────────────── */
  const mintFeeField        = (mintConfig?.data?.content as any)?.fields?.mint_fee;
  const currentMintFee      = mintFeeField?.fields?.current_value ?? mintFeeField ?? '0';
  const pendingMintFeeValue = mintFeeField?.fields?.pending_value?.fields?.vec?.[0] ?? null;
  const mintFeePendingEpoch = mintFeeField?.fields?.pending_epoch ?? null;
  const mintFeeLockEpochs   = mintFeeField?.fields?.min_lock_epochs ?? 2;

  const royaltyField        = (mintConfig?.data?.content as any)?.fields?.royalty_bps;
  const currentRoyalty      = royaltyField?.fields?.current_value ?? royaltyField ?? '0';
  const pendingRoyaltyValue = royaltyField?.fields?.pending_value?.fields?.vec?.[0] ?? null;
  const royaltyPendingEpoch = royaltyField?.fields?.pending_epoch ?? null;

  const pausedField         = (mintConfig?.data?.content as any)?.fields?.paused;
  const isPaused            = !!(pausedField?.fields?.current_value ?? pausedField);
  const pendingPausedValue  = pausedField?.fields?.pending_value?.fields?.vec?.[0] ?? null;
  const pausedPendingEpoch  = pausedField?.fields?.pending_epoch ?? null;
  const pendingPausedBool: boolean | null = pendingPausedValue != null
    ? (pendingPausedValue === true || pendingPausedValue === 1
       || pendingPausedValue === 'true' || pendingPausedValue === '1')
    : null;

  /* ── Treasury balance ───────────────────────────────────────────────── */
  const treasuryBalance = useMemo(() => {
    if (mintConfig?.data?.content?.dataType !== 'moveObject') return '0.0000';
    const f = mintConfig.data.content.fields as any;
    const raw = f.treasury?.fields?.value ?? f.treasury ?? '0';
    return (Number(String(raw)) / Number(MIST_PER_SUI)).toFixed(4);
  }, [mintConfig]);

  /* ── Sync chain → inputs ────────────────────────────────────────────── */
  useEffect(() => {
    if (mintConfig?.data?.content?.dataType !== 'moveObject') return;
    const f = mintConfig.data.content.fields as any;
    const alPriceMist = f.allowlist_price_mist ?? '0';
    const feeRaw      = f.mint_fee?.fields?.current_value ?? f.mint_fee ?? '0';
    const royaltyRaw  = f.royalty_bps?.fields?.current_value ?? f.royalty_bps ?? '0';
    setFeeInputs({
      allowlist: (Number(String(alPriceMist)) / Number(MIST_PER_SUI)).toString(),
      public:    (Number(String(feeRaw))      / Number(MIST_PER_SUI)).toString(),
    });
    setRoyaltyInput(String(royaltyRaw));
    setMaxPerWalletAllowlist(String(f.max_per_wallet_allowlist ?? '3'));
    setMaxPerWalletPublic(String(f.max_per_wallet_public ?? '3'));
  }, [mintConfig]);

  /* ── handleAction ───────────────────────────────────────────────────── */
  const handleAction = async (action: string, params: any = {}) => {
    if (!account) return;
    setLoading(true);
    try {
      const tx = new Transaction();
      const adminCapId = adminCapData?.data?.[0]?.data?.objectId;
      if (!adminCapId) throw new Error('AdminCap not found in wallet');

      switch (action) {

        case 'Withdraw': {
          const [coin] = tx.moveCall({
            target: `${PACKAGE_ID}::mint::withdraw_treasury`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID)],
          });
          tx.transferObjects([coin], tx.pure.address(account.address));
          break;
        }

        case 'WithdrawAmount': {
          const amtMist = BigInt(Math.floor(Number(withdrawAmount) * Number(MIST_PER_SUI)));
          const [coin] = tx.moveCall({
            target: `${PACKAGE_ID}::mint::withdraw_treasury_amount`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u64(amtMist)],
          });
          tx.transferObjects([coin], tx.pure.address(account.address));
          break;
        }

        case 'SetPhase':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::set_phase`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u8(params.phase)],
          });
          break;

        case 'SetAllowlistRoot': {
          const rootHex = allowlistRoot.replace(/^0x/, '');
          const rootBytes: number[] = [];
          for (let i = 0; i < rootHex.length; i += 2) {
            rootBytes.push(parseInt(rootHex.slice(i, i + 2), 16));
          }
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::set_allowlist_root`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.vector('u8', rootBytes)],
          });
          break;
        }

        case 'SetAllowlistPrice': {
          const priceMist = BigInt(Math.floor(Number(feeInputs.allowlist) * Number(MIST_PER_SUI)));
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::set_allowlist_price`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u64(priceMist)],
          });
          break;
        }

        case 'SetMaxPerWalletAllowlist':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::set_max_per_wallet_allowlist`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u64(Number(maxPerWalletAllowlist))],
          });
          break;

        case 'SetMaxPerWalletPublic':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::set_max_per_wallet_public`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u64(Number(maxPerWalletPublic))],
          });
          break;

        case 'ProposeFee': {
          const feeMist = BigInt(Math.floor(Number(feeInputs.public) * Number(MIST_PER_SUI)));
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::propose_mint_fee`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u64(feeMist)],
          });
          break;
        }

        case 'ExecuteFee':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::execute_mint_fee`,
            arguments: [tx.object(MINT_CONFIG_ID)],
          });
          break;

        case 'ProposePause':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::propose_paused`,
            arguments: [
              tx.object(adminCapId),
              tx.object(MINT_CONFIG_ID),
              tx.pure.bool(params.paused ?? true),
            ],
          });
          break;

        case 'ExecutePause':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::execute_paused`,
            arguments: [tx.object(MINT_CONFIG_ID)],
          });
          break;

        case 'ProposeRoyalty': {
          const bps = Math.min(5000, Math.max(0, Math.round(Number(royaltyInput))));
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::propose_royalty_bps`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.u16(bps)],
          });
          break;
        }

        case 'ExecuteRoyalty':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::execute_royalty_bps`,
            arguments: [tx.object(MINT_CONFIG_ID)],
          });
          break;

        case 'MultiSigVote':
          if (!MULTISIG_ADMIN_CAP_ID || !multisigProposalId) {
            toast.error('MultiSig cap or proposal ID missing.');
            setLoading(false);
            return;
          }
          tx.moveCall({
            target: `${PACKAGE_ID}::multisig_admin::vote`,
            arguments: [
              tx.object(MULTISIG_ADMIN_CAP_ID),
              tx.pure.id(multisigProposalId),
              tx.pure.bool(multisigApprove),
            ],
          });
          break;

        case 'MultiSigProposeFee': {
          if (!MULTISIG_ADMIN_CAP_ID) {
            toast.error('MULTISIG_ADMIN_CAP_ID not configured in .env');
            setLoading(false);
            return;
          }
          const msFeeMist = BigInt(Math.floor(Number(multisigNewFee) * Number(MIST_PER_SUI)));
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::propose_mint_fee_multisig`,
            arguments: [
              tx.object(MULTISIG_ADMIN_CAP_ID),
              tx.object(MINT_CONFIG_ID),
              tx.pure.u64(msFeeMist),
            ],
          });
          break;
        }

        case 'SetupRewardVault':
          if (!REWARD_MINT_CAP_ID) {
            toast.error('REWARD_MINT_CAP_ID not configured in .env');
            setLoading(false);
            return;
          }
          tx.moveCall({
            target: `${PACKAGE_ID}::reward_vault::init_vault`,
            arguments: [
              tx.object(adminCapId),
              tx.object(REWARD_MINT_CAP_ID),
              tx.pure.u64(BigInt(Math.floor(Number(setupMaxSupply) * 1e9))),
            ],
          });
          break;

        case 'SetupStakingPool':
          tx.moveCall({
            target: `${PACKAGE_ID}::staking::setup_pool`,
            arguments: [tx.object(adminCapId), tx.pure.u64(Number(setupRewardRate))],
          });
          break;

        case 'SetupMarketplace':
          tx.moveCall({
            target: `${PACKAGE_ID}::marketplace::setup_marketplace`,
            arguments: [
              tx.object(adminCapId),
              tx.pure.u16(Number(setupMarketFee)),
              tx.pure.u64(Number(setupMarketExpiry)),
            ],
          });
          break;

        case 'CreateDutchAuction': {
          const startMist = BigInt(Math.floor(Number(setupAuctionStart) * 1e9));
          const floorMist = BigInt(Math.floor(Number(setupAuctionFloor) * 1e9));
          tx.moveCall({
            target: `${PACKAGE_ID}::dutch_auction::create_auction`,
            arguments: [
              tx.object(adminCapId),
              tx.object(MINT_CONFIG_ID),
              tx.pure.u64(startMist),
              tx.pure.u64(floorMist),
              tx.pure.u64(Number(setupAuctionDecay)),
              tx.pure.u64(Number(setupAuctionUnits)),
            ],
          });
          break;
        }

        case 'HaltProtocol':
          tx.moveCall({
            target: `${PACKAGE_ID}::mint::propose_paused`,
            arguments: [tx.object(adminCapId), tx.object(MINT_CONFIG_ID), tx.pure.bool(true)],
          });
          break;

        default:
          toast.error(`Unknown action: ${action}`);
          setLoading(false);
          return;
      }

      signAndExecute(
        { transaction: tx },
        {
          onSuccess: () => {
            toast.success(`${action} executed on-chain.`);
            setConfirmConfig(prev => ({ ...prev, isOpen: false }));
          },
          onError: (e) => toast.error(`Transaction failed: ${e.message}`),
          onSettled: () => setLoading(false),
        }
      );
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Action failed.');
      setLoading(false);
    }
  };

  /* ── Feedback Helpers ───────────────────────────────────────────────── */
  const saveFeedbackKey = () => {
    const k = adminKeyInput.trim();
    if (!k) return;
    sessionStorage.setItem('adminApiKey', k);
    setAdminKey(k);
    setAdminKeySet(true);
  };

  const clearFeedbackKey = () => {
    sessionStorage.removeItem('adminApiKey');
    setAdminKey('');
    setAdminKeyInput('');
    setAdminKeySet(false);
    setFeedbackItems([]);
    setFeedbackStats(null);
  };

  const loadFeedback = async (page = 1) => {
    if (!adminKey) return;
    setFeedbackLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        listFeedback(adminKey, {
          page,
          limit: FEEDBACK_PAGE_LIMIT,
          status:   feedbackFilter.status   as FeedbackStatus | undefined || undefined,
          category: feedbackFilter.category as any || undefined,
          priority: feedbackFilter.priority as FeedbackPriority | undefined || undefined,
          search:   feedbackFilter.search || undefined,
        }),
        getFeedbackStats(adminKey),
      ]);
      setFeedbackItems(listRes.data);
      setFeedbackTotal(listRes.total);
      setFeedbackPage(page);
      setFeedbackStats(statsRes);
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) {
        toast.error('Invalid admin key. Please re-enter.');
        clearFeedbackKey();
      } else {
        toast.error('Failed to load feedback: ' + err.message);
      }
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleUpdateFeedback = async (
    id: string,
    patch: { status?: FeedbackStatus; adminNotes?: string; priority?: FeedbackPriority }
  ) => {
    if (!adminKey) return;
    try {
      const updated = await updateFeedback(adminKey, id, patch);
      setFeedbackItems(prev => prev.map(f => f.id === id ? updated : f));
      if (selectedFeedback?.id === id) setSelectedFeedback(updated);
      toast.success('Feedback updated.');
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!adminKey) return;
    if (!window.confirm('Permanently delete this feedback item?')) return;
    try {
      await deleteFeedback(adminKey, id);
      setFeedbackItems(prev => prev.filter(f => f.id !== id));
      if (selectedFeedback?.id === id) setSelectedFeedback(null);
      setFeedbackTotal(prev => prev - 1);
      toast.success('Feedback deleted.');
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  /* ── Guards ─────────────────────────────────────────────────────────── */
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
            Administrative access denied. Sign-in with an authorized principal wallet containing the{' '}
            <span className="text-white">AdminCap</span> metadata.
          </p>
        </div>
      </div>
    );
  }

  const TABS = ['PHASES', 'FEES', 'ROYALTIES', 'ALLOWLIST', 'TIMELOCK', 'MULTISIG', 'SETUP', 'SYSTEM', 'FEEDBACK'];

  /* ── Main render ─────────────────────────────────────────────────────── */
  return (
    <div className="max-w-[1600px] mx-auto min-h-screen border-x border-white/10 grid grid-cols-1 lg:grid-cols-12 bg-black">

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-white/10 p-6 md:p-10 lg:p-14 space-y-12 md:space-y-20 bg-white/1">
        <div className="space-y-10">
          <div className="flex items-center gap-4 text-white">
            <Terminal className="w-4 h-4 text-white/40" />
            <span className="text-[10px] font-medium tracking-[0.4em] uppercase">ADMIN_TERMINAL</span>
          </div>
          <div className="space-y-3">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab.toLowerCase())}
                className={`w-full group flex items-center justify-between py-2 border-b transition-all duration-300 uppercase tracking-[0.4em] text-[10px] ${
                  activeTab === tab.toLowerCase()
                    ? 'border-white text-white'
                    : 'border-white/5 text-white/20 hover:text-white/40 hover:border-white/20'
                }`}
              >
                {tab}
                <ArrowRight className={`w-3 h-3 transition-all ${
                  activeTab === tab.toLowerCase()
                    ? 'translate-x-0 opacity-100'
                    : '-translate-x-2 opacity-0 group-hover:opacity-40'
                }`} />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8 pt-8 border-t border-white/10">
          <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">TREASURY_BALANCE</p>
          <div className="space-y-3">
            <p className="text-4xl font-light tracking-tighter text-white">
              {treasuryBalance} <span className="text-sm text-white/20">SUI</span>
            </p>
            <div className={`flex items-center gap-2 ${isPaused ? 'text-red-500' : 'text-emerald-500'}`}>
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isPaused ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-[9px] tracking-[0.3em] uppercase">
                {isPaused ? 'PROTOCOL_PAUSED' : 'PROTOCOL_ACTIVE'}
              </span>
            </div>
          </div>
          <button
            onClick={() =>
              setConfirmConfig({
                isOpen: true,
                title: 'TREASURY_WITHDRAWAL',
                message: `Authorize withdrawal of all ${treasuryBalance} SUI to the administrator wallet.`,
                onConfirm: () => handleAction('Withdraw'),
              })
            }
            disabled={loading}
            className="w-full py-4 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50"
          >
            WITHDRAW_FUNDS
          </button>
        </div>
      </div>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <div className="lg:col-span-9 p-6 md:p-12 lg:p-24 space-y-16 md:space-y-24">
        <AnimatePresence mode="wait">

          {/* ════════════════ PHASES ════════════════ */}
          {activeTab === 'phases' && (
            <motion.div
              key="phases"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <div className="flex items-center gap-4 text-emerald-500">
                  <Activity className="w-4 h-4" />
                  <span className="text-[10px] font-medium tracking-[0.4em] uppercase">MODULE_STATUS: VERIFIED</span>
                </div>
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  PHASE<br /><span className="text-white/20">SCHEDULER</span>
                </h1>
                <p className="text-lg md:text-xl text-white/40 font-light leading-relaxed max-w-2xl">
                  Update the cryptographically enforced minting cycles. Changes are permanent upon finalization.
                </p>
              </div>

              <div className="divide-y border border-white/10 divide-white/10">
                {[
                  { id: 0, name: 'Cycle 0: Preparation',  desc: 'Protocol initialized. Public minting deactivated.' },
                  { id: 1, name: 'Cycle 1: Contributors', desc: 'Allowlisted identifiers only.' },
                  { id: 2, name: 'Cycle 2: Distribution', desc: 'Global public access enabled.' },
                ].map((p) => {
                  const isActive = currentPhase === p.id;
                  return (
                    <div
                      key={p.id}
                      className={`grid grid-cols-1 md:grid-cols-4 items-center p-8 md:p-12 gap-6 md:gap-0 transition-all group ${
                        isActive ? 'bg-emerald-500/5' : 'hover:bg-white/1'
                      }`}
                    >
                      <div className="md:col-span-2 space-y-3">
                        <p className="text-[10px] font-medium tracking-[0.2em] text-white/20 uppercase">INDEX_0{p.id}</p>
                        <h4 className="text-xl font-light tracking-tight text-white uppercase">{p.name}</h4>
                        <p className="text-[11px] text-white/40 leading-relaxed font-light uppercase tracking-widest">{p.desc}</p>
                      </div>
                      <div className="flex justify-start md:justify-center">
                        <div className={`px-4 py-1 border text-[9px] font-medium tracking-[0.4em] uppercase ${
                          isActive
                            ? 'border-emerald-500/50 text-emerald-500 bg-emerald-500/5'
                            : 'border-white/10 text-white/10'
                        }`}>
                          {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </div>
                      </div>
                      <div className="flex justify-start md:justify-end">
                        {!isActive && (
                          <button
                            onClick={() => setConfirmConfig({
                              isOpen: true,
                              title: 'MODIFY_PROTOCOL_PHASE',
                              message: `Enforce "${p.name}" as the active distribution cycle?`,
                              onConfirm: () => handleAction('SetPhase', { phase: p.id }),
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

              {/* Max per wallet — immediate */}
              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">MAX_PER_WALLET</p>
                  <p className="text-[9px] text-white/30 font-light leading-relaxed uppercase tracking-widest">
                    Immediate — set maximum mint limits per wallet for each cycle.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border border-white/10 divide-white/10 bg-white/1">
                  <div className="p-8 md:p-10 space-y-6 group">
                    <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">CYCLE_1_LIMIT</label>
                    <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                      <input
                        type="number"
                        value={maxPerWalletAllowlist}
                        onChange={(e) => setMaxPerWalletAllowlist(e.target.value)}
                        className="w-full py-3 bg-transparent focus:outline-none font-light text-4xl md:text-5xl tracking-tighter text-white"
                      />
                    </div>
                    <button
                      onClick={() => handleAction('SetMaxPerWalletAllowlist')}
                      disabled={loading}
                      className="w-full py-4 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                    >
                      SET_ALLOWLIST_MAX
                    </button>
                  </div>
                  <div className="p-8 md:p-10 space-y-6 group">
                    <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">CYCLE_2_LIMIT</label>
                    <div className="relative border-b border-white/10 group-focus-within:border-white transition-all">
                      <input
                        type="number"
                        value={maxPerWalletPublic}
                        onChange={(e) => setMaxPerWalletPublic(e.target.value)}
                        className="w-full py-3 bg-transparent focus:outline-none font-light text-4xl md:text-5xl tracking-tighter text-white"
                      />
                    </div>
                    <button
                      onClick={() => handleAction('SetMaxPerWalletPublic')}
                      disabled={loading}
                      className="w-full py-4 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                    >
                      SET_PUBLIC_MAX
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════ FEES ════════════════ */}
          {activeTab === 'fees' && (
            <motion.div
              key="fees"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  FEE<br /><span className="text-white/20">ENGINE</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  TimeLocked fee management. Propose changes that execute after the lock period elapses.
                </p>
              </div>

              {/* Current state display */}
              <div className="grid grid-cols-2 divide-x border border-white/10 divide-white/10 bg-white/1">
                <div className="p-8 md:p-10 space-y-3">
                  <p className="text-[10px] tracking-[0.4em] text-white/20 uppercase">CURRENT_FEE</p>
                  <p className="text-3xl font-light text-white">
                    {(Number(String(currentMintFee)) / 1e9).toFixed(4)}{' '}
                    <span className="text-sm text-white/20">SUI</span>
                  </p>
                  {pendingMintFeeValue && (
                    <div className="flex items-center gap-2 pt-1">
                      <Clock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      <span className="text-[9px] text-yellow-500 tracking-[0.3em] uppercase">
                        PENDING: {(Number(pendingMintFeeValue) / 1e9).toFixed(4)} SUI
                        {mintFeePendingEpoch ? ` — EP.${mintFeePendingEpoch}` : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-8 md:p-10 space-y-3">
                  <p className="text-[10px] tracking-[0.4em] text-white/20 uppercase">LOCK_WINDOW</p>
                  <p className="text-3xl font-light text-white">
                    {mintFeeLockEpochs} <span className="text-sm text-white/20">EPOCHS</span>
                  </p>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">MIN LOCK PERIOD</p>
                </div>
              </div>

              {/* Propose new fee */}
              <div className="space-y-6">
                <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PROPOSE_NEW_FEE — CYCLE_2</p>
                <div className="border border-white/10 bg-white/1 p-8 md:p-10 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">NEW_MINT_FEE (SUI)</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all mt-4">
                    <input
                      type="number"
                      value={feeInputs.public}
                      onChange={(e) => setFeeInputs(p => ({ ...p, public: e.target.value }))}
                      className="w-full py-4 bg-transparent focus:outline-none font-light text-5xl md:text-6xl tracking-tighter text-white"
                    />
                    <span className="absolute right-0 bottom-4 text-white/10 font-light text-xl uppercase tracking-widest">SUI</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: 'PROPOSE_MINT_FEE',
                      message: `Propose new mint fee of ${feeInputs.public} SUI. Becomes active after the ${mintFeeLockEpochs}-epoch lock period.`,
                      onConfirm: () => handleAction('ProposeFee'),
                    })}
                    disabled={loading}
                    className="py-6 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50"
                  >
                    PROPOSE_FEE
                  </button>
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: 'EXECUTE_MINT_FEE',
                      message: `Execute pending fee change to ${pendingMintFeeValue ? (Number(pendingMintFeeValue) / 1e9).toFixed(4) : '?'} SUI. Will abort if lock period has not elapsed.`,
                      onConfirm: () => handleAction('ExecuteFee'),
                    })}
                    disabled={!pendingMintFeeValue || loading}
                    className={`py-6 border text-[10px] font-medium tracking-[0.4em] uppercase transition-all ${
                      pendingMintFeeValue
                        ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black'
                        : 'border-white/10 text-white/20 cursor-not-allowed'
                    }`}
                  >
                    EXECUTE_FEE
                  </button>
                </div>
              </div>

              {/* Allowlist price — immediate */}
              <div className="space-y-6 pt-8 border-t border-white/10">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">CYCLE_1_PRICE — IMMEDIATE</p>
                  <p className="text-[9px] text-white/20 tracking-widest uppercase">No timelock. Takes effect immediately on-chain.</p>
                </div>
                <div className="border border-white/10 bg-white/1 p-8 md:p-10 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">ALLOWLIST_PRICE (SUI)</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all mt-4">
                    <input
                      type="number"
                      value={feeInputs.allowlist}
                      onChange={(e) => setFeeInputs(p => ({ ...p, allowlist: e.target.value }))}
                      className="w-full py-4 bg-transparent focus:outline-none font-light text-5xl md:text-6xl tracking-tighter text-white"
                    />
                    <span className="absolute right-0 bottom-4 text-white/10 font-light text-xl uppercase tracking-widest">SUI</span>
                  </div>
                </div>
                <button
                  onClick={() => handleAction('SetAllowlistPrice')}
                  disabled={loading}
                  className="w-full py-6 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-50"
                >
                  SET_ALLOWLIST_PRICE
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════ ROYALTIES ════════════════ */}
          {activeTab === 'royalties' && (
            <motion.div
              key="royalties"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  ROYALTY<br /><span className="text-white/20">CONFIG</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  TimeLocked secondary market royalty enforcement. Propose and execute BPS changes.
                </p>
              </div>

              {/* Current state */}
              <div className="grid grid-cols-2 divide-x border border-white/10 divide-white/10 bg-white/1">
                <div className="p-8 md:p-10 space-y-3">
                  <p className="text-[10px] tracking-[0.4em] text-white/20 uppercase">CURRENT_ROYALTY</p>
                  <p className="text-3xl font-light text-white">
                    {currentRoyalty} <span className="text-sm text-white/20">BPS</span>
                  </p>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">
                    = {(Number(String(currentRoyalty)) / 100).toFixed(2)}% SECONDARY FEE
                  </p>
                  {pendingRoyaltyValue && (
                    <div className="flex items-center gap-2 pt-1">
                      <Clock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      <span className="text-[9px] text-yellow-500 tracking-[0.3em] uppercase">
                        PENDING: {pendingRoyaltyValue} BPS
                        {royaltyPendingEpoch ? ` — EP.${royaltyPendingEpoch}` : ''}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-8 md:p-10 space-y-3">
                  <p className="text-[10px] tracking-[0.4em] text-white/20 uppercase">CONSTRAINT</p>
                  <p className="text-3xl font-light text-white">5000 <span className="text-sm text-white/20">BPS MAX</span></p>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">= 50.00% MAXIMUM</p>
                </div>
              </div>

              {/* Propose */}
              <div className="space-y-6">
                <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PROPOSE_ROYALTY_BPS</p>
                <div className="border border-white/10 bg-white/1 p-8 md:p-10 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">BASIS_POINTS (0–5000)</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all mt-4">
                    <input
                      type="number"
                      value={royaltyInput}
                      onChange={(e) => setRoyaltyInput(e.target.value)}
                      min={0}
                      max={5000}
                      className="w-full py-4 bg-transparent focus:outline-none font-light text-5xl md:text-6xl tracking-tighter text-white"
                    />
                    <span className="absolute right-0 bottom-4 text-white/10 font-light text-xl uppercase tracking-widest">BPS</span>
                  </div>
                  <p className="mt-3 text-[9px] font-light uppercase tracking-widest text-white/30">
                    = {(Number(royaltyInput || '0') / 100).toFixed(2)}% SECONDARY MARKET FEE
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: 'PROPOSE_ROYALTY_BPS',
                      message: `Propose royalty change to ${royaltyInput} BPS (${(Number(royaltyInput || '0') / 100).toFixed(2)}%). Takes effect after the lock period.`,
                      onConfirm: () => handleAction('ProposeRoyalty'),
                    })}
                    disabled={loading}
                    className="py-6 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50"
                  >
                    PROPOSE_ROYALTY
                  </button>
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: 'EXECUTE_ROYALTY_BPS',
                      message: `Execute pending royalty change to ${pendingRoyaltyValue ?? '?'} BPS. Will abort if lock period has not elapsed.`,
                      onConfirm: () => handleAction('ExecuteRoyalty'),
                    })}
                    disabled={!pendingRoyaltyValue || loading}
                    className={`py-6 border text-[10px] font-medium tracking-[0.4em] uppercase transition-all ${
                      pendingRoyaltyValue
                        ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black'
                        : 'border-white/10 text-white/20 cursor-not-allowed'
                    }`}
                  >
                    EXECUTE_ROYALTY
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════ ALLOWLIST ════════════════ */}
          {activeTab === 'allowlist' && (
            <motion.div
              key="allowlist"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  ROOT<br /><span className="text-white/20">VAULT</span>
                </h1>
                <p className="text-lg md:text-xl text-white/40 font-light leading-relaxed max-w-2xl uppercase">
                  Manage the cryptographic Merkle root for allowlisted identifiers.
                </p>
              </div>

              {/* Merkle root input */}
              <div className="space-y-6">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">MERKLE_ROOT — IMMEDIATE</p>
                  <p className="text-[9px] text-white/20 tracking-widest uppercase">32-byte hex (0x-prefixed or raw). Takes effect immediately.</p>
                </div>
                <div className="border border-white/10 bg-white/1 p-8 md:p-10 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">ROOT_HASH (HEX)</label>
                  <div className="border-b border-white/10 group-focus-within:border-white transition-all mt-4">
                    <input
                      type="text"
                      value={allowlistRoot}
                      onChange={(e) => setAllowlistRoot(e.target.value)}
                      placeholder="0xabc123..."
                      className="w-full py-4 bg-transparent focus:outline-none font-mono text-sm text-white placeholder:text-white/10"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'SET_ALLOWLIST_ROOT',
                    message: 'Update the Merkle root for allowlist verification. Only allowlisted addresses will be able to mint during Cycle 1.',
                    onConfirm: () => handleAction('SetAllowlistRoot'),
                  })}
                  disabled={loading || !allowlistRoot}
                  className="w-full py-6 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50"
                >
                  SET_ALLOWLIST_ROOT
                </button>
              </div>

              {/* Generation guide */}
              <div className="p-12 md:p-20 border-2 border-dashed border-white/5 bg-white/1 flex flex-col items-center justify-center space-y-8 text-center group hover:border-white/20 transition-all">
                <div className="w-16 h-16 rounded-full border border-white/10 flex items-center justify-center text-white/20 group-hover:text-white/40 transition-all">
                  <Upload className="w-6 h-6" />
                </div>
                <div className="space-y-3">
                  <p className="text-lg font-light tracking-tight text-white uppercase">GENERATE_ROOT_OFFLINE</p>
                  <p className="text-[10px] text-white/20 font-medium uppercase tracking-[0.4em]">
                    Use a Merkle tree tool on your allowlist CSV, then paste the 32-byte root hash above.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════ TIMELOCK ════════════════ */}
          {activeTab === 'timelock' && (
            <motion.div
              key="timelock"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <div className="flex items-center gap-4 text-yellow-500">
                  <Lock className="w-4 h-4" />
                  <span className="text-[10px] font-medium tracking-[0.4em] uppercase">TIMELOCK_ENGINE: ACTIVE</span>
                </div>
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  TIMELOCK<br /><span className="text-white/20">STATUS</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  Monitor all pending parameter changes. Execute once the lock period has elapsed.
                </p>
              </div>

              {/* Status grid */}
              <div className="divide-y border border-white/10 divide-white/10">
                {[
                  {
                    label:       'MINT_FEE',
                    current:     `${(Number(String(currentMintFee)) / 1e9).toFixed(4)} SUI`,
                    pending:     pendingMintFeeValue
                                   ? `${(Number(pendingMintFeeValue) / 1e9).toFixed(4)} SUI`
                                   : null,
                    pendingEp:   mintFeePendingEpoch,
                    lockEpochs:  mintFeeLockEpochs,
                    execAction:  'ExecuteFee',
                    canExecute:  !!pendingMintFeeValue,
                  },
                  {
                    label:       'PAUSED',
                    current:     isPaused ? 'TRUE' : 'FALSE',
                    pending:     pendingPausedBool !== null
                                   ? (pendingPausedBool ? 'PAUSED' : 'ACTIVE')
                                   : null,
                    pendingEp:   pausedPendingEpoch,
                    lockEpochs:  2,
                    execAction:  'ExecutePause',
                    canExecute:  pendingPausedBool !== null,
                  },
                  {
                    label:       'ROYALTY_BPS',
                    current:     `${currentRoyalty} BPS`,
                    pending:     pendingRoyaltyValue ? `${pendingRoyaltyValue} BPS` : null,
                    pendingEp:   royaltyPendingEpoch,
                    lockEpochs:  2,
                    execAction:  'ExecuteRoyalty',
                    canExecute:  !!pendingRoyaltyValue,
                  },
                ].map((row) => (
                  <div key={row.label} className="grid grid-cols-1 md:grid-cols-5 items-center p-8 md:p-10 gap-6">
                    <div className="md:col-span-1">
                      <p className="text-[10px] font-medium tracking-[0.4em] uppercase text-white/40">{row.label}</p>
                    </div>
                    <div className="md:col-span-1">
                      <p className="text-base font-light text-white">{row.current}</p>
                      <p className="text-[9px] text-white/20 uppercase tracking-widest mt-1">ACTIVE</p>
                    </div>
                    <div className="md:col-span-1">
                      {row.pending ? (
                        <div>
                          <p className="text-base font-light text-yellow-500">{row.pending}</p>
                          <p className="text-[9px] text-yellow-500/60 uppercase tracking-widest mt-1">
                            PENDING{row.pendingEp ? ` EP.${row.pendingEp}` : ''}
                          </p>
                        </div>
                      ) : (
                        <p className="text-[9px] text-white/10 uppercase tracking-widest">NO_PENDING</p>
                      )}
                    </div>
                    <div className="md:col-span-1">
                      <p className="text-[9px] text-white/20 uppercase tracking-widest">+{row.lockEpochs} EPOCHS</p>
                    </div>
                    <div className="md:col-span-1 flex md:justify-end">
                      <button
                        onClick={() => handleAction(row.execAction)}
                        disabled={!row.canExecute || loading}
                        className={`px-6 py-3 border text-[9px] font-medium tracking-[0.3em] uppercase transition-all ${
                          row.canExecute
                            ? 'border-emerald-500 text-emerald-500 hover:bg-emerald-500 hover:text-black'
                            : 'border-white/5 text-white/10 cursor-not-allowed'
                        }`}
                      >
                        EXECUTE
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Propose pause / unpause */}
              <div className="space-y-6 pt-4 border-t border-white/10">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PROPOSE_PAUSE_STATE</p>
                  <p className="text-[9px] text-white/20 tracking-widest uppercase">
                    Creates a TimeLocked proposal. Execute from the PAUSED row above after the lock period.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: 'PROPOSE_PAUSE',
                      message: 'Propose pausing all protocol operations. After the lock period elapses, execute the PAUSED row above to freeze all minting.',
                      isDangerous: true,
                      onConfirm: () => handleAction('ProposePause', { paused: true }),
                    })}
                    disabled={loading}
                    className="py-6 border border-red-500/40 text-red-500/80 text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-red-500 hover:text-white hover:border-red-500 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <Pause className="w-4 h-4" />
                    PROPOSE_PAUSE
                  </button>
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: 'PROPOSE_UNPAUSE',
                      message: 'Propose resuming protocol operations. After the lock period elapses, execute the PAUSED row above to restore minting.',
                      onConfirm: () => handleAction('ProposePause', { paused: false }),
                    })}
                    disabled={loading}
                    className="py-6 border border-emerald-500/40 text-emerald-500/80 text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-emerald-500 hover:text-black hover:border-emerald-500 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    <Play className="w-4 h-4" />
                    PROPOSE_UNPAUSE
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* ════════════════ MULTISIG ════════════════ */}
          {activeTab === 'multisig' && (
            <motion.div
              key="multisig"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <div className="flex items-center gap-4 text-white/40">
                  <Users className="w-4 h-4" />
                  <span className="text-[10px] font-medium tracking-[0.4em] uppercase">MULTI-SIGNATURE GOVERNANCE</span>
                </div>
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  MULTISIG<br /><span className="text-white/20">COUNCIL</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  Governance actions requiring multi-signer approval. All signers must reach threshold before execution.
                </p>
              </div>

              {/* Cap ID status */}
              <div className="p-8 md:p-10 border border-white/10 bg-white/1 space-y-4">
                <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">MULTISIG_CAP_ID</p>
                {MULTISIG_ADMIN_CAP_ID ? (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-mono text-white/60 break-all">{MULTISIG_ADMIN_CAP_ID}</p>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                    <p className="text-[10px] text-white/40 uppercase tracking-widest">NOT CONFIGURED — SET VITE_MULTISIG_ADMIN_CAP_ID IN .ENV</p>
                  </div>
                )}
              </div>

              {/* Vote on proposal */}
              <div className="space-y-6">
                <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">VOTE_ON_PROPOSAL</p>
                <div className="border border-white/10 bg-white/1 divide-y divide-white/10">
                  <div className="p-8 md:p-10 space-y-4 group">
                    <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PROPOSAL_OBJECT_ID</label>
                    <div className="border-b border-white/10 group-focus-within:border-white transition-all">
                      <input
                        type="text"
                        value={multisigProposalId}
                        onChange={(e) => setMultisigProposalId(e.target.value)}
                        placeholder="0x..."
                        className="w-full py-3 bg-transparent focus:outline-none font-mono text-sm text-white placeholder:text-white/10"
                      />
                    </div>
                  </div>
                  <div className="p-8 md:p-10 space-y-4">
                    <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">VOTE_DIRECTION</label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setMultisigApprove(true)}
                        className={`py-4 border text-[10px] font-medium tracking-[0.4em] uppercase transition-all ${
                          multisigApprove
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                            : 'border-white/10 text-white/20 hover:border-white/30 hover:text-white/40'
                        }`}
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => setMultisigApprove(false)}
                        className={`py-4 border text-[10px] font-medium tracking-[0.4em] uppercase transition-all ${
                          !multisigApprove
                            ? 'border-red-500 bg-red-500/10 text-red-500'
                            : 'border-white/10 text-white/20 hover:border-white/30 hover:text-white/40'
                        }`}
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleAction('MultiSigVote')}
                  disabled={loading || !multisigProposalId || !MULTISIG_ADMIN_CAP_ID}
                  className="w-full py-6 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50"
                >
                  SUBMIT_VOTE
                </button>
              </div>

              {/* Propose fee change via multisig */}
              <div className="space-y-6 pt-8 border-t border-white/10">
                <div className="space-y-1">
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PROPOSE_FEE_CHANGE</p>
                  <p className="text-[9px] text-white/20 tracking-widest uppercase">
                    Creates a governance proposal. Requires threshold approval from all signers before execution.
                  </p>
                </div>
                <div className="border border-white/10 bg-white/1 p-8 md:p-10 group">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PROPOSED_FEE (SUI)</label>
                  <div className="relative border-b border-white/10 group-focus-within:border-white transition-all mt-4">
                    <input
                      type="number"
                      value={multisigNewFee}
                      onChange={(e) => setMultisigNewFee(e.target.value)}
                      className="w-full py-4 bg-transparent focus:outline-none font-light text-5xl md:text-6xl tracking-tighter text-white"
                    />
                    <span className="absolute right-0 bottom-4 text-white/10 font-light text-xl uppercase tracking-widest">SUI</span>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'MULTISIG_PROPOSE_FEE',
                    message: `Create a multisig governance proposal to change the mint fee to ${multisigNewFee} SUI. Other signers must vote to reach approval threshold.`,
                    onConfirm: () => handleAction('MultiSigProposeFee'),
                  })}
                  disabled={loading || !multisigNewFee || !MULTISIG_ADMIN_CAP_ID}
                  className="w-full py-6 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-50"
                >
                  PROPOSE_FEE_CHANGE
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════ SETUP ════════════════ */}
          {activeTab === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <div className="flex items-center gap-4 text-white/40">
                  <Settings className="w-4 h-4" />
                  <span className="text-[10px] font-medium tracking-[0.4em] uppercase">ONE_TIME_INITIALIZATION</span>
                </div>
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  SETUP<br /><span className="text-white/20">MODULES</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  One-time protocol initialization. Call each after deployment to activate subsystems.
                </p>
              </div>

              {/* Status overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'REWARD_VAULT',  configured: !!REWARD_VAULT_ID },
                  { label: 'STAKING_POOL',  configured: !!STAKING_POOL_ID },
                  { label: 'MARKETPLACE',   configured: !!MARKETPLACE_CONFIG_ID },
                  { label: 'DUTCH_AUCTION', configured: !!DUTCH_AUCTION_ID },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`p-5 border text-center space-y-3 ${
                      item.configured ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-white/10'
                    }`}
                  >
                    <div className="flex justify-center">
                      {item.configured
                        ? <CheckCircle className="w-4 h-4 text-emerald-500" />
                        : <XCircle className="w-4 h-4 text-white/20" />}
                    </div>
                    <p className="text-[8px] font-medium tracking-[0.3em] uppercase text-white/40">{item.label}</p>
                    <p className={`text-[8px] tracking-widest uppercase ${item.configured ? 'text-emerald-500' : 'text-white/20'}`}>
                      {item.configured ? 'CONFIGURED' : 'PENDING'}
                    </p>
                  </div>
                ))}
              </div>

              {/* 01 — Reward Vault */}
              <div className="border border-white/10 p-8 md:p-10 bg-white/1 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">01 — REWARD_VAULT</p>
                    <p className="text-[9px] text-white/20 tracking-widest uppercase">reward_vault::init_vault — wraps RewardMintCap into vault</p>
                  </div>
                  {REWARD_VAULT_ID
                    ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    : <Zap className="w-5 h-5 text-white/20 flex-shrink-0" />}
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">MAX_TOTAL_SUPPLY (TOKENS)</label>
                  <div className="border-b border-white/10 focus-within:border-white transition-all">
                    <input
                      type="number"
                      value={setupMaxSupply}
                      onChange={(e) => setSetupMaxSupply(e.target.value)}
                      className="w-full py-3 bg-transparent focus:outline-none font-light text-3xl tracking-tighter text-white"
                    />
                  </div>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">
                    0 = unlimited supply. Requires VITE_REWARD_MINT_CAP_ID in .env.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'INIT_REWARD_VAULT',
                    message: 'Initialize the reward vault with the RewardMintCap. This is a one-time irreversible operation.',
                    onConfirm: () => handleAction('SetupRewardVault'),
                  })}
                  disabled={loading || !REWARD_MINT_CAP_ID}
                  className="w-full py-5 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                >
                  INIT_VAULT
                </button>
              </div>

              {/* 02 — Staking Pool */}
              <div className="border border-white/10 p-8 md:p-10 bg-white/1 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">02 — STAKING_POOL</p>
                    <p className="text-[9px] text-white/20 tracking-widest uppercase">staking::setup_pool — creates StakingPool shared object</p>
                  </div>
                  {STAKING_POOL_ID
                    ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    : <Zap className="w-5 h-5 text-white/20 flex-shrink-0" />}
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">REWARD_RATE_PER_EPOCH</label>
                  <div className="border-b border-white/10 focus-within:border-white transition-all">
                    <input
                      type="number"
                      value={setupRewardRate}
                      onChange={(e) => setSetupRewardRate(e.target.value)}
                      className="w-full py-3 bg-transparent focus:outline-none font-light text-3xl tracking-tighter text-white"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'SETUP_STAKING_POOL',
                    message: `Create the StakingPool with reward rate ${setupRewardRate} per epoch. One-time operation.`,
                    onConfirm: () => handleAction('SetupStakingPool'),
                  })}
                  disabled={loading}
                  className="w-full py-5 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                >
                  SETUP_POOL
                </button>
              </div>

              {/* 03 — Marketplace */}
              <div className="border border-white/10 p-8 md:p-10 bg-white/1 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">03 — MARKETPLACE</p>
                    <p className="text-[9px] text-white/20 tracking-widest uppercase">marketplace::setup_marketplace — creates MarketplaceConfig</p>
                  </div>
                  {MARKETPLACE_CONFIG_ID
                    ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    : <Zap className="w-5 h-5 text-white/20 flex-shrink-0" />}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PLATFORM_FEE_BPS</label>
                    <div className="border-b border-white/10 focus-within:border-white transition-all">
                      <input
                        type="number"
                        value={setupMarketFee}
                        onChange={(e) => setSetupMarketFee(e.target.value)}
                        className="w-full py-3 bg-transparent focus:outline-none font-light text-3xl tracking-tighter text-white"
                      />
                    </div>
                    <p className="text-[9px] text-white/20 uppercase tracking-widest">
                      = {(Number(setupMarketFee || '0') / 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">DEFAULT_EXPIRY_EPOCHS</label>
                    <div className="border-b border-white/10 focus-within:border-white transition-all">
                      <input
                        type="number"
                        value={setupMarketExpiry}
                        onChange={(e) => setSetupMarketExpiry(e.target.value)}
                        className="w-full py-3 bg-transparent focus:outline-none font-light text-3xl tracking-tighter text-white"
                      />
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'SETUP_MARKETPLACE',
                    message: `Create MarketplaceConfig with ${setupMarketFee} BPS fee and ${setupMarketExpiry} epoch default expiry.`,
                    onConfirm: () => handleAction('SetupMarketplace'),
                  })}
                  disabled={loading}
                  className="w-full py-5 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                >
                  SETUP_MARKETPLACE
                </button>
              </div>

              {/* 04 — Dutch Auction */}
              <div className="border border-white/10 p-8 md:p-10 bg-white/1 space-y-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">04 — DUTCH_AUCTION</p>
                    <p className="text-[9px] text-white/20 tracking-widest uppercase">dutch_auction::create_auction — creates DutchAuction shared object</p>
                  </div>
                  {DUTCH_AUCTION_ID
                    ? <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    : <Zap className="w-5 h-5 text-white/20 flex-shrink-0" />}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                  {([
                    { label: 'START_PRICE (SUI)', value: setupAuctionStart, set: setSetupAuctionStart },
                    { label: 'FLOOR_PRICE (SUI)', value: setupAuctionFloor, set: setSetupAuctionFloor },
                    { label: 'DECAY_EPOCHS',       value: setupAuctionDecay, set: setSetupAuctionDecay },
                    { label: 'TOTAL_UNITS',         value: setupAuctionUnits, set: setSetupAuctionUnits },
                  ] as const).map((field) => (
                    <div key={field.label} className="space-y-3">
                      <label className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">{field.label}</label>
                      <div className="border-b border-white/10 focus-within:border-white transition-all">
                        <input
                          type="number"
                          value={field.value}
                          onChange={(e) => field.set(e.target.value)}
                          className="w-full py-3 bg-transparent focus:outline-none font-light text-2xl tracking-tighter text-white"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'CREATE_DUTCH_AUCTION',
                    message: `Create Dutch Auction: ${setupAuctionStart} SUI → ${setupAuctionFloor} SUI floor, ${setupAuctionDecay} epoch decay, ${setupAuctionUnits} total units.`,
                    onConfirm: () => handleAction('CreateDutchAuction'),
                  })}
                  disabled={loading}
                  className="w-full py-5 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                >
                  CREATE_AUCTION
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════ SYSTEM ════════════════ */}
          {activeTab === 'system' && (
            <motion.div
              key="system"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-16 md:space-y-24"
            >
              <div className="space-y-8">
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  SYSTEM<br /><span className="text-white/20">SECURITY</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  Emergency protocols and treasury management for the administrator.
                </p>
              </div>

              {/* Treasury management */}
              <div className="border border-white/10 p-8 md:p-12 bg-white/1 space-y-8">
                <div className="flex items-center gap-3">
                  <Coins className="w-4 h-4 text-white/40" />
                  <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">TREASURY_MANAGEMENT</p>
                </div>
                <div className="space-y-2">
                  <p className="text-5xl font-light tracking-tighter text-white">
                    {treasuryBalance} <span className="text-lg text-white/20">SUI</span>
                  </p>
                  <p className="text-[9px] text-white/20 uppercase tracking-widest">ACCUMULATED PROTOCOL FEES</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <button
                    onClick={() => setConfirmConfig({
                      isOpen: true,
                      title: 'FULL_WITHDRAWAL',
                      message: `Withdraw all ${treasuryBalance} SUI from the protocol treasury to your wallet.`,
                      onConfirm: () => handleAction('Withdraw'),
                    })}
                    disabled={loading}
                    className="py-6 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-50"
                  >
                    WITHDRAW_ALL
                  </button>
                  <div className="space-y-4">
                    <div className="relative border-b border-white/10 focus-within:border-white transition-all">
                      <input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="0.0000"
                        className="w-full py-4 bg-transparent focus:outline-none font-light text-3xl tracking-tighter text-white placeholder:text-white/10"
                      />
                      <span className="absolute right-0 bottom-4 text-white/10 font-light uppercase tracking-widest text-sm">SUI</span>
                    </div>
                    <button
                      onClick={() => setConfirmConfig({
                        isOpen: true,
                        title: 'PARTIAL_WITHDRAWAL',
                        message: `Withdraw ${withdrawAmount} SUI from the protocol treasury.`,
                        onConfirm: () => handleAction('WithdrawAmount'),
                      })}
                      disabled={loading || !withdrawAmount || Number(withdrawAmount) <= 0}
                      className="w-full py-5 border border-white/30 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-40"
                    >
                      WITHDRAW_AMOUNT
                    </button>
                  </div>
                </div>
              </div>

              {/* Protocol status */}
              <div className="border border-white/10 p-8 md:p-12 bg-white/1 space-y-6">
                <p className="text-[10px] font-medium tracking-[0.4em] text-white/20 uppercase">PROTOCOL_STATUS</p>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPaused ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                    <p className={`text-2xl font-light uppercase tracking-tighter ${isPaused ? 'text-red-500' : 'text-emerald-500'}`}>
                      {isPaused ? 'PAUSED' : 'ACTIVE'}
                    </p>
                  </div>
                  {pendingPausedBool !== null && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-3 h-3 text-yellow-500 flex-shrink-0" />
                      <span className="text-[9px] text-yellow-500 tracking-[0.3em] uppercase">
                        PENDING: {pendingPausedBool ? 'PAUSE' : 'UNPAUSE'}
                        {pausedPendingEpoch ? ` — EP.${pausedPendingEpoch}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Emergency halt */}
              <div className="p-8 md:p-12 border border-red-500/20 bg-red-500/2 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
                <div className="space-y-4 flex-1">
                  <div className="flex items-center gap-4 text-red-500">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="text-[10px] font-medium tracking-[0.4em] uppercase">PRIORITY_ALPHA: TERMINATION</span>
                  </div>
                  <p className="text-[10px] md:text-xs text-white/40 font-light leading-relaxed uppercase tracking-widest">
                    Proposes immediate cessation via TimeLock. All distribution cycles will be frozen after the lock period elapses. Execute from the TIMELOCK tab to finalize.
                  </p>
                </div>
                <button
                  onClick={() => setConfirmConfig({
                    isOpen: true,
                    title: 'EMERGENCY_HALT',
                    message: 'CRITICAL WARNING: This proposes a pause of all protocol operations. After the timelock elapses, execute_paused will freeze all minting globally.',
                    isDangerous: true,
                    onConfirm: () => handleAction('HaltProtocol'),
                  })}
                  disabled={loading}
                  className="w-full md:w-auto px-8 md:px-16 py-4 md:py-6 bg-red-500 text-white text-[11px] font-medium tracking-[0.4em] uppercase hover:bg-black hover:text-red-500 border border-red-500 transition-all flex items-center justify-center gap-4 disabled:opacity-50"
                >
                  <Pause className="w-4 h-4" />
                  EXECUTE_HALT
                </button>
              </div>
            </motion.div>
          )}

          {/* ════════════════ FEEDBACK ════════════════ */}
          {activeTab === 'feedback' && (
            <motion.div
              key="feedback"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-12 md:space-y-16"
            >
              <div className="space-y-6">
                <h1 className="text-6xl sm:text-[80px] md:text-[120px] font-light leading-[0.85] tracking-[-0.05em] uppercase">
                  FEEDBACK<br /><span className="text-white/20">CONSOLE</span>
                </h1>
                <p className="text-[10px] md:text-sm font-light text-white/40 leading-relaxed max-w-xl uppercase tracking-[0.2em]">
                  Review and manage user-submitted feedback. Requires the admin API key configured in your environment.
                </p>
              </div>

              {/* ── API Key Setup ── */}
              {!adminKeySet ? (
                <div className="border border-white/10 bg-white/1 p-8 md:p-12 space-y-8">
                  <div className="flex items-center gap-4 text-white/40">
                    <Key className="w-4 h-4" />
                    <span className="text-[10px] font-medium tracking-[0.4em] uppercase">ADMIN_KEY_REQUIRED</span>
                  </div>
                  <p className="text-[10px] text-white/30 leading-relaxed uppercase tracking-widest">
                    Enter the ADMIN_API_KEY value from your server's .env file. It will be kept in sessionStorage for this browser tab only.
                  </p>
                  <div className="flex gap-4">
                    <div className="flex-1 relative border-b border-white/10 focus-within:border-white transition-colors">
                      <input
                        type="password"
                        value={adminKeyInput}
                        onChange={e => setAdminKeyInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && saveFeedbackKey()}
                        placeholder="paste-your-admin-api-key"
                        className="w-full py-3 bg-transparent focus:outline-none text-sm font-mono text-white placeholder-white/20"
                      />
                    </div>
                    <button
                      onClick={saveFeedbackKey}
                      disabled={!adminKeyInput.trim()}
                      className="px-8 py-3 border border-white text-[10px] font-medium tracking-[0.4em] uppercase hover:bg-white hover:text-black transition-all disabled:opacity-40"
                    >
                      UNLOCK
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* ── Stats Row ── */}
                  {feedbackStats && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 border border-white/10 divide-white/10 bg-white/1">
                      {[
                        { label: 'TOTAL',       value: feedbackStats.total,                         color: 'text-white' },
                        { label: 'NEW',         value: feedbackStats.byStatus?.new         ?? 0,    color: 'text-amber-400' },
                        { label: 'IN_PROGRESS', value: feedbackStats.byStatus?.in_progress  ?? 0,   color: 'text-blue-400' },
                        { label: 'RESOLVED',    value: feedbackStats.byStatus?.resolved     ?? 0,   color: 'text-emerald-400' },
                      ].map(stat => (
                        <div key={stat.label} className="p-6 md:p-8 space-y-3">
                          <p className="text-[9px] tracking-[0.4em] text-white/20 uppercase">{stat.label}</p>
                          <p className={`text-4xl font-light tracking-tighter ${stat.color}`}>{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── Toolbar ── */}
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    {/* Search */}
                    <div className="relative flex-1 max-w-sm border-b border-white/10 focus-within:border-white transition-colors flex items-center gap-3 pb-2">
                      <Search className="w-3.5 h-3.5 text-white/20" />
                      <input
                        type="text"
                        placeholder="SEARCH_FEEDBACK"
                        value={feedbackFilter.search}
                        onChange={e => setFeedbackFilter(p => ({ ...p, search: e.target.value }))}
                        className="flex-1 bg-transparent focus:outline-none text-[10px] font-medium tracking-[0.3em] uppercase text-white placeholder-white/20"
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Status filter */}
                      {(['', 'new', 'in_progress', 'resolved', 'closed'] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setFeedbackFilter(p => ({ ...p, status: s }))}
                          className={`px-3 py-1.5 border text-[9px] font-medium tracking-[0.3em] uppercase transition-all ${
                            feedbackFilter.status === s
                              ? 'border-white bg-white text-black'
                              : 'border-white/10 text-white/30 hover:border-white/30'
                          }`}
                        >
                          {s || 'ALL'}
                        </button>
                      ))}
                      <button
                        onClick={() => loadFeedback(1)}
                        disabled={feedbackLoading}
                        className="p-2 border border-white/10 text-white/30 hover:border-white hover:text-white transition-all disabled:opacity-40"
                        title="Refresh"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${feedbackLoading ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={clearFeedbackKey}
                        className="p-2 border border-white/10 text-white/30 hover:border-red-500 hover:text-red-500 transition-all"
                        title="Clear API key"
                      >
                        <Key className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* ── Load button (if no data yet) ── */}
                  {feedbackItems.length === 0 && !feedbackLoading && (
                    <button
                      onClick={() => loadFeedback(1)}
                      className="w-full py-6 border border-white/10 text-[10px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white/5 transition-all flex items-center justify-center gap-4"
                    >
                      <Inbox className="w-4 h-4" />
                      LOAD_FEEDBACK
                    </button>
                  )}

                  {feedbackLoading && (
                    <div className="flex justify-center py-12">
                      <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                    </div>
                  )}

                  {/* ── Feedback List ── */}
                  {feedbackItems.length > 0 && (
                    <div className="border border-white/10 divide-y divide-white/5">
                      {feedbackItems.map(item => {
                        const statusColors: Record<FeedbackStatus, string> = {
                          new:         'text-amber-400  border-amber-400/30  bg-amber-400/5',
                          in_progress: 'text-blue-400   border-blue-400/30   bg-blue-400/5',
                          resolved:    'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
                          closed:      'text-white/20   border-white/10      bg-white/2',
                        };
                        const catIcons: Record<string, string> = {
                          bug: '🐛', feature: '💡', ux: '🎨', performance: '⚡', general: '💬'
                        };
                        return (
                          <div
                            key={item.id}
                            className={`p-5 md:p-6 grid grid-cols-1 md:grid-cols-12 gap-4 items-start hover:bg-white/2 transition-colors cursor-pointer ${
                              selectedFeedback?.id === item.id ? 'bg-white/3' : ''
                            }`}
                            onClick={() => { setSelectedFeedback(item); setEditNotes(item.adminNotes ?? ''); }}
                          >
                            {/* Category + message */}
                            <div className="md:col-span-6 space-y-2">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-[9px] font-medium tracking-[0.3em] uppercase text-white/40">
                                  {catIcons[item.category] ?? '💬'} {item.category}
                                </span>
                                <span className={`px-2 py-0.5 border text-[8px] font-medium tracking-widest uppercase ${statusColors[item.status]}`}>
                                  {item.status.replace('_', ' ')}
                                </span>
                                {item.priority !== 'normal' && (
                                  <span className={`text-[8px] tracking-widest uppercase font-medium ${
                                    item.priority === 'critical' ? 'text-red-400' :
                                    item.priority === 'high'     ? 'text-orange-400' : 'text-white/30'
                                  }`}>
                                    {item.priority.toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm font-light text-white/80 line-clamp-2 leading-relaxed">
                                {item.message}
                              </p>
                            </div>
                            {/* Contact */}
                            <div className="md:col-span-3 space-y-1">
                              {item.isAnonymous ? (
                                <p className="text-[9px] text-white/20 tracking-widest uppercase">ANONYMOUS</p>
                              ) : (
                                <>
                                  {item.name  && <p className="text-[10px] text-white/60 truncate">{item.name}</p>}
                                  {item.email && <p className="text-[9px] text-white/40 font-mono truncate">{item.email}</p>}
                                  {!item.name && !item.email && item.walletAddress && (
                                    <p className="text-[9px] text-white/30 font-mono truncate">
                                      {item.walletAddress.slice(0, 10)}...
                                    </p>
                                  )}
                                </>
                              )}
                              <p className="text-[8px] text-white/20 tracking-widest">
                                {new Date(item.createdAt).toLocaleDateString()} {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                              {item.page && (
                                <p className="text-[8px] text-white/20 font-mono truncate">{item.page}</p>
                              )}
                            </div>
                            {/* Quick actions */}
                            <div className="md:col-span-3 flex items-center gap-2 flex-wrap justify-start md:justify-end" onClick={e => e.stopPropagation()}>
                              {item.status !== 'resolved' && (
                                <button
                                  onClick={() => handleUpdateFeedback(item.id, { status: 'resolved' })}
                                  className="p-2 border border-emerald-500/20 text-emerald-500/40 hover:text-emerald-500 hover:border-emerald-500 transition-all"
                                  title="Mark resolved"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {item.status !== 'in_progress' && item.status !== 'resolved' && (
                                <button
                                  onClick={() => handleUpdateFeedback(item.id, { status: 'in_progress' })}
                                  className="p-2 border border-blue-500/20 text-blue-500/40 hover:text-blue-500 hover:border-blue-500 transition-all"
                                  title="Mark in progress"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteFeedback(item.id)}
                                className="p-2 border border-red-500/10 text-red-500/30 hover:text-red-500 hover:border-red-500/50 transition-all"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <ChevronRight className="w-3.5 h-3.5 text-white/20" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* ── Pagination ── */}
                  {feedbackTotal > FEEDBACK_PAGE_LIMIT && (
                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                      <p className="text-[9px] text-white/20 tracking-widest uppercase">
                        Showing {Math.min((feedbackPage - 1) * FEEDBACK_PAGE_LIMIT + 1, feedbackTotal)}–
                        {Math.min(feedbackPage * FEEDBACK_PAGE_LIMIT, feedbackTotal)} of {feedbackTotal}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => loadFeedback(feedbackPage - 1)}
                          disabled={feedbackPage <= 1 || feedbackLoading}
                          className="px-4 py-2 border border-white/10 text-[9px] tracking-widest uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-30"
                        >
                          PREV
                        </button>
                        <span className="text-[9px] text-white/40 tracking-widest px-3">
                          {feedbackPage} / {Math.ceil(feedbackTotal / FEEDBACK_PAGE_LIMIT)}
                        </span>
                        <button
                          onClick={() => loadFeedback(feedbackPage + 1)}
                          disabled={feedbackPage >= Math.ceil(feedbackTotal / FEEDBACK_PAGE_LIMIT) || feedbackLoading}
                          className="px-4 py-2 border border-white/10 text-[9px] tracking-widest uppercase hover:border-white hover:bg-white hover:text-black transition-all disabled:opacity-30"
                        >
                          NEXT
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Detail Panel (selected feedback) ── */}
                  <AnimatePresence>
                    {selectedFeedback && (
                      <motion.div
                        key={selectedFeedback.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="border border-white/20 bg-black shadow-2xl space-y-0"
                      >
                        {/* Panel header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/2">
                          <div className="flex items-center gap-3">
                            <MessageSquare className="w-4 h-4 text-white/30" />
                            <span className="text-[10px] font-medium tracking-[0.4em] uppercase">DETAIL_VIEW</span>
                            <span className="text-[9px] font-mono text-white/20">{selectedFeedback.id}</span>
                          </div>
                          <button onClick={() => setSelectedFeedback(null)} className="text-white/30 hover:text-white transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
                          {/* Left: full message + meta */}
                          <div className="p-6 md:p-8 space-y-6">
                            <div className="space-y-3">
                              <p className="text-[9px] tracking-[0.4em] text-white/20 uppercase">FULL MESSAGE</p>
                              <p className="text-sm font-light text-white/80 leading-relaxed whitespace-pre-wrap">
                                {selectedFeedback.message}
                              </p>
                            </div>
                            <div className="pt-4 border-t border-white/10 grid grid-cols-2 gap-4 text-[10px]">
                              <div className="space-y-1">
                                <p className="text-white/20 uppercase tracking-widest">Category</p>
                                <p className="text-white capitalize">{selectedFeedback.category}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-white/20 uppercase tracking-widest">Page</p>
                                <p className="text-white/60 font-mono">{selectedFeedback.page ?? '—'}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-white/20 uppercase tracking-widest">Submitted</p>
                                <p className="text-white/60">{new Date(selectedFeedback.createdAt).toLocaleString()}</p>
                              </div>
                              <div className="space-y-1">
                                <p className="text-white/20 uppercase tracking-widest">Anonymous</p>
                                <p className="text-white/60">{selectedFeedback.isAnonymous ? 'Yes' : 'No'}</p>
                              </div>
                              {!selectedFeedback.isAnonymous && (
                                <>
                                  {selectedFeedback.name && (
                                    <div className="space-y-1 col-span-2">
                                      <p className="text-white/20 uppercase tracking-widest">Name</p>
                                      <p className="text-white/80">{selectedFeedback.name}</p>
                                    </div>
                                  )}
                                  {selectedFeedback.email && (
                                    <div className="space-y-1 col-span-2">
                                      <p className="text-white/20 uppercase tracking-widest">Email</p>
                                      <a href={`mailto:${selectedFeedback.email}`} className="text-blue-400 hover:text-white transition-colors flex items-center gap-2">
                                        {selectedFeedback.email}
                                        <ExternalLink className="w-3 h-3" />
                                      </a>
                                    </div>
                                  )}
                                  {selectedFeedback.walletAddress && (
                                    <div className="space-y-1 col-span-2">
                                      <p className="text-white/20 uppercase tracking-widest">Wallet</p>
                                      <p className="text-white/40 font-mono text-[9px]">{selectedFeedback.walletAddress}</p>
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          </div>

                          {/* Right: admin controls */}
                          <div className="p-6 md:p-8 space-y-6">
                            {/* Status */}
                            <div className="space-y-3">
                              <p className="text-[9px] tracking-[0.4em] text-white/20 uppercase">STATUS</p>
                              <div className="grid grid-cols-2 gap-2">
                                {(['new', 'in_progress', 'resolved', 'closed'] as FeedbackStatus[]).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleUpdateFeedback(selectedFeedback.id, { status: s })}
                                    className={`py-2 px-3 border text-[9px] font-medium tracking-widest uppercase transition-all ${
                                      selectedFeedback.status === s
                                        ? 'border-white bg-white text-black'
                                        : 'border-white/10 text-white/30 hover:border-white/30'
                                    }`}
                                  >
                                    {s.replace('_', ' ')}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Priority */}
                            <div className="space-y-3">
                              <p className="text-[9px] tracking-[0.4em] text-white/20 uppercase">PRIORITY</p>
                              <div className="grid grid-cols-4 gap-2">
                                {(['low', 'normal', 'high', 'critical'] as FeedbackPriority[]).map(p => (
                                  <button
                                    key={p}
                                    onClick={() => handleUpdateFeedback(selectedFeedback.id, { priority: p })}
                                    className={`py-2 px-1 border text-[8px] font-medium tracking-widest uppercase transition-all ${
                                      selectedFeedback.priority === p
                                        ? 'border-white bg-white text-black'
                                        : p === 'critical' ? 'border-red-500/20 text-red-400/60 hover:border-red-500 hover:text-red-400'
                                        : p === 'high'     ? 'border-orange-400/20 text-orange-400/60 hover:border-orange-400 hover:text-orange-400'
                                        : 'border-white/10 text-white/30 hover:border-white/30'
                                    }`}
                                  >
                                    {p}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Admin notes */}
                            <div className="space-y-3">
                              <p className="text-[9px] tracking-[0.4em] text-white/20 uppercase">ADMIN_NOTES</p>
                              <textarea
                                value={editNotes}
                                onChange={e => setEditNotes(e.target.value)}
                                rows={4}
                                placeholder="Internal notes (not shown to user)..."
                                className="w-full bg-white/3 border border-white/10 focus:border-white/30 px-3 py-2 text-[11px] font-light text-white placeholder-white/20 focus:outline-none resize-none transition-colors"
                              />
                              <button
                                onClick={() => handleUpdateFeedback(selectedFeedback.id, { adminNotes: editNotes })}
                                className="w-full py-3 border border-white/20 text-[9px] font-medium tracking-[0.4em] uppercase hover:border-white hover:bg-white hover:text-black transition-all"
                              >
                                SAVE_NOTES
                              </button>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => handleDeleteFeedback(selectedFeedback.id)}
                              className="w-full py-3 border border-red-500/20 text-red-400/60 text-[9px] font-medium tracking-[0.4em] uppercase hover:border-red-500 hover:text-red-400 hover:bg-red-500/5 transition-all flex items-center justify-center gap-3"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              DELETE_PERMANENTLY
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Confirm Modal ──────────────────────────────────────────────────── */}
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
