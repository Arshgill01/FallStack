import {
  nextThreshold,
  type FailureBucket,
} from './mutation.js';

export type MutationRejection =
  | 'duplicate'
  | 'capped'
  | 'stale'
  | 'invalid'
  | 'unavailable';

export type VisibleMutationChange =
  | 'mark_added'
  | 'artifact_spawned'
  | 'artifact_upgraded'
  | 'site_cursed'
  | 'site_reinforced'
  | 'site_stabilized'
  | 'none';

export type MutationReceipt = {
  eventId: string;
  boardId: string;
  accepted: boolean;
  rejection: MutationRejection | null;
  revisionBefore: number;
  revisionAfter: number;
  siteId: string | null;
  siteName: string | null;
  bucket: FailureBucket | 'successful_clear' | null;
  counterBefore: number | null;
  counterAfter: number | null;
  nextThreshold: number | null;
  visibleChange: VisibleMutationChange;
  copy: string;
};

type FailureReceiptInput = {
  eventId: string;
  boardId: string;
  revisionBefore: number;
  siteId: string;
  siteName: string;
  bucket: FailureBucket;
  counterBefore: number;
  counterAfter: number;
  rejection?: MutationRejection | null;
};

type ClearReceiptInput = Omit<
  FailureReceiptInput,
  'bucket'
>;

type NonSiteReceiptInput = {
  eventId: string;
  boardId: string;
  revisionBefore: number;
  rejection?: MutationRejection | null;
  copy: string;
};

export function createMutationReceipt(
  input: FailureReceiptInput
): MutationReceipt {
  const rejection = input.rejection ?? null;
  const accepted = rejection === null;
  const visibleChange = accepted
    ? failureVisibleChange(input.counterBefore, input.counterAfter)
    : 'none';
  const threshold = nextThreshold(input.counterAfter);

  return {
    eventId: input.eventId,
    boardId: input.boardId,
    accepted,
    rejection,
    revisionBefore: input.revisionBefore,
    revisionAfter: input.revisionBefore + (accepted ? 1 : 0),
    siteId: input.siteId,
    siteName: input.siteName,
    bucket: input.bucket,
    counterBefore: input.counterBefore,
    counterAfter: input.counterAfter,
    nextThreshold: threshold,
    visibleChange,
    copy: failureReceiptCopy(input, accepted, visibleChange, threshold),
  };
}

export function createClearMutationReceipt(
  input: ClearReceiptInput
): MutationReceipt {
  const rejection = input.rejection ?? null;
  const accepted = rejection === null;
  const visibleChange = accepted
    ? clearVisibleChange(input.counterBefore, input.counterAfter)
    : 'none';
  const threshold = nextClearThreshold(input.counterAfter);

  return {
    eventId: input.eventId,
    boardId: input.boardId,
    accepted,
    rejection,
    revisionBefore: input.revisionBefore,
    revisionAfter: input.revisionBefore + (accepted ? 1 : 0),
    siteId: input.siteId,
    siteName: input.siteName,
    bucket: 'successful_clear',
    counterBefore: input.counterBefore,
    counterAfter: input.counterAfter,
    nextThreshold: threshold,
    visibleChange,
    copy: clearReceiptCopy(input, accepted, visibleChange, threshold),
  };
}

export function createNonSiteMutationReceipt(
  input: NonSiteReceiptInput
): MutationReceipt {
  const rejection = input.rejection ?? null;
  const accepted = rejection === null;
  return {
    eventId: input.eventId,
    boardId: input.boardId,
    accepted,
    rejection,
    revisionBefore: input.revisionBefore,
    revisionAfter: input.revisionBefore + (accepted ? 1 : 0),
    siteId: null,
    siteName: null,
    bucket: null,
    counterBefore: null,
    counterAfter: null,
    nextThreshold: null,
    visibleChange: accepted ? 'mark_added' : 'none',
    copy: input.copy,
  };
}

function clearVisibleChange(
  before: number,
  after: number
): VisibleMutationChange {
  if (before < 3 && after >= 3) return 'site_reinforced';
  if (before < 6 && after >= 6) return 'site_stabilized';
  return 'mark_added';
}

function nextClearThreshold(count: number): number | null {
  if (count < 3) return 3;
  if (count < 6) return 6;
  return null;
}

function clearReceiptCopy(
  input: ClearReceiptInput,
  accepted: boolean,
  visibleChange: VisibleMutationChange,
  threshold: number | null
): string {
  if (!accepted) {
    if (input.rejection === 'capped') {
      return `${input.siteName} remembers your clean line. Shared state stayed at ${input.counterAfter}.`;
    }
    return `Shared state stayed at ${input.counterAfter}.`;
  }
  if (visibleChange === 'site_reinforced') {
    return `Your clean line reinforced ${input.siteName}. ${clearThresholdCopy(input.counterAfter, threshold)}`;
  }
  if (visibleChange === 'site_stabilized') {
    return `Your clean line stabilized ${input.siteName}.`;
  }
  return `Your clean line changed ${input.siteName}: ${input.counterBefore} → ${input.counterAfter}. ${clearThresholdCopy(input.counterAfter, threshold)}`;
}

function clearThresholdCopy(count: number, threshold: number | null): string {
  if (threshold === null) return 'This site is fully stabilized.';
  const remaining = threshold - count;
  return `${remaining} more clean ${remaining === 1 ? 'clear stabilizes' : 'clears stabilize'} it.`;
}

function failureVisibleChange(
  before: number,
  after: number
): VisibleMutationChange {
  if (before < 3 && after >= 3) return 'artifact_spawned';
  if (before < 6 && after >= 6) return 'artifact_upgraded';
  if (before < 10 && after >= 10) return 'site_cursed';
  return 'mark_added';
}

function failureReceiptCopy(
  input: FailureReceiptInput,
  accepted: boolean,
  visibleChange: VisibleMutationChange,
  threshold: number | null
): string {
  if (!accepted) {
    if (input.rejection === 'capped') {
      return `${input.siteName} has heard enough from you today. Shared state stayed at ${input.counterAfter}.`;
    }
    return `Shared state stayed at ${input.counterAfter}.`;
  }

  if (visibleChange === 'artifact_spawned') {
    return `Your fall spawned ${artifactName(input.bucket, input.counterAfter)} at ${input.siteName}. ${thresholdCopy(input.bucket, input.counterAfter, threshold, 'upgrade it')}`;
  }
  if (visibleChange === 'artifact_upgraded') {
    return `Your fall upgraded ${artifactName(input.bucket, input.counterAfter)} at ${input.siteName}. ${thresholdCopy(input.bucket, input.counterAfter, threshold, 'overgrow it')}`;
  }
  if (visibleChange === 'site_cursed') {
    return `Your fall overgrew ${input.siteName}.`;
  }

  return `Your fall changed ${input.siteName}: ${input.counterBefore} → ${input.counterAfter}. ${thresholdCopy(input.bucket, input.counterAfter, threshold, 'change it')}`;
}

function thresholdCopy(
  bucket: FailureBucket,
  count: number,
  threshold: number | null,
  consequence: 'upgrade it' | 'overgrow it' | 'change it'
): string {
  if (threshold === null) return 'This site is fully overgrown.';
  const remaining = threshold - count;
  const singularConsequence =
    consequence === 'upgrade it'
      ? 'upgrades it'
      : consequence === 'overgrow it'
        ? 'overgrows it'
        : 'changes it';
  return `${remaining} more ${bucketLabel(bucket, remaining)} ${remaining === 1 ? singularConsequence : consequence}.`;
}

function bucketLabel(bucket: FailureBucket, count: number): string {
  const singular =
    bucket === 'short_jump'
      ? 'short jump'
      : bucket === 'overjump'
        ? 'overjump'
        : bucket === 'wall_bonk'
          ? 'wall bonk'
          : 'helper slip';
  return count === 1 ? singular : `${singular}s`;
}

function artifactName(bucket: FailureBucket, count: number): string {
  if (bucket === 'short_jump')
    return count >= 6 ? 'Mercy Nail' : 'Corpse Stack';
  if (bucket === 'wall_bonk') return 'Ghost Platform';
  return 'Cursed Brick';
}
