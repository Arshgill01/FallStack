import type {
  FailureBucket,
  GameSnapshot,
  SiteSnapshot,
} from './mutation.js';
import type {
  MutationReceipt,
  VisibleMutationChange,
} from './mutation-receipts.js';

export const TOWER_VERSION = 1;

export type BoardIdentity = {
  boardId: string;
  scope: 'community';
  scopeLabel: string;
  dateKey: string;
  dailySeed: string;
  towerVersion: number;
};

export type MutationBeat = {
  revision: number;
  siteId: string;
  siteName: string;
  bucket: FailureBucket | 'successful_clear';
  visibleChange: Exclude<VisibleMutationChange, 'mark_added' | 'none'>;
  copy: string;
};

export type BoardSnapshot = GameSnapshot &
  BoardIdentity & {
    revision: number;
    sites: SiteSnapshot[];
    recentMutations: MutationBeat[];
  };

export function createBoardSnapshot(
  identity: BoardIdentity,
  snapshot: GameSnapshot,
  revision: number,
  recentMutations: MutationBeat[] = []
): BoardSnapshot {
  return {
    ...snapshot,
    ...identity,
    revision,
    recentMutations: recentMutations.slice(-20),
  };
}

export function createBoardIdentity(input: {
  communityId: string;
  communityName: string;
  dateKey: string;
  dailySeed: string;
}): BoardIdentity {
  if (!/^[a-zA-Z0-9_]{3,40}$/.test(input.communityId)) {
    throw new Error('Invalid community identity.');
  }

  return {
    boardId: `community:${input.communityId}:${input.dateKey}:v${TOWER_VERSION}`,
    scope: 'community',
    scopeLabel: /^[a-zA-Z0-9_]{2,21}$/.test(input.communityName)
      ? `r/${input.communityName}`
      : 'this community',
    dateKey: input.dateKey,
    dailySeed: input.dailySeed,
    towerVersion: TOWER_VERSION,
  };
}

export function mutationBeatForReceipt(
  receipt: MutationReceipt
): MutationBeat | null {
  if (
    !receipt.accepted ||
    !receipt.siteId ||
    !receipt.siteName ||
    !receipt.bucket ||
    receipt.counterAfter === null ||
    receipt.visibleChange === 'mark_added' ||
    receipt.visibleChange === 'none'
  )
    return null;

  return {
    revision: receipt.revisionAfter,
    siteId: receipt.siteId,
    siteName: receipt.siteName,
    bucket: receipt.bucket,
    visibleChange: receipt.visibleChange,
    copy: remoteMutationCopy(receipt),
  };
}

function remoteMutationCopy(receipt: MutationReceipt): string {
  const count = receipt.counterAfter ?? 0;
  const siteName = receipt.siteName ?? 'This site';
  if (receipt.visibleChange === 'site_reinforced')
    return `${count} clean clears reinforced ${siteName}.`;
  if (receipt.visibleChange === 'site_stabilized')
    return `${count} clean clears stabilized ${siteName}.`;
  if (receipt.visibleChange === 'site_cursed')
    return `${siteName} became overgrown after ${count} ${remoteBucketLabel(receipt, count)}.`;

  const verb =
    receipt.visibleChange === 'artifact_spawned' ? 'raised' : 'upgraded';
  return `${count} ${remoteBucketLabel(receipt, count)} ${verb} ${siteName} to ${remoteArtifactName(receipt)}.`;
}

function remoteBucketLabel(receipt: MutationReceipt, count: number): string {
  const singular =
    receipt.bucket === 'short_jump'
      ? 'short jump'
      : receipt.bucket === 'overjump'
        ? 'overjump'
        : receipt.bucket === 'wall_bonk'
          ? 'wall bonk'
          : receipt.bucket === 'successful_clear'
            ? 'clean clear'
            : 'helper slip';
  return count === 1 ? singular : `${singular}s`;
}

function remoteArtifactName(receipt: MutationReceipt): string {
  if (receipt.bucket === 'short_jump')
    return (receipt.counterAfter ?? 0) >= 6 ? 'Mercy Nail' : 'Corpse Stack';
  if (receipt.bucket === 'wall_bonk') return 'Ghost Platform';
  if (receipt.bucket === 'successful_clear') return 'Lantern Trail';
  return 'Cursed Brick';
}
