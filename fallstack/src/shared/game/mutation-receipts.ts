import {
  nextThreshold,
  planSiteArtifacts,
  siteStatus,
  type ArtifactType,
  type FailureBucket,
  type SiteMutationCounters,
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
  // The artifact the visible change is about. Absent on receipts stored
  // before receipts were derived from the rendered site.
  artifactType?: ArtifactType | null;
  copy: string;
};

type FailureReceiptInput = {
  eventId: string;
  boardId: string;
  revisionBefore: number;
  siteId: string;
  siteName: string;
  bucket: FailureBucket;
  // The site's full counters before this event, seeded plus organic.
  siteBefore: SiteMutationCounters;
  rejection?: MutationRejection | null;
};

type ClearReceiptInput = Omit<FailureReceiptInput, 'bucket'>;

type CounterTransition = {
  counterBefore: number;
  counterAfter: number;
};

export type SiteChange = {
  change: VisibleMutationChange;
  artifactType: ArtifactType | null;
};

// Compares what the site renders before and after one counter moves, using
// the same plan the snapshot renders from.
export function describeSiteChange(
  before: SiteMutationCounters,
  after: SiteMutationCounters
): SiteChange {
  const statusBefore = siteStatus(before);
  const statusAfter = siteStatus(after);
  const plansAfter = planSiteArtifacts(after);
  const plansBefore = new Map(
    planSiteArtifacts(before).map((plan) => [plan.slot, plan])
  );
  const changed = plansAfter.find((plan) => {
    const prior = plansBefore.get(plan.slot);
    return !prior || prior.type !== plan.type || prior.tier !== plan.tier;
  });

  if (statusAfter !== statusBefore) {
    const change: VisibleMutationChange =
      statusAfter === 'Stabilized'
        ? 'site_stabilized'
        : statusAfter === 'Reinforced'
          ? 'site_reinforced'
          : 'site_cursed';
    return { change, artifactType: changed?.type ?? null };
  }
  if (!changed) return { change: 'mark_added', artifactType: null };
  const prior = plansBefore.get(changed.slot);
  if (!prior) return { change: 'artifact_spawned', artifactType: changed.type };
  if (prior.type === changed.type && changed.tier === 'saturated')
    return { change: 'site_cursed', artifactType: changed.type };
  return { change: 'artifact_upgraded', artifactType: changed.type };
}

function transition(
  siteBefore: SiteMutationCounters,
  counter: keyof SiteMutationCounters,
  accepted: boolean
): CounterTransition & SiteChange {
  const counterBefore = siteBefore[counter];
  if (!accepted)
    return {
      counterBefore,
      counterAfter: counterBefore,
      change: 'none',
      artifactType: null,
    };
  const siteAfter = { ...siteBefore, [counter]: counterBefore + 1 };
  return {
    counterBefore,
    counterAfter: counterBefore + 1,
    ...describeSiteChange(siteBefore, siteAfter),
  };
}

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
  const moved = transition(input.siteBefore, input.bucket, accepted);
  const threshold = nextThreshold(moved.counterAfter);

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
    counterBefore: moved.counterBefore,
    counterAfter: moved.counterAfter,
    nextThreshold: threshold,
    visibleChange: moved.change,
    artifactType: moved.artifactType,
    copy: failureReceiptCopy(input, moved, accepted, threshold),
  };
}

export function createClearMutationReceipt(
  input: ClearReceiptInput
): MutationReceipt {
  const rejection = input.rejection ?? null;
  const accepted = rejection === null;
  const moved = transition(input.siteBefore, 'successfulClears', accepted);
  const threshold = nextClearThreshold(moved.counterAfter);

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
    counterBefore: moved.counterBefore,
    counterAfter: moved.counterAfter,
    nextThreshold: threshold,
    visibleChange: moved.change,
    artifactType: moved.artifactType,
    copy: clearReceiptCopy(input, moved, accepted, threshold),
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

function nextClearThreshold(count: number): number | null {
  if (count < 3) return 3;
  if (count < 6) return 6;
  return null;
}

function clearReceiptCopy(
  input: ClearReceiptInput,
  moved: CounterTransition & SiteChange,
  accepted: boolean,
  threshold: number | null
): string {
  if (!accepted) {
    if (input.rejection === 'capped') {
      return `${input.siteName} remembers your clean line. Shared state stayed at ${moved.counterAfter}.`;
    }
    return `Shared state stayed at ${moved.counterAfter}.`;
  }
  if (moved.change === 'site_reinforced') {
    return `Your clean line reinforced ${input.siteName}. ${clearThresholdCopy(moved.counterAfter, threshold)}`;
  }
  if (moved.change === 'site_stabilized') {
    return `Your clean line stabilized ${input.siteName}.`;
  }
  return `Your clean line changed ${input.siteName}: ${moved.counterBefore} → ${moved.counterAfter}. ${clearThresholdCopy(moved.counterAfter, threshold)}`;
}

function clearThresholdCopy(count: number, threshold: number | null): string {
  if (threshold === null) return 'This site is fully stabilized.';
  const remaining = threshold - count;
  return `${remaining} more clean ${remaining === 1 ? 'clear stabilizes' : 'clears stabilize'} it.`;
}

function failureReceiptCopy(
  input: FailureReceiptInput,
  moved: CounterTransition & SiteChange,
  accepted: boolean,
  threshold: number | null
): string {
  if (!accepted) {
    if (input.rejection === 'capped') {
      return `${input.siteName} has heard enough from you today. Shared state stayed at ${moved.counterAfter}.`;
    }
    return `Shared state stayed at ${moved.counterAfter}.`;
  }

  const name = moved.artifactType ? artifactName(moved.artifactType) : null;
  if (moved.change === 'artifact_spawned' && name) {
    return `Your fall spawned ${name} at ${input.siteName}. ${thresholdCopy(input.bucket, moved.counterAfter, threshold, 'upgrade it')}`;
  }
  if (moved.change === 'artifact_upgraded' && name) {
    return `Your fall upgraded ${name} at ${input.siteName}. ${thresholdCopy(input.bucket, moved.counterAfter, threshold, 'overgrow it')}`;
  }
  if (moved.change === 'site_cursed') {
    return `Your fall overgrew ${input.siteName}.`;
  }

  return `Your fall changed ${input.siteName}: ${moved.counterBefore} → ${moved.counterAfter}. ${thresholdCopy(input.bucket, moved.counterAfter, threshold, 'change it')}`;
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

function artifactName(type: ArtifactType): string {
  if (type === 'corpse_stack') return 'Corpse Stack';
  if (type === 'mercy_nail') return 'Mercy Nail';
  if (type === 'ghost_platform') return 'Ghost Platform';
  if (type === 'cursed_brick') return 'Cursed Brick';
  return 'Lantern Trail';
}
