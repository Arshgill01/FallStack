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
import type { ClearEventDetail, FallEventDetail } from './events.js';

export function applyLocalFall(
  snapshot: GameSnapshot,
  detail: FallEventDetail
): GameSnapshot {
  const counters = countersFromSnapshot(snapshot);
  counters[detail.zoneId] = {
    ...counters[detail.zoneId],
    [detail.failureBucket]: counters[detail.zoneId][detail.failureBucket] + 1,
  };
  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters,
    totalFalls: snapshot.totalFalls + 1,
    totalClears: snapshot.totalClears,
    totalSummits: snapshot.totalSummits,
    achievements: achievementsFromSnapshot(snapshot),
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
  return deriveSnapshot({
    dailySeed: snapshot.dailySeed,
    dateKey: snapshot.dateKey,
    counters,
    totalFalls: snapshot.totalFalls,
    totalClears: snapshot.totalClears + 1,
    totalSummits: snapshot.totalSummits,
    achievements: achievementsFromSnapshot(snapshot),
  });
}

export function applyLocalSummit(snapshot: GameSnapshot): GameSnapshot {
  const achievements = achievementsFromSnapshot(snapshot);
  achievements.firstSummitUsername = 'you';
  achievements.firstSummitAt = Date.now();
  achievements.highestClimberUsername = 'you';
  achievements.highestClimberZone = 'moon_roof';
  achievements.highestClimberY = 260;

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
  }
  return achievements;
}

function zoneIdForName(name: string): ZoneId {
  return ZONES.find((zone) => zone.name === name)?.id ?? 'lower_ruins';
}
