import type { FailureBucket } from './mutation.js';
import {
  createClearMutationReceipt,
  createMutationReceipt,
  createNonSiteMutationReceipt,
  type MutationReceipt,
} from './mutation-receipts.js';

export const CONTRIBUTOR_BUCKET_CAP = 3;
export const CONTRIBUTOR_DAILY_FALL_CAP = 10;
export const CONTRIBUTOR_ZONE_CLEAR_CAP = 3;
export const CONTRIBUTOR_SUMMIT_CAP = 1;

export type MutationPlan = {
  receipt: MutationReceipt;
  applyMutation: boolean;
  storeReceipt: boolean;
};

export function planFallMutation(input: {
  eventId: string;
  boardId: string;
  revision: number;
  siteId: string;
  siteName: string;
  bucket: FailureBucket;
  counter: number;
  contributorBucketCount: number;
  contributorDailyFallCount: number;
  existingReceipt?: MutationReceipt | null;
}): MutationPlan {
  if (input.existingReceipt) {
    return {
      receipt: input.existingReceipt,
      applyMutation: false,
      storeReceipt: false,
    };
  }

  const capped =
    input.contributorBucketCount >= CONTRIBUTOR_BUCKET_CAP ||
    input.contributorDailyFallCount >= CONTRIBUTOR_DAILY_FALL_CAP;
  const receipt = createMutationReceipt({
    eventId: input.eventId,
    boardId: input.boardId,
    revisionBefore: input.revision,
    siteId: input.siteId,
    siteName: input.siteName,
    bucket: input.bucket,
    counterBefore: input.counter,
    counterAfter: input.counter + (capped ? 0 : 1),
    rejection: capped ? 'capped' : null,
  });

  return {
    receipt,
    applyMutation: !capped,
    storeReceipt: true,
  };
}

export function planClearMutation(input: {
  eventId: string;
  boardId: string;
  revision: number;
  siteId: string;
  siteName: string;
  counter: number;
  contributorClearCount: number;
  existingReceipt?: MutationReceipt | null;
}): MutationPlan {
  if (input.existingReceipt) return existingMutationPlan(input.existingReceipt);
  const capped = input.contributorClearCount >= CONTRIBUTOR_ZONE_CLEAR_CAP;
  return {
    receipt: createClearMutationReceipt({
      eventId: input.eventId,
      boardId: input.boardId,
      revisionBefore: input.revision,
      siteId: input.siteId,
      siteName: input.siteName,
      counterBefore: input.counter,
      counterAfter: input.counter + (capped ? 0 : 1),
      rejection: capped ? 'capped' : null,
    }),
    applyMutation: !capped,
    storeReceipt: true,
  };
}

export function planSummitMutation(input: {
  eventId: string;
  boardId: string;
  revision: number;
  contributorSummitCount: number;
  existingReceipt?: MutationReceipt | null;
}): MutationPlan {
  if (input.existingReceipt) return existingMutationPlan(input.existingReceipt);
  const capped = input.contributorSummitCount >= CONTRIBUTOR_SUMMIT_CAP;
  return {
    receipt: createNonSiteMutationReceipt({
      eventId: input.eventId,
      boardId: input.boardId,
      revisionBefore: input.revision,
      rejection: capped ? 'capped' : null,
      copy: capped
        ? 'The summit already knows you. Shared state did not change.'
        : 'The summit remembers your name.',
    }),
    applyMutation: !capped,
    storeReceipt: true,
  };
}

function existingMutationPlan(receipt: MutationReceipt): MutationPlan {
  return { receipt, applyMutation: false, storeReceipt: false };
}
