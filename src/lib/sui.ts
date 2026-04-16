/// <reference types="vite/client" />
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { createNetworkConfig } from '@mysten/dapp-kit';

export const NETWORK = (import.meta.env.VITE_SUI_NETWORK || 'testnet') as 'mainnet' | 'testnet';

// ── Core Deployment Objects ─────────────────────────────────────────────────
export const PACKAGE_ID         = import.meta.env.VITE_PACKAGE_ID         || '';
export const MINT_CONFIG_ID     = import.meta.env.VITE_MINT_CONFIG_ID     || '';
export const TRANSFER_POLICY_ID = import.meta.env.VITE_TRANSFER_POLICY_ID || '';

// ── Post-Deployment Shared Objects ─────────────────────────────────────────
// These are created via admin PTBs after the package has been published.
export const COMMIT_REVEAL_CONFIG_ID = import.meta.env.VITE_COMMIT_REVEAL_CONFIG_ID || '';
export const DUTCH_AUCTION_ID        = import.meta.env.VITE_DUTCH_AUCTION_ID        || '';
export const STAKING_POOL_ID         = import.meta.env.VITE_STAKING_POOL_ID         || '';
export const REWARD_MINT_CAP_ID      = import.meta.env.VITE_REWARD_MINT_CAP_ID      || '';
export const UPGRADE_CONFIG_ID       = import.meta.env.VITE_UPGRADE_CONFIG_ID       || '';
export const RENTAL_POLICY_ID        = import.meta.env.VITE_RENTAL_POLICY_ID        || '';

// ── New Shared Objects (post-deployment setup) ──────────────────────────────
export const REWARD_VAULT_ID        = import.meta.env.VITE_REWARD_VAULT_ID        || '';
export const MULTISIG_ADMIN_CAP_ID  = import.meta.env.VITE_MULTISIG_ADMIN_CAP_ID  || '';
export const MARKETPLACE_CONFIG_ID  = import.meta.env.VITE_MARKETPLACE_CONFIG_ID  || '';
export const PROTECTED_TP_ID        = import.meta.env.VITE_PROTECTED_TP_ID        || '';

// ── Sui Framework Fixed Objects ─────────────────────────────────────────────
// On-chain randomness oracle — same address on every Sui network.
export const SUI_RANDOM_ID = '0x8';

// ── Struct Type Strings ─────────────────────────────────────────────────────
// CORRECT: SuiNFT is in nft_app::nft, NOT mint. AdminCap is in mint.
export const NFT_TYPE       = `${PACKAGE_ID}::nft::SuiNFT`;
export const ADMIN_CAP_TYPE          = `${PACKAGE_ID}::mint::AdminCap`;
export const MULTISIG_ADMIN_CAP_TYPE = `${PACKAGE_ID}::multisig_admin::MultiSigAdminCap`;
export const STAKING_POOL_TYPE       = `${PACKAGE_ID}::staking::StakingPool`;
export const REWARD_VAULT_TYPE       = `${PACKAGE_ID}::reward_vault::RewardVault`;
// ── Reward Token Type (on-chain SGR) ───────────────────────────────────────
// The Move module `nft_app::reward_token` registers a fungible token with
// symbol "SGR" and 9 decimals. Clients can use this type string to query
// coin metadata and balances via the Sui RPC.
export const REWARD_TOKEN_TYPE    = `${PACKAGE_ID}::reward_token::REWARD_TOKEN`;
export const REWARD_TOKEN_SYMBOL  = 'SGR';
export const REWARD_TOKEN_DECIMALS = 9;

// ── Network Config ──────────────────────────────────────────────────────────
export const { networkConfig } = createNetworkConfig({
  testnet: { url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' },
  mainnet: { url: getJsonRpcFullnodeUrl('mainnet'), network: 'mainnet' },
});

// SuiJsonRpcClient requires both `url` and `network` in its constructor options.
export const suiClient = new SuiJsonRpcClient({
  url: networkConfig[NETWORK].url,
  network: NETWORK,
});

// ── Numeric Utilities ────────────────────────────────────────────────────────
export const MIST_PER_SUI = BigInt(1_000_000_000);

export const formatSui = (mist: bigint | string | number) => {
  return (Number(mist) / Number(MIST_PER_SUI)).toFixed(2);
};

export const parseSui = (sui: string | number) => {
  return BigInt(Math.floor(Number(sui) * Number(MIST_PER_SUI)));
};
