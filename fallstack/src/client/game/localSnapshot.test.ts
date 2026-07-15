/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOTTOM_ZONE_ID,
  TOP_ZONE_ID,
  ZONE_IDS,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  type FailureBucket,
  type GameSnapshot,
  type ZoneId,
} from '../../shared/game/mutation.js';
import {
  createBoardIdentity,
  createBoardSnapshot,
} from '../../shared/game/board.js';
import { zoneById } from '../../shared/game/tower.js';
import {
  applyLocalClear,
  applyLocalFall,
  applyLocalSummit,
  localFallMessage,
  openingMutationMessage,
} from './localSnapshot.js';

const MID_ZONE_ID = ZONE_IDS[Math.floor(ZONE_IDS.length / 2)] as ZoneId;

const baseSnapshot = () =>
  deriveSnapshot({
    dailySeed: 'fallstack-2026-07-10',
    dateKey: '2026-07-10',
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });

function siteForBucket(
  snapshot: GameSnapshot,
  zoneId: ZoneId,
  bucket: FailureBucket
) {
  const site = snapshot.sites
    .filter((candidate) => candidate.zoneId === zoneId)
    .sort(
      (left, right) => right.counters[bucket] - left.counters[bucket]
    )[0];
  if (!site) throw new Error(`Missing impact site for ${zoneId}.`);
  return site;
}

void test('opening mutation copy names shared scope, site, and seeded origin', () => {
  const gameSnapshot = baseSnapshot();
  const sharedSnapshot = createBoardSnapshot(
    createBoardIdentity({
      communityId: 't5_fallstack',
      communityName: 'FallStack',
      dateKey: gameSnapshot.dateKey,
      dailySeed: gameSnapshot.dailySeed,
    }),
    gameSnapshot,
    4
  );
  assert.equal(
    openingMutationMessage(sharedSnapshot, true),
    'r/FallStack shares one daily tower. 4 opening falls raised First Gap.'
  );
  assert.equal(
    openingMutationMessage(baseSnapshot(), false),
    'Local practice only. 4 opening falls raised First Gap. Nothing here changes the shared tower.'
  );
});

void test('local fall updates derived counters without server state', () => {
  const mid = zoneById(MID_ZONE_ID);
  const snapshot = baseSnapshot();
  const site = siteForBucket(snapshot, MID_ZONE_ID, 'wall_bonk');
  const detail = {
    attemptId: 'attempt_local_fall',
    zoneId: MID_ZONE_ID,
    siteId: site.id,
    siteName: site.name,
    failureBucket: 'wall_bonk',
    chargePercent: 63,
    highestY: mid.yBottom - 500,
  } as const;
  const next = applyLocalFall(snapshot, detail);
  const midZone = next.zones.find((zone) => zone.id === MID_ZONE_ID);

  assert.equal(next.totalFalls, 38);
  assert.equal(midZone?.counters.wall_bonk, 3);
  assert.match(
    localFallMessage(next, detail),
    /spawned Ghost Platform/
  );
});

void test('local clear and summit update result summary', () => {
  const bottom = zoneById(BOTTOM_ZONE_ID);
  const cleared = applyLocalClear(baseSnapshot(), {
    attemptId: 'attempt_local_clear',
    zoneId: BOTTOM_ZONE_ID,
    highestY: bottom.yTop - 10,
  });
  const summit = applyLocalSummit(cleared, {
    attemptId: 'attempt_local_summit',
    highestY: 280,
  });

  assert.equal(cleared.totalClears, 1);
  assert.equal(
    cleared.zones.find((zone) => zone.id === BOTTOM_ZONE_ID)?.counters
      .successfulClears,
    3
  );
  assert.equal(summit.totalSummits, 1);
  assert.equal(summit.result.summitStatus, 'Summit Cleared');
  assert.equal(summit.result.firstSummitUsername, 'you');
  assert.equal(summit.result.highestClimberUsername, 'you');
  assert.equal(summit.result.highestClimberZone, zoneById(TOP_ZONE_ID).name);
  assert.equal(cleared.result.bestStabilizerUsername, 'you');
});

void test('local events preserve existing local result achievements', () => {
  const summit = applyLocalSummit(baseSnapshot(), {
    attemptId: 'attempt_local_summit',
    highestY: 260,
  });
  const site = siteForBucket(summit, TOP_ZONE_ID, 'short_jump');
  const afterFall = applyLocalFall(summit, {
    attemptId: 'attempt_after_summit_fall',
    zoneId: TOP_ZONE_ID,
    siteId: site.id,
    siteName: site.name,
    failureBucket: 'short_jump',
    chargePercent: 72,
    highestY: 900,
  });
  const afterClear = applyLocalClear(afterFall, {
    attemptId: 'attempt_after_summit_clear',
    zoneId: MID_ZONE_ID,
    highestY: zoneById(MID_ZONE_ID).yTop - 10,
  });

  assert.equal(afterFall.totalSummits, 1);
  assert.equal(afterFall.result.firstSummitUsername, 'you');
  assert.equal(afterFall.result.highestClimberUsername, 'you');
  assert.equal(afterFall.result.highestClimberZone, zoneById(TOP_ZONE_ID).name);
  assert.equal(afterClear.result.firstSummitUsername, 'you');
  assert.equal(afterClear.result.highestClimberUsername, 'you');
  assert.equal(afterClear.result.highestClimberZone, zoneById(TOP_ZONE_ID).name);
});

void test('local falls and clears update highest climber when progress improves', () => {
  const mid = zoneById(MID_ZONE_ID);
  const bottom = zoneById(BOTTOM_ZONE_ID);
  const snapshot = baseSnapshot();
  const site = siteForBucket(snapshot, MID_ZONE_ID, 'short_jump');
  const afterFall = applyLocalFall(snapshot, {
    attemptId: 'attempt_local_high_fall',
    zoneId: MID_ZONE_ID,
    siteId: site.id,
    siteName: site.name,
    failureBucket: 'short_jump',
    chargePercent: 81,
    highestY: mid.yTop + 200,
  });
  const afterLowerClear = applyLocalClear(afterFall, {
    attemptId: 'attempt_local_lower_clear',
    zoneId: BOTTOM_ZONE_ID,
    highestY: bottom.yTop - 10,
  });

  assert.equal(afterFall.result.highestClimberUsername, 'you');
  assert.equal(afterFall.result.highestClimberZone, mid.name);
  assert.equal(afterLowerClear.result.highestClimberUsername, 'you');
  assert.equal(afterLowerClear.result.highestClimberZone, mid.name);
});
