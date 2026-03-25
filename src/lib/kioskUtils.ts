import { Transaction } from '@mysten/sui/transactions';

/**
 * Resolves Kiosk arguments for a Programmable Transaction Block (PTB).
 * If the user has an existing Kiosk, it returns the object references.
 * If not, it safely creates a new Kiosk within the PTB.
 */
export function resolveKioskArgs(
  tx: Transaction,
  kioskId?: string,
  kioskCapId?: string
) {
  if (kioskId && kioskCapId) {
    return {
      kioskArg: tx.object(kioskId),
      capArg: tx.object(kioskCapId),
      isNew: false
    };
  }

  // Create new kiosk using standard Sui framework
  const [kiosk, kioskCap] = tx.moveCall({
    target: '0x2::kiosk::new',
  });

  return {
    kioskArg: kiosk,
    capArg: kioskCap,
    isNew: true
  };
}

/**
 * Finalizes a newly created Kiosk by sharing it on-chain and 
 * transferring the exact ownership capability to the user's wallet.
 * Must be called at the end of a PTB if `resolveKioskArgs` returned `isNew: true`.
 */
export function finalizeKiosk(
  tx: Transaction,
  kioskArg: any,
  capArg: any,
  userAddress: string
) {
  // Share the newly created Kiosk object
  tx.moveCall({
    target: '0x2::transfer::public_share_object',
    typeArguments: ['0x2::kiosk::Kiosk'],
    arguments: [kioskArg],
  });
  
  // Transfer the KioskOwnerCap to the specific connected wallet
  tx.transferObjects([capArg], tx.pure.address(userAddress));
}
