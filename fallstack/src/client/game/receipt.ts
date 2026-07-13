import type { MutationReceipt } from '../../shared/game/mutation-receipts.js';

export type MutationReceiptPresentation = {
  acceptedLabel: string;
  revisionLabel: string;
  siteLabel: string;
  bucketLabel: string;
  counterLabel: string;
};

export function mutationReceiptPresentation(
  receipt: MutationReceipt
): MutationReceiptPresentation {
  const unchanged = receipt.revisionBefore === receipt.revisionAfter;
  return {
    acceptedLabel: receipt.accepted
      ? 'MUTATION COUNTED'
      : `NOT COUNTED · ${receipt.rejection?.toUpperCase() ?? 'REJECTED'}`,
    revisionLabel: unchanged
      ? `BOARD r${receipt.revisionAfter} · UNCHANGED`
      : `BOARD r${receipt.revisionBefore} → r${receipt.revisionAfter}`,
    siteLabel: receipt.siteName ?? 'Shared tower',
    bucketLabel: receiptBucketLabel(receipt),
    counterLabel:
      receipt.counterBefore === null || receipt.counterAfter === null
        ? unchanged
          ? 'UNCHANGED'
          : 'RECORDED'
        : unchanged
          ? `${receipt.counterAfter} · UNCHANGED`
          : `${receipt.counterBefore} → ${receipt.counterAfter}`,
  };
}

function receiptBucketLabel(receipt: MutationReceipt): string {
  if (receipt.bucket === 'short_jump') return 'SHORT JUMPS';
  if (receipt.bucket === 'overjump') return 'OVERJUMPS';
  if (receipt.bucket === 'wall_bonk') return 'WALL BONKS';
  if (receipt.bucket === 'helper_overuse') return 'HELPER SLIPS';
  if (receipt.bucket === 'successful_clear') return 'CLEAN CLEARS';
  return 'SHARED MARK';
}
