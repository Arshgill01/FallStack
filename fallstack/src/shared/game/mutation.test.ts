/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOTTOM_ZONE_ID,
  TOP_ZONE_ID,
  ZONE_HEIGHT,
  ZONE_IDS,
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  createSeededSiteCounters,
  deriveSnapshot,
  displayZoneStatus,
  fallFeedback,
  clearFeedback,
  mergeAchievementState,
  SEEDED_TOTAL_FALLS,
  type ZoneId,
  type ZoneMutationCounters,
} from './mutation.js';
import { deriveImpactSites } from './impact-sites.js';
import { generateDailyTower, WORLD_HEIGHT, zoneForY } from './tower.js';

const MID_ZONE_ID = ZONE_IDS[Math.floor(ZONE_IDS.length / 2)] as ZoneId;

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

  assert.equal(snapshot.headline, '37 opening scars · 0 community falls');
  assert.equal(snapshot.zones[0]?.statusLabel, 'Many falls');
  assert.ok(snapshot.zones.flatMap((zone) => zone.artifacts).length >= 3);
  assert.ok(
    snapshot.zones.some((zone) =>
      zone.artifacts.some((artifact) => artifact.label.includes('opening'))
    )
  );
});

void test('seeded failure counters agree with the advertised opening total', () => {
  const counters = createSeededCounters();
  const failures = Object.values(counters).reduce(
    (total, zone) =>
      total +
      zone.short_jump +
      zone.overjump +
      zone.wall_bonk +
      zone.helper_overuse,
    0
  );

  assert.equal(failures, SEEDED_TOTAL_FALLS);
});

void test('snapshot separates seeded scars from community additions', () => {
  const counters = createSeededCounters();
  counters[BOTTOM_ZONE_ID].short_jump += 1;
  const snapshot = deriveSnapshot({
    dailySeed: 'fallstack-2026-07-13',
    dateKey: '2026-07-13',
    counters,
    totalFalls: SEEDED_TOTAL_FALLS + 1,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const helper = snapshot.zones[0]?.artifacts.find(
    (artifact) => artifact.bucket === 'short_jump'
  );

  assert.equal(snapshot.seededFalls, SEEDED_TOTAL_FALLS);
  assert.equal(snapshot.organicFalls, 1);
  assert.ok(helper);
  assert.equal(helper.seededCount, 4);
  assert.equal(helper.organicCount, 1);
});

void test('site counters keep an organic fall attached to its resolved impact site', () => {
  const dailySeed = 'fallstack-2026-07-13';
  const impactSites = deriveImpactSites(generateDailyTower(dailySeed));
  const site = impactSites.find(
    (candidate) =>
      candidate.zoneId === BOTTOM_ZONE_ID && candidate.name !== 'First Gap'
  );
  const siteCounters = createSeededSiteCounters(dailySeed);

  assert.ok(site);
  siteCounters[site.id]!.short_jump += 1;
  const snapshot = deriveSnapshot({
    dailySeed,
    dateKey: '2026-07-13',
    counters: createSeededCounters(),
    siteCounters,
    totalFalls: SEEDED_TOTAL_FALLS + 1,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const changedSite = snapshot.sites.find(
    (candidate) => candidate.id === site.id
  );

  assert.ok(changedSite);
  assert.equal(changedSite.counters.short_jump, 1);
  assert.equal(changedSite.seededCounters.short_jump, 0);
  assert.equal(changedSite.organicCounters.short_jump, 1);
  assert.equal(
    snapshot.sites.find((candidate) => candidate.name === 'First Gap')
      ?.counters.short_jump,
    4
  );
});

void test('site threshold derives its artifact at that exact impact site', () => {
  const dailySeed = 'fallstack-2026-07-13';
  const site = deriveImpactSites(generateDailyTower(dailySeed)).find(
    (candidate) =>
      candidate.zoneId === BOTTOM_ZONE_ID && candidate.name !== 'First Gap'
  );
  const siteCounters = createSeededSiteCounters(dailySeed);

  assert.ok(site);
  siteCounters[site.id]!.short_jump = 3;
  const snapshot = deriveSnapshot({
    dailySeed,
    dateKey: '2026-07-13',
    counters: createSeededCounters(),
    siteCounters,
    totalFalls: SEEDED_TOTAL_FALLS + 3,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const artifact = snapshot.sites
    .find((candidate) => candidate.id === site.id)
    ?.artifacts.find((candidate) => candidate.bucket === 'short_jump');

  assert.ok(artifact);
  assert.equal(artifact.siteId, site.id);
  assert.deepEqual(
    {
      x: artifact.x,
      y: artifact.y,
      width: artifact.width,
      height: artifact.height,
    },
    site.helperSlot
  );
});

void test('site stabilization preserves the failure history it transforms', () => {
  const dailySeed = 'fallstack-2026-07-13';
  const site = deriveImpactSites(generateDailyTower(dailySeed))[0];
  const siteCounters = createSeededSiteCounters(dailySeed);

  assert.ok(site);
  siteCounters[site.id] = {
    short_jump: 6,
    overjump: 10,
    wall_bonk: 3,
    helper_overuse: 0,
    successfulClears: 6,
  };
  const snapshot = deriveSnapshot({
    dailySeed,
    dateKey: '2026-07-13',
    counters: createSeededCounters(),
    siteCounters,
    totalFalls: SEEDED_TOTAL_FALLS + 15,
    totalClears: 6,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const stabilized = snapshot.sites.find(
    (candidate) => candidate.id === site.id
  );

  assert.ok(stabilized);
  assert.equal(stabilized.status, 'Stabilized');
  assert.equal(stabilized.counters.short_jump, 6);
  assert.equal(stabilized.counters.overjump, 10);
  assert.equal(stabilized.counters.wall_bonk, 3);
  assert.equal(stabilized.counters.successfulClears, 6);
  assert.equal(
    stabilized.artifacts.some(
      (artifact) => artifact.bucket === 'successful_clear'
    ),
    true
  );
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

void test('seeded bottom-zone artifacts are visible in the opening viewport', () => {
  const seed = createDailySeed(new Date('2026-07-08T00:00:00Z'));
  const snapshot = deriveSnapshot({
    ...seed,
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const bottomZone = snapshot.zones.find((zone) => zone.id === BOTTOM_ZONE_ID);

  assert.ok(bottomZone);
  assert.ok(bottomZone.artifacts.length >= 2);
  assert.ok(
    bottomZone.artifacts.every(
      (artifact) => artifact.y >= (ZONE_IDS.length - 1) * ZONE_HEIGHT
    )
  );
  assert.ok(
    bottomZone.artifacts.some((artifact) =>
      artifact.label.includes('opening short-jump scars')
    )
  );
});

void test('the opening helper sits on the first jump line', () => {
  const snapshot = deriveSnapshot({
    dailySeed: 'fallstack-2026-07-12',
    dateKey: '2026-07-12',
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const helper = snapshot.zones[0]?.artifacts.find(
    (artifact) => artifact.bucket === 'short_jump'
  );

  assert.ok(helper);
  assert.equal(helper.type, 'corpse_stack');
  const openingSite = deriveImpactSites(
    generateDailyTower('fallstack-2026-07-12')
  )[0];
  assert.deepEqual(
    {
      x: helper.x,
      y: helper.y,
      width: helper.width,
      height: helper.height,
    },
    openingSite?.helperSlot
  );
  assert.ok(helper.y > WORLD_HEIGHT - 180 && helper.y < WORLD_HEIGHT - 60);
});

void test('seeded opening mutation is anchored to the generated First Gap site', () => {
  const dailySeed = 'fallstack-2026-07-13';
  const openingSite = deriveImpactSites(generateDailyTower(dailySeed))[0];
  const snapshot = deriveSnapshot({
    dailySeed,
    dateKey: '2026-07-13',
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
  const helper = snapshot.zones[0]?.artifacts.find(
    (artifact) => artifact.bucket === 'short_jump'
  );

  assert.ok(openingSite);
  assert.ok(helper);
  assert.equal(helper.siteId, openingSite.id);
  assert.equal(helper.siteName, 'First Gap');
  assert.equal(helper.anchorPlatformId, openingSite.anchorPlatformId);
  assert.deepEqual(
    {
      x: helper.x,
      y: helper.y,
      width: helper.width,
      height: helper.height,
    },
    openingSite.helperSlot
  );
});

void test('zone status display labels do not leak internal state names', () => {
  assert.equal(displayZoneStatus('Quiet'), 'Low activity');
  assert.equal(displayZoneStatus('Haunted'), 'Many falls');
  assert.equal(displayZoneStatus('Cursed'), 'Hazard pressure');
  assert.equal(displayZoneStatus('Reinforced'), 'Clean clears');
  assert.equal(displayZoneStatus('Stabilized'), 'Stabilized');
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
    counters: Object.fromEntries(
      ZONE_IDS.map((zoneId) => [zoneId, { ...busyCounters }])
    ) as Record<ZoneId, ZoneMutationCounters>,
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

  assert.equal(
    snapshot.zones.every((zone) => zone.artifacts.length <= 3),
    true
  );
  assert.equal(
    snapshot.zones.every((zone) => zone.status === 'Stabilized'),
    true
  );
  assert.equal(snapshot.result.summitStatus, 'Summit Cleared');
  assert.equal(snapshot.result.mostCursedStatus, 'Stabilized');
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
      zoneName: 'Lower Ruins',
      bucket: 'helper_overuse',
      count: 2,
      counted: true,
    }),
    'Your fall counted. 1 more helper slip spawns Cursed Brick.'
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

void test('clear feedback uses player-facing zone status labels', () => {
  assert.equal(
    clearFeedback({
      zoneName: 'Lower Ruins',
      clears: 1,
      counted: true,
      nextZoneStatus: 'Quiet',
    }),
    'Lower Ruins cleared. Next: Low activity.'
  );
});

void test('achievement merges preserve monotonic community records', () => {
  const current = {
    ...createInitialAchievements(),
    firstSummitUsername: 'u/first',
    firstSummitAt: 100,
    highestClimberUsername: 'u/highest',
    highestClimberZone: MID_ZONE_ID,
    highestClimberY: zoneTopForTest(MID_ZONE_ID) + 300,
    bestStabilizerUsername: 'u/stable',
    bestStabilizerClears: 2,
  };

  const merged = mergeAchievementState(current, {
    firstSummitUsername: 'u/late',
    firstSummitAt: 200,
    highestClimberUsername: 'u/summit',
    highestClimberZone: TOP_ZONE_ID,
    highestClimberY: 260,
    bestStabilizerUsername: 'u/steadier',
    bestStabilizerClears: 4,
  });

  assert.equal(merged.firstSummitUsername, 'u/first');
  assert.equal(merged.firstSummitAt, 100);
  assert.equal(merged.highestClimberUsername, 'u/summit');
  assert.equal(merged.highestClimberZone, TOP_ZONE_ID);
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

function zoneTopForTest(zoneId: ZoneId): number {
  const bottomUpIndex = ZONE_IDS.indexOf(zoneId);
  return (ZONE_IDS.length - bottomUpIndex - 1) * ZONE_HEIGHT;
}
