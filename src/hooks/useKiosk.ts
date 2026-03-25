import { useMemo } from 'react';
import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';

export function useKiosk() {
  const account = useCurrentAccount();
  
  // Query the user's owned objects for KioskOwnerCap
  const { data, isLoading, refetch } = useSuiClientQuery(
    'getOwnedObjects',
    {
      owner: account?.address || '',
      filter: { StructType: '0x2::kiosk::KioskOwnerCap' },
      options: { showContent: true },
    },
    { enabled: !!account }
  );

  const kioskInfo = useMemo(() => {
    if (!data?.data || data.data.length === 0) return null;
    
    // Pick the first KioskOwnerCap
    const cap = data.data[0];
    const content = cap.data?.content as any;
    
    const kioskId = content?.fields?.for;
    const capId = cap.data?.objectId;

    // A valid KioskOwnerCap must have both an objectId and reference the Kiosk it controls
    if (!kioskId || !capId) return null;

    return { kioskId, capId };
  }, [data]);

  return {
    kioskId: kioskInfo?.kioskId,
    kioskCapId: kioskInfo?.capId,
    hasKiosk: !!kioskInfo,
    isLoading,
    refetch
  };
}
