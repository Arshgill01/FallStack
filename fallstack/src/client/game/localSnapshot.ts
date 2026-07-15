import {
  BOTTOM_ZONE_ID,
  clearFeedback,
  createInitialAchievements,
  deriveSnapshot,
  fallFeedback,
  TOP_ZONE_ID,
  ZERO_COUNTERS,
  type AchievementState,
  type FailureBucket,
  type GameSnapshot,
  type SiteMutationCounters,
  type ZoneId,
  type ZoneMutationCounters,
} from '../../shared/game/mutation.js';
import { resolveClearSite } from '../../shared/game/mutation-events.js';
import { nextZoneId, ZONES } from '../../shared/game/tower.js';
import type { ClearEventDetail, SummitEventDetail } from './events.js';

export type ResolvedFallDetail = {
  attemptId: string;
  zoneId: ZoneId;
  siteId: string;
  siteName: string;
  failureBucket: FailureBucket;
  chargePercent: number;
  highestY: number;
};

export function openingMutationMessage(
  snapshot: GameSnapshot,
  sharedAvailable: boolean
): string {
  const openingArtifact = snapshot.zones
    .flatMap((zone) => zone.artifacts)
    .find(
      (artifact) =>
        artifact.siteName === 'First Gap' && artifact.bucket === 'short_jump'
    );
  const cause = openingArtifact
    ? openingArtifact.organicCount > 0
      ? `${openingArtifact.seededCount} opening + ${openingArtifact.organicCount} community falls raised ${openingArtifact.siteName}.`
      : `${openingArtifact.seededCount} opening scars raised ${openingArtifact.siteName}.`
    : 'The day opened scarred.';
  if (!sharedAvailable) {
    return `Local practice only. ${cause} Nothing here changes the shared tower.`;
  }

  const scopeLabel =
    'scopeLabel' in snapshot && typeof snapshot.scopeLabel === 'string'
      ? snapshot.scopeLabel
      : 'This subreddit';
  return `${scopeLabel} shares one daily tower. ${cause}`;
}

export function applyLocalFall(
  snapshot: GameSnapshot,
  detail: ResolvedFallDetail
): GameSnapshot {
  const siteCounters = siteCountersFromSnapshot(snapshot);
  const counters = siteCounters[detail.siteId];
  if (!counters) return snapshot;
  counters[detail.failureBucket] += 1;
  const achievements = achievementsFromSnapshot(snapshot);
  updateLocalHighestClimber(achievements, detail.zoneId, detail.highestY);
  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters: countersFromSnapshot(snapshot),
    siteCounters,
    totalFalls: snapshot.totalFalls + 1,
    totalClears: snapshot.totalClears,
    totalSummits: snapshot.totalSummits,
    achievements,
  });
}

export function applyLocalClear(
  snapshot: GameSnapshot,
  detail: ClearEventDetail
): GameSnapshot {
  const siteCounters = siteCountersFromSnapshot(snapshot);
  const clearSite = resolveClearSite(snapshot, detail.zoneId);
  if (!clearSite) return snapshot;
  siteCounters[clearSite.siteId]!.successfulClears += 1;
  const achievements = achievementsFromSnapshot(snapshot);
  updateLocalHighestClimber(achievements, detail.zoneId, detail.highestY);
  const successfulClears = snapshot.zones.find(
    (zone) => zone.id === detail.zoneId
  )?.counters.successfulClears;
  updateLocalBestStabilizer(achievements, (successfulClears ?? 0) + 1);
  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters: countersFromSnapshot(snapshot),
    siteCounters,
    totalFalls: snapshot.totalFalls,
    totalClears: snapshot.totalClears + 1,
    totalSummits: snapshot.totalSummits,
    achievements,
  });
}

export function applyLocalSummit(
  snapshot: GameSnapshot,
  detail: SummitEventDetail
): GameSnapshot {
  const achievements = achievementsFromSnapshot(snapshot);
  if (!achievements.firstSummitUsername) {
    achievements.firstSummitUsername = 'you';
    achievements.firstSummitAt = Date.now();
  }
  updateLocalHighestClimber(achievements, TOP_ZONE_ID, detail.highestY);

  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters: countersFromSnapshot(snapshot),
    siteCounters: siteCountersFromSnapshot(snapshot),
    totalFalls: snapshot.totalFalls,
    totalClears: snapshot.totalClears,
    totalSummits: snapshot.totalSummits + 1,
    achievements,
  });
}

export function localFallMessage(
  snapshot: GameSnapshot,
  detail: ResolvedFallDetail
): string {
  const site = snapshot.sites.find((candidate) => candidate.id === detail.siteId);
  const count = site?.counters[detail.failureBucket] ?? 1;
  return fallFeedback({
    zoneName: site?.name ?? detail.siteName,
    bucket: detail.failureBucket,
    count,
    counted: true,
  }).replace('Your fall counted.', 'Your fall counted here.');
}

function siteCountersFromSnapshot(
  snapshot: GameSnapshot
): Record<string, SiteMutationCounters> {
  return Object.fromEntries(
    snapshot.sites.map((site) => [site.id, { ...site.counters }])
  );
}

export function localClearMessage(
  snapshot: GameSnapshot,
  detail: ClearEventDetail
): string {
  const zone = snapshot.zones.find((candidate) => candidate.id === detail.zoneId);
  const next = nextZoneId(detail.zoneId);
  const nextZone = next
    ? snapshot.zones.find((candidate) => candidate.id === next)
    : undefined;
  return clearFeedback({
    zoneName: zone?.name ?? 'This zone',
    clears: zone?.counters.successfulClears ?? 1,
    counted: true,
    ...(nextZone ? { nextZoneStatus: nextZone.status } : {}),
  });
}

function countersFromSnapshot(
  snapshot: GameSnapshot
): Record<ZoneId, ZoneMutationCounters> {
  return Object.fromEntries(
    ZONES.map((zone) => {
      const current = snapshot.zones.find((candidate) => candidate.id === zone.id);
      return [zone.id, { ...ZERO_COUNTERS, ...current?.counters }];
    })
  ) as Record<ZoneId, ZoneMutationCounters>;
}

function achievementsFromSnapshot(snapshot: GameSnapshot): AchievementState {
  const achievements = createInitialAchievements();
  if (snapshot.result.firstSummitUsername) {
    achievements.firstSummitUsername = snapshot.result.firstSummitUsername;
  }
  if (snapshot.result.bestStabilizerUsername) {
    achievements.bestStabilizerUsername = snapshot.result.bestStabilizerUsername;
    achievements.bestStabilizerClears = Math.max(
      ...snapshot.zones.map((zone) => zone.counters.successfulClears),
      0
    );
  }
  if (snapshot.result.highestClimberUsername) {
    achievements.highestClimberUsername = snapshot.result.highestClimberUsername;
    achievements.highestClimberZone = zoneIdForName(snapshot.result.highestClimberZone);
    achievements.highestClimberY = zoneTopForName(snapshot.result.highestClimberZone);
  }
  return achievements;
}

function zoneIdForName(name: string): ZoneId {
  return ZONES.find((zone) => zone.name === name)?.id ?? BOTTOM_ZONE_ID;
}

function zoneTopForName(name: string): number {
  return ZONES.find((zone) => zone.name === name)?.yTop ?? createInitialAchievements().highestClimberY;
}

function updateLocalHighestClimber(
  achievements: AchievementState,
  zoneId: ZoneId,
  highestY: number | undefined
) {
  if (typeof highestY !== 'number' || Number.isNaN(highestY)) return;
  if (highestY < achievements.highestClimberY) {
    achievements.highestClimberY = Math.max(260, highestY);
    achievements.highestClimberZone = zoneId;
    achievements.highestClimberUsername = 'you';
  }
}

function updateLocalBestStabilizer(achievements: AchievementState, clearCount: number) {
  if (clearCount > achievements.bestStabilizerClears) {
    achievements.bestStabilizerClears = clearCount;
    achievements.bestStabilizerUsername = 'you';
  }
}
