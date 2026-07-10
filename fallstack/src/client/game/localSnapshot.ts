import {
  clearFeedback,
  createInitialAchievements,
  deriveSnapshot,
  fallFeedback,
  ZERO_COUNTERS,
  type AchievementState,
  type GameSnapshot,
  type ZoneId,
  type ZoneMutationCounters,
} from '../../shared/game/mutation.js';
import { nextZoneId, ZONES } from '../../shared/game/tower.js';
import type { ClearEventDetail, FallEventDetail, SummitEventDetail } from './events.js';

export function applyLocalFall(
  snapshot: GameSnapshot,
  detail: FallEventDetail
): GameSnapshot {
  const counters = countersFromSnapshot(snapshot);
  counters[detail.zoneId] = {
    ...counters[detail.zoneId],
    [detail.failureBucket]: counters[detail.zoneId][detail.failureBucket] + 1,
  };
  const achievements = achievementsFromSnapshot(snapshot);
  updateLocalHighestClimber(achievements, detail.zoneId, detail.highestY);
  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters,
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
  const counters = countersFromSnapshot(snapshot);
  counters[detail.zoneId] = {
    ...counters[detail.zoneId],
    successfulClears: counters[detail.zoneId].successfulClears + 1,
  };
  const achievements = achievementsFromSnapshot(snapshot);
  updateLocalHighestClimber(achievements, detail.zoneId, detail.highestY);
  updateLocalBestStabilizer(achievements, counters[detail.zoneId].successfulClears);
  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters,
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
  updateLocalHighestClimber(achievements, 'moon_roof', detail.highestY);

  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters: countersFromSnapshot(snapshot),
    totalFalls: snapshot.totalFalls,
    totalClears: snapshot.totalClears,
    totalSummits: snapshot.totalSummits + 1,
    achievements,
  });
}

export function localFallMessage(
  snapshot: GameSnapshot,
  detail: FallEventDetail
): string {
  const zone = snapshot.zones.find((candidate) => candidate.id === detail.zoneId);
  const count = zone?.counters[detail.failureBucket] ?? 1;
  return fallFeedback({
    zoneName: zone?.name ?? 'This zone',
    bucket: detail.failureBucket,
    count,
    counted: true,
  }).replace('Your fall counted.', 'Your fall counted here.');
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
  return ZONES.find((zone) => zone.name === name)?.id ?? 'lower_ruins';
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
