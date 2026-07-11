/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  displayZoneStatus,
  fallFeedback,
  mergeAchievementState,
  type ZoneMutationCounters,
} from './mutation.js';
import { zoneForY } from './tower.js';

void test('daily seed is stable for a UTC date', () => {
  assert.deepEqual(createDailySeed(new Date('2026-07-08T12:34:00Z')), {
    dateKey: '2026-07-08',
    dailySeed: 'fallstack-2026-07-08',
  });
});

void test('seeded snapshot opens with visible shared mutation hook', () => {
  const seed = createDailySeed(new Date('2026-07-08T00:00:00Z'));
  const snapshot = deriveSnapshot({
    ...seed,
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });

  assert.equal(snapshot.headline, "Today's tower has 37 failed climbs in it.");
  assert.ok(snapshot.zones.flatMap((zone) => zone.artifacts).length >= 3);
  assert.ok(snapshot.zones.some((zone) => zone.artifacts.some((artifact) => artifact.label.includes('falls'))));
});

void test('seeded artifacts live in their owning tower zones', () => {
  const seed = createDailySeed(new Date('2026-07-08T00:00:00Z'));
  const snapshot = deriveSnapshot({
    ...seed,
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });

  for (const zone of snapshot.zones) {
    for (const artifact of zone.artifacts) {
      assert.equal(zoneForY(artifact.y).id, artifact.zoneId, artifact.id);
    }
  }
});

void test('seeded lower ruins artifacts are visible in the opening viewport', () => {
  const seed = createDailySeed(new Date('2026-07-08T00:00:00Z'));
  const snapshot = deriveSnapshot({
    ...seed,
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const lowerRuins = snapshot.zones.find((zone) => zone.id === 'lower_ruins');

  assert.ok(lowerRuins);
  assert.ok(lowerRuins.artifacts.length >= 2);
  assert.ok(lowerRuins.artifacts.every((artifact) => artifact.y >= 5200));
  assert.ok(lowerRuins.artifacts.some((artifact) => artifact.label.includes('falls')));
});

void test('zone status display labels do not leak internal state names', () => {
  assert.equal(displayZoneStatus('Quiet'), 'Untouched');
  assert.equal(displayZoneStatus('Haunted'), 'Restless');
  assert.equal(displayZoneStatus('Cursed'), 'Overgrown');
  assert.equal(displayZoneStatus('Reinforced'), 'Well-Trodden');
  assert.equal(displayZoneStatus('Stabilized'), 'Blessed');
});

void test('artifact derivation stays capped per zone under high traffic', () => {
  const busyCounters: ZoneMutationCounters = {
    short_jump: 500,
    overjump: 500,
    wall_bonk: 500,
    helper_overuse: 500,
    successfulClears: 500,
  };
  const seed = createDailySeed(new Date('2026-07-08T00:00:00Z'));
  const snapshot = deriveSnapshot({
    ...seed,
    counters: {
      lower_ruins: busyCounters,
      bell_shaft: busyCounters,
      moon_roof: busyCounters,
    },
    totalFalls: 1500,
    totalClears: 500,
    totalSummits: 1,
    achievements: {
      ...createInitialAchievements(),
      firstSummitUsername: 'u/riverknife',
      bestStabilizerUsername: 'u/riverknife',
      highestClimberUsername: 'u/riverknife',
    },
  });

  assert.equal(snapshot.zones.every((zone) => zone.artifacts.length <= 3), true);
  assert.equal(snapshot.zones.every((zone) => zone.status === 'Stabilized'), true);
  assert.equal(snapshot.result.summitStatus, 'Summit Cleared');
  assert.equal(snapshot.result.mostCursedStatus, 'Blessed');
});

void test('fall feedback is short, specific, and cap-aware', () => {
  assert.equal(
    fallFeedback({
      zoneName: 'Bell Shaft',
      bucket: 'wall_bonk',
      count: 2,
      counted: true,
    }),
    'Your fall counted. 1 more wall bonk spawns Ghost Platform.'
  );
  assert.equal(
    fallFeedback({
      zoneName: 'Bell Shaft',
      bucket: 'wall_bonk',
      count: 3,
      counted: true,
    }),
    'Your fall spawned Ghost Platform in Bell Shaft.'
  );
  assert.equal(
    fallFeedback({
      zoneName: 'Lower Ruins',
      bucket: 'short_jump',
      count: 6,
      counted: true,
    }),
    'Your fall upgraded Mercy Nail in Lower Ruins.'
  );
  assert.equal(
    fallFeedback({
      zoneName: 'Moon Roof',
      bucket: 'overjump',
      count: 9,
      counted: true,
    }),
    'Your fall counted. 1 more overjump will overgrow Moon Roof.'
  );
  assert.equal(
    fallFeedback({
      zoneName: 'Moon Roof',
      bucket: 'overjump',
      count: 10,
      counted: false,
    }),
    'Moon Roof has heard enough from you today.'
  );
});

void test('achievement merges preserve monotonic community records', () => {
  const current = {
    ...createInitialAchievements(),
    firstSummitUsername: 'u/first',
    firstSummitAt: 100,
    highestClimberUsername: 'u/highest',
    highestClimberZone: 'bell_shaft' as const,
    highestClimberY: 1200,
    bestStabilizerUsername: 'u/stable',
    bestStabilizerClears: 2,
  };

  const merged = mergeAchievementState(current, {
    firstSummitUsername: 'u/late',
    firstSummitAt: 200,
    highestClimberUsername: 'u/summit',
    highestClimberZone: 'moon_roof',
    highestClimberY: 260,
    bestStabilizerUsername: 'u/steadier',
    bestStabilizerClears: 4,
  });

  assert.equal(merged.firstSummitUsername, 'u/first');
  assert.equal(merged.firstSummitAt, 100);
  assert.equal(merged.highestClimberUsername, 'u/summit');
  assert.equal(merged.highestClimberZone, 'moon_roof');
  assert.equal(merged.highestClimberY, 260);
  assert.equal(merged.bestStabilizerUsername, 'u/steadier');
  assert.equal(merged.bestStabilizerClears, 4);
});

void test('achievement merges ignore stale or incomplete records', () => {
  const current = createInitialAchievements();

  const merged = mergeAchievementState(current, {
    highestClimberUsername: 'u/missing-zone',
    highestClimberZone: 'bad_zone',
    highestClimberY: 100,
    bestStabilizerClears: 3,
  } as unknown as Parameters<typeof mergeAchievementState>[1]);

  assert.deepEqual(merged, current);
});
