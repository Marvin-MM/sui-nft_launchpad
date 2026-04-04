import { useMemo } from 'react';
import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { REWARD_TOKEN_TYPE, REWARD_TOKEN_DECIMALS, REWARD_TOKEN_SYMBOL } from '../lib/sui';

export default function useRewardToken() {
  const account = useCurrentAccount();

  const { data: balances, isLoading: balancesLoading } = useSuiClientQuery(
    'getAllBalances',
    { owner: account?.address || '' },
    { enabled: !!account }
  );

  const { data: coinMeta, isLoading: metaLoading } = useSuiClientQuery(
    'getCoinMetadata',
    { coinType: REWARD_TOKEN_TYPE },
    { enabled: !!REWARD_TOKEN_TYPE }
  );

  const entry = (balances || []).find((b: any) => b?.coinType === REWARD_TOKEN_TYPE);

  const decimals = coinMeta?.decimals ?? REWARD_TOKEN_DECIMALS;
  const symbol = coinMeta?.symbol ?? REWARD_TOKEN_SYMBOL;

  // Format balance with two decimal places safely using BigInt math
  let formatted = '0.00';
  try {
    const raw = BigInt(entry?.totalBalance || 0);
    const denom = BigInt(10) ** BigInt(decimals);
    const whole = raw / denom;
    const fraction = Number((raw % denom) / (denom / BigInt(100))); // two decimals
    formatted = `${whole.toString()}.${String(fraction).padStart(2, '0')}`;
  } catch (e) {
    formatted = '0.00';
  }

  return {
    balance: formatted,
    raw: entry?.totalBalance ?? '0',
    decimals,
    symbol,
    metadata: coinMeta ?? null,
    loading: balancesLoading || metaLoading,
  } as const;
}
