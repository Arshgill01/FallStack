/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BOTTOM_ZONE_ID,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
  TOP_ZONE_ID,
} from './mutation.js';
import { deriveImpactSites } from './impact-sites.js';
import {
  resolveClearSite,
  resolveFallObservation,
  type FallObservation,
} from './mutation-events.js';
import { generateDailyTower, WORLD_HEIGHT } from './tower.js';

const dailySeed = 'fallstack-2026-07-13';

function seededSnapshot() {
  return deriveSnapshot({
    dailySeed,
    dateKey: '2026-07-13',
    counters: createSeededCounters(),
    totalFalls: SEEDED_TOTAL_FALLS,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
}

function bottomObservation(
  attemptId: string,
  overrides: Partial<FallObservation> = {}
): FallObservation {
  return {
    attemptId,
    respawnZoneId: BOTTOM_ZONE_ID,
    fallX: 240,
    fallY: WORLD_HEIGHT + 40,
    highestY: WORLD_HEIGHT - 180,
    lastPlatformId: 'start',
    lastHelperArtifactId: null,
    wallBonkPlatformId: null,
    launchChargePercent: 62,
    launchDirection: -1,
    ...overrides,
  };
}

void test('server-side observation resolves a short fall to First Gap', () => {
  const tower = generateDailyTower(dailySeed);
  const start = tower.platforms.find((platform) => platform.id === 'start');
  const snapshot = seededSnapshot();

  assert.ok(start);
  assert.deepEqual(
    resolveFallObservation(
      {
        attemptId: 'attempt_observation_1',
        respawnZoneId: start.zoneId,
        fallX: start.x + start.width / 2,
        fallY: WORLD_HEIGHT + 40,
        highestY: start.y - 80,
        lastPlatformId: start.id,
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 62,
        launchDirection: -1,
      },
      snapshot
    ),
    {
      ok: true,
      value: {
        zoneId: start.zoneId,
        siteId: snapshot.zones[0]?.artifacts.find(
          (artifact) => artifact.siteName === 'First Gap'
        )?.siteId,
        siteName: 'First Gap',
        bucket: 'short_jump',
      },
    }
  );
});

void test('server-side observation rejects platform evidence from another zone', () => {
  const tower = generateDailyTower(dailySeed);
  const start = tower.platforms.find((platform) => platform.id === 'start');
  const topPlatform = tower.platforms.find(
    (platform) => platform.zoneId === TOP_ZONE_ID
  );
  const snapshot = seededSnapshot();

  assert.ok(start);
  assert.ok(topPlatform);
  assert.deepEqual(
    resolveFallObservation(
      {
        attemptId: 'attempt_observation_2',
        respawnZoneId: start.zoneId,
        fallX: start.x + start.width / 2,
        fallY: WORLD_HEIGHT + 40,
        highestY: start.y - 80,
        lastPlatformId: topPlatform.id,
        lastHelperArtifactId: null,
        wallBonkPlatformId: null,
        launchChargePercent: 62,
        launchDirection: -1,
      },
      snapshot
    ),
    { ok: false, message: 'Invalid fall observation.' }
  );
});

void test('helper evidence wins over charge and resolves to the helper site', () => {
  const snapshot = seededSnapshot();
  const helper = snapshot.zones
    .find((zone) => zone.id === BOTTOM_ZONE_ID)
    ?.artifacts.find(
      (artifact) =>
        artifact.type === 'corpse_stack' || artifact.type === 'mercy_nail'
    );

  assert.ok(helper);
  assert.deepEqual(
    resolveFallObservation(
      bottomObservation('attempt_observation_3', {
        lastHelperArtifactId: helper.id,
        launchChargePercent: 100,
      }),
      snapshot
    ),
    {
      ok: true,
      value: {
        zoneId: BOTTOM_ZONE_ID,
        siteId: helper.siteId,
        siteName: helper.siteName,
        bucket: 'helper_overuse',
      },
    }
  );
});

void test('wall evidence resolves to the impacted anchor site', () => {
  const snapshot = seededSnapshot();
  const tower = generateDailyTower(dailySeed);
  const site = deriveImpactSites(tower).find(
    (candidate) => candidate.zoneId === BOTTOM_ZONE_ID && candidate.name !== 'First Gap'
  );

  assert.ok(site);
  assert.deepEqual(
    resolveFallObservation(
      bottomObservation('attempt_observation_4', {
        lastPlatformId: site.approachPlatformId,
        wallBonkPlatformId: site.anchorPlatformId,
      }),
      snapshot
    ),
    {
      ok: true,
      value: {
        zoneId: BOTTOM_ZONE_ID,
        siteId: site.id,
        siteName: site.name,
        bucket: 'wall_bonk',
      },
    }
  );
});

void test('coordinate fallback resolves to the nearest site anchor', () => {
  const snapshot = seededSnapshot();
  const tower = generateDailyTower(dailySeed);
  const sites = deriveImpactSites(tower).filter(
    (candidate) => candidate.zoneId === BOTTOM_ZONE_ID
  );
  const site = sites.at(-1);
  const anchor = tower.platforms.find(
    (platform) => platform.id === site?.anchorPlatformId
  );

  assert.ok(site);
  assert.ok(anchor);
  assert.deepEqual(
    resolveFallObservation(
      bottomObservation('attempt_observation_5', {
        fallX: anchor.x + anchor.width / 2,
        highestY: anchor.y,
        lastPlatformId: null,
        launchChargePercent: 91,
        launchDirection: 1,
      }),
      snapshot
    ),
    {
      ok: true,
      value: {
        zoneId: BOTTOM_ZONE_ID,
        siteId: site.id,
        siteName: site.name,
        bucket: 'overjump',
      },
    }
  );
});

void test('clean clear resolves to the zone site carrying the most failure', () => {
  assert.deepEqual(resolveClearSite(seededSnapshot(), BOTTOM_ZONE_ID), {
    siteId: seededSnapshot().sites.find(
      (site) => site.zoneId === BOTTOM_ZONE_ID && site.name === 'First Gap'
    )?.id,
    siteName: 'First Gap',
  });
});
