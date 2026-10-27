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
  scopeFallEvidenceToZone,
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

// A stabilized First Gap whose hazard slot held an overjump Corpse Stack
// until louder helper slips turned it into a Mercy Nail.
function displacedHelperSnapshot(overjumps: number) {
  const seeded = seededSnapshot();
  const firstGap = seeded.sites.find((site) => site.name === 'First Gap')!;
  return {
    firstGap,
    snapshot: deriveSnapshot({
      dailySeed,
      dateKey: '2026-07-13',
      counters: createSeededCounters(),
      siteCounters: Object.fromEntries(
        seeded.sites.map((site) => [
          site.id,
          site.id === firstGap.id
            ? {
                ...site.counters,
                overjump: overjumps,
                helper_overuse: 5,
                successfulClears: 6,
              }
            : site.counters,
        ])
      ),
      totalFalls: SEEDED_TOTAL_FALLS,
      totalClears: 0,
      totalSummits: 0,
      achievements: createInitialAchievements(),
    }),
  };
}

void test('a helper displaced by other climbers still resolves as a helper slip', () => {
  const { firstGap, snapshot } = displacedHelperSnapshot(4);
  const helperId = `${firstGap.id}-overjump`;
  assert.equal(
    snapshot.zones
      .flatMap((zone) => zone.artifacts)
      .some((artifact) => artifact.id === helperId),
    false,
    'the helper is no longer rendered'
  );

  assert.deepEqual(
    resolveFallObservation(
      bottomObservation('attempt_displaced_helper', {
        lastHelperArtifactId: helperId,
      }),
      snapshot
    ),
    {
      ok: true,
      value: {
        zoneId: BOTTOM_ZONE_ID,
        siteId: firstGap.id,
        siteName: firstGap.name,
        bucket: 'helper_overuse',
      },
    }
  );
});

void test('helper evidence the site never earned is rejected', () => {
  const { firstGap, snapshot } = displacedHelperSnapshot(2);
  for (const forged of [
    `${firstGap.id}-overjump`,
    `${firstGap.id}-wall_bonk`,
    'impact-v1:nowhere-short_jump',
  ]) {
    assert.equal(
      resolveFallObservation(
        bottomObservation('attempt_forged_helper', {
          lastHelperArtifactId: forged,
        }),
        snapshot
      ).ok,
      false,
      forged
    );
  }
});

void test('wall evidence resolves to the impacted anchor site', () => {
  const snapshot = seededSnapshot();
  const tower = generateDailyTower(dailySeed);
  const site = deriveImpactSites(tower).find(
    (candidate) =>
      candidate.zoneId === BOTTOM_ZONE_ID && candidate.name !== 'First Gap'
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

void test('a fall right after crossing a zone boundary still resolves', () => {
  const tower = generateDailyTower(dailySeed);
  const snapshot = seededSnapshot();
  const upperZone = snapshot.zones[1]!.id;
  const lastLowerLedge = tower.platforms
    .filter(
      (platform) =>
        platform.zoneId === BOTTOM_ZONE_ID && platform.kind !== 'obstacle'
    )
    .sort((left, right) => left.y - right.y)[0];
  const lowerZoneArtifact = snapshot.zones[0]!.artifacts[0];
  assert.ok(lastLowerLedge);

  // The jump crossed into the upper zone, so respawn moved before the fall.
  const crossed = bottomObservation('attempt_zone_cross', {
    respawnZoneId: upperZone,
    fallX: lastLowerLedge.x + lastLowerLedge.width / 2,
    fallY: lastLowerLedge.y + 150,
    highestY: lastLowerLedge.y - 120,
    lastPlatformId: lastLowerLedge.id,
    wallBonkPlatformId: lastLowerLedge.id,
    lastHelperArtifactId: lowerZoneArtifact?.id ?? null,
  });
  assert.equal(resolveFallObservation(crossed, snapshot).ok, false);

  const scoped = scopeFallEvidenceToZone(
    crossed,
    tower.platforms,
    snapshot.zones.flatMap((zone) => zone.artifacts)
  );
  assert.equal(scoped.lastPlatformId, null);
  assert.equal(scoped.wallBonkPlatformId, null);
  assert.equal(scoped.lastHelperArtifactId, null);
  const resolved = resolveFallObservation(scoped, snapshot);
  assert.ok(resolved.ok);
  assert.equal(resolved.value.zoneId, upperZone);
});

void test('fall evidence inside the respawn zone is kept', () => {
  const tower = generateDailyTower(dailySeed);
  const observation = bottomObservation('attempt_same_zone');
  assert.deepEqual(
    scopeFallEvidenceToZone(observation, tower.platforms, []),
    observation
  );
});
