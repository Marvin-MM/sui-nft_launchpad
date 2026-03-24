/// <reference types="vite/client" />
import { SuiJsonRpcClient as SuiClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { createNetworkConfig } from '@mysten/dapp-kit';

export const NETWORK = (import.meta.env.VITE_SUI_NETWORK || 'testnet') as 'mainnet' | 'testnet';

export const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID || '';
export const MINT_CONFIG_ID = import.meta.env.VITE_MINT_CONFIG_ID || '';
export const ADMIN_CAP_ID = import.meta.env.VITE_ADMIN_CAP_ID || '';

export const NFT_TYPE = `${PACKAGE_ID}::mint::NFT`;

export const { networkConfig } = createNetworkConfig({
  testnet: {
    url: getJsonRpcFullnodeUrl('testnet'),
    network: 'testnet',
  },
  mainnet: {
    url: getJsonRpcFullnodeUrl('mainnet'),
    network: 'mainnet',
  },
});

export const suiClient = new SuiClient({ network: NETWORK, url: networkConfig[NETWORK].url });

export const MIST_PER_SUI = BigInt(1_000_000_000);

export const formatSui = (mist: bigint | string | number) => {
  return (Number(mist) / Number(MIST_PER_SUI)).toFixed(2);
};

export const parseSui = (sui: string | number) => {
  return BigInt(Math.floor(Number(sui) * Number(MIST_PER_SUI)));
};
