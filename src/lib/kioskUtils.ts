import { Transaction, TransactionObjectArgument } from '@mysten/sui/transactions';

export interface KioskArgs {
  kioskArg:  TransactionObjectArgument;
  capArg:    TransactionObjectArgument;
  isNew: boolean;
}

/**
 * Resolves Kiosk arguments for a Programmable Transaction Block (PTB).
 *
 * CRITICAL: If the user has NO kiosk yet, we create one inline.
 * `0x2::kiosk::new` returns (Kiosk, KioskOwnerCap) as transaction results.
 * These can be passed directly to other move calls in the same PTB.
 *
 * Do NOT call `finalizeKiosk` before passing kiosk to mint_to_kiosk —
 * sharing the object first would make it inaccessible in the same PTB.
 * Instead call `finalizeKiosk` AFTER all move calls, at the very end.
 */
export function resolveKioskArgs(
  tx: Transaction,
  kioskId?: string | null,
  kioskCapId?: string | null
): KioskArgs {
  if (kioskId && kioskCapId) {
    return {
      kioskArg: tx.object(kioskId),
      capArg:   tx.object(kioskCapId),
      isNew:    false,
    };
  }

  // No kiosk yet — create one inline in the PTB.
  // The results are TransactionObjectArgument references, not real object IDs.
  // They CANNOT be tx.object()-wrapped, only passed directly.
  const [kiosk, kioskCap] = tx.moveCall({
    target: '0x2::kiosk::new',
  });

  return {
    kioskArg: kiosk,
    capArg:   kioskCap,
    isNew:    true,
  };
}

/**
 * Finalizes a newly-created Kiosk at the END of a PTB.
 *
 * MUST be called AFTER all other move calls that reference kioskArg/capArg.
 * Sharing before use would make the object a "shared object" which requires
 * different argument passing rules (by-ID not by-result).
 */
export function finalizeKiosk(
  tx:          Transaction,
  kioskArg:    TransactionObjectArgument,
  capArg:      TransactionObjectArgument,
  userAddress: string
) {
  // Share the kiosk so it's globally visible on-chain
  tx.moveCall({
    target: '0x2::transfer::public_share_object',
    typeArguments: ['0x2::kiosk::Kiosk'],
    arguments: [kioskArg],
  });

  // Transfer the KioskOwnerCap to the user's wallet
  tx.transferObjects([capArg], tx.pure.address(userAddress));
}
