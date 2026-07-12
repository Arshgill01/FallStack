/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chargePowerForHeldMs,
  chargeRatioForHeldMs,
  jumpArcForHeldMs,
  MOVEMENT_TUNING,
} from './movement.js';
import {
  BOTTOM_ZONE_ID,
  TOP_ZONE_ID,
  ZONE_HEIGHT,
  ZONE_IDS,
} from './mutation.js';
import {
  CHUNK_LIBRARY,
  CHECKPOINT_RESPAWN_CENTER_X,
  KNOWN_GOOD_SEED,
  PLATFORMS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONES,
  generateDailyTower,
  isRoutePlatform,
  nextZoneId,
  validateTower,
  zoneForY,
} from './tower.js';

void test('known-good tower has finite dimensions and a summit', () => {
  assert.equal(WORLD_WIDTH, 480);
  assert.ok(WORLD_HEIGHT >= 72000);
  assert.equal(ZONES.length, 12);
  assert.equal(WORLD_HEIGHT, ZONE_IDS.length * ZONE_HEIGHT);
  assert.ok(PLATFORMS.length >= 560);
  assert.ok(
    PLATFORMS.some(
      (platform) => platform.id === 'summit' && platform.kind === 'summit'
    )
  );
  assert.ok(PLATFORMS.some((platform) => platform.kind === 'obstacle'));
});

void test('movement tuning supports generated tower reachability', () => {
  assert.ok(
    MOVEMENT_TUNING.generatedHorizontalStep <
      MOVEMENT_TUNING.reachableHorizontal
  );
  assert.ok(MOVEMENT_TUNING.generatedMinHorizontalStep > 0);
  assert.ok(
    MOVEMENT_TUNING.generatedMinHorizontalStep <
      MOVEMENT_TUNING.generatedHorizontalStep
  );
  assert.ok(MOVEMENT_TUNING.reachableVertical >= 147);
  assert.ok(MOVEMENT_TUNING.minChargePercent > 0);
  assert.ok(MOVEMENT_TUNING.minChargePercent < 1);
  assert.ok(
    MOVEMENT_TUNING.minLaunchVelocityX < MOVEMENT_TUNING.maxLaunchVelocityX
  );
  assert.ok(
    MOVEMENT_TUNING.maxLaunchVelocityY < MOVEMENT_TUNING.minLaunchVelocityY
  );
  assert.ok(
    MOVEMENT_TUNING.airSteerAccelerationX < MOVEMENT_TUNING.groundDragX
  );
  assert.ok(
    MOVEMENT_TUNING.wallBounceVelocityX > MOVEMENT_TUNING.wallBounceMinVelocityX
  );
  assert.equal(chargePowerForHeldMs(0), 0);
  assert.equal(chargePowerForHeldMs(MOVEMENT_TUNING.chargeMs), 1);
  assert.equal(chargePowerForHeldMs(MOVEMENT_TUNING.chargeMs * 2), 1);
  assert.equal(chargeRatioForHeldMs(0), MOVEMENT_TUNING.minChargePercent);
  assert.equal(chargeRatioForHeldMs(MOVEMENT_TUNING.chargeMs), 1);
});

void test('the responsive controller produces quick useful arcs', () => {
  const tap = jumpArcForHeldMs(0);
  const half = jumpArcForHeldMs(MOVEMENT_TUNING.chargeMs / 2);
  const full = jumpArcForHeldMs(MOVEMENT_TUNING.chargeMs);

  assert.equal(MOVEMENT_TUNING.chargeMs, 600);
  assert.ok(tap.rise > 110);
  assert.ok(full.rise > 260);
  assert.ok(full.sameHeightDistance > 400);
  assert.ok(full.sameHeightDurationMs < 1200);
  assert.ok(tap.rise < half.rise && half.rise < full.rise);
});

void test('all platforms live inside the logical world', () => {
  for (const platform of PLATFORMS) {
    assert.ok(platform.x >= 0, platform.id);
    assert.ok(platform.x + platform.width <= WORLD_WIDTH, platform.id);
    assert.ok(platform.y >= 0, platform.id);
    assert.ok(platform.y + platform.height <= WORLD_HEIGHT, platform.id);
  }
});

void test('daily tower generation is deterministic by seed', () => {
  const first = generateDailyTower('fallstack-2026-07-08');
  const second = generateDailyTower('fallstack-2026-07-08');
  assert.deepEqual(first.platforms, second.platforms);
  assert.equal(validateTower(first), true);
});

void test('daily tower generation keeps sampled seeds reachable', () => {
  for (let index = 0; index < 120; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const tower = generateDailyTower(`fallstack-2026-07-${day}-${index}`);
    assert.equal(validateTower(tower), true, `seed ${tower.seed}`);
  }
});

void test('generated checkpoints cover the fixed respawn position', () => {
  for (let index = 0; index < 120; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const tower = generateDailyTower(`fallstack-2026-07-${day}-${index}`);
    const checkpoints = tower.platforms.filter((platform) =>
      platform.id.includes('checkpoint')
    );

    assert.equal(checkpoints.length, ZONES.length - 1, tower.seed);
    for (const checkpoint of checkpoints) {
      assert.ok(
        checkpoint.x <= CHECKPOINT_RESPAWN_CENTER_X &&
          checkpoint.x + checkpoint.width >= CHECKPOINT_RESPAWN_CENTER_X,
        `${tower.seed}: ${checkpoint.id} misses respawn x`
      );
    }
  }
});

void test('daily tower generation avoids near-vertical ledge traps', () => {
  for (let index = 0; index < 120; index += 1) {
    const day = String((index % 28) + 1).padStart(2, '0');
    const tower = generateDailyTower(`fallstack-2026-07-${day}-${index}`);
    const route = tower.platforms
      .filter(isRoutePlatform)
      .sort((a, b) => b.y - a.y);

    for (let routeIndex = 0; routeIndex < route.length - 1; routeIndex += 1) {
      const from = route[routeIndex]!;
      const to = route[routeIndex + 1]!;
      if (from.id.includes('summit') || to.id.includes('summit')) continue;
      if (from.id.includes('checkpoint') || to.id.includes('checkpoint'))
        continue;
      assert.ok(
        horizontalGap(from, to) >= MOVEMENT_TUNING.generatedMinHorizontalStep,
        `${tower.seed}: ${from.id} to ${to.id}`
      );
    }
  }
});

void test('current first checkpoint does not respawn over empty air', () => {
  const tower = generateDailyTower('fallstack-2026-07-11');
  const firstCheckpoint = tower.platforms.find(
    (platform) => platform.id === `${BOTTOM_ZONE_ID}-checkpoint`
  );
  const bottomZone = ZONES.find((zone) => zone.id === BOTTOM_ZONE_ID);

  assert.ok(firstCheckpoint);
  assert.ok(bottomZone);
  assert.equal(firstCheckpoint.y, bottomZone.yTop);
  assert.equal(
    firstCheckpoint.x + firstCheckpoint.width / 2,
    CHECKPOINT_RESPAWN_CENTER_X
  );
});

void test('current opening route gives the first biome meaningful ledge separation', () => {
  const tower = generateDailyTower('fallstack-2026-07-11');
  const lowerRoute = tower.platforms
    .filter(
      (platform) =>
        platform.zoneId === BOTTOM_ZONE_ID && isRoutePlatform(platform)
    )
    .sort((a, b) => b.y - a.y)
    .slice(0, 8);

  for (let index = 0; index < lowerRoute.length - 1; index += 1) {
    const from = lowerRoute[index]!;
    const to = lowerRoute[index + 1]!;
    assert.ok(
      horizontalGap(from, to) >= MOVEMENT_TUNING.generatedMinHorizontalStep,
      `${from.id} to ${to.id}`
    );
    assert.ok(from.y - to.y <= 124, `${from.id} to ${to.id}`);
  }
});

void test('summit connector stays reachable from awkward top seeds', () => {
  const tower = generateDailyTower('fallstack-2026-07-10-149');
  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((a, b) => b.y - a.y);
  const connectorIndex = route.findIndex(
    (platform) => platform.id === `ledge-${TOP_ZONE_ID}-summit-connector`
  );
  const previous = route[connectorIndex - 1];
  const connector = route[connectorIndex];
  const summit = route[connectorIndex + 1];

  assert.ok(previous);
  assert.ok(connector);
  assert.equal(summit?.id, 'summit');
  assert.equal(validateTower(tower), true);
  assert.ok(
    horizontalGap(previous, connector) <= MOVEMENT_TUNING.reachableHorizontal
  );
  assert.ok(
    horizontalGap(connector, summit) <= MOVEMENT_TUNING.reachableHorizontal
  );
});

void test('summit pull keeps top-zone ledges within horizontal reach', () => {
  const tower = generateDailyTower('fallstack-2026-07-20-215');
  const route = tower.platforms
    .filter(isRoutePlatform)
    .sort((a, b) => b.y - a.y);
  const hardest = route
    .slice(0, -1)
    .map((platform, index) => ({
      from: platform,
      to: route[index + 1]!,
      gap: horizontalGap(platform, route[index + 1]!),
    }))
    .sort((a, b) => b.gap - a.gap)[0];

  assert.ok(hardest);
  assert.equal(validateTower(tower), true);
  assert.ok(
    hardest.gap <= MOVEMENT_TUNING.reachableHorizontal,
    `${hardest.from.id} to ${hardest.to.id}`
  );
});

void test('tower validation catches unreachable zone stitches', () => {
  const tower = generateDailyTower('fallstack-2026-07-08');
  const secondZone = ZONE_IDS[1]!;
  const firstUpperPlatform = tower.platforms
    .filter((platform) => platform.zoneId === secondZone)
    .filter(isRoutePlatform)
    .sort((a, b) => b.y - a.y)[0];

  assert.ok(firstUpperPlatform);
  firstUpperPlatform.x = 400;
  assert.equal(validateTower(tower), false);
});

void test('generated towers include optional ricochet chimneys without changing the clear route', () => {
  const tower = generateDailyTower(KNOWN_GOOD_SEED);
  const ricochetWalls = tower.platforms.filter((platform) =>
    platform.id.startsWith('ricochet-')
  );

  assert.ok(ricochetWalls.length >= 2);
  assert.equal(ricochetWalls.length % 2, 0);
  assert.ok(ricochetWalls.every((platform) => platform.kind === 'obstacle'));
  assert.equal(validateTower(tower), true);
});

void test('different daily seeds can vary the known-good tower subtly', () => {
  const first = generateDailyTower('fallstack-2026-07-08');
  const second = generateDailyTower('fallstack-2026-07-09');
  assert.notDeepEqual(first.platforms, second.platforms);
  assert.equal(validateTower(second), true);
});

void test('known-good seed reproduces the reference route', () => {
  const knownGood = generateDailyTower(KNOWN_GOOD_SEED);
  assert.deepEqual(knownGood.platforms, PLATFORMS);
  assert.equal(knownGood.chunks.length, ZONES.length);
  assert.equal(
    CHUNK_LIBRARY.every((chunk) => chunk.ledges.length > 0),
    true
  );
  assert.equal(new Set(CHUNK_LIBRARY.map((chunk) => chunk.archetype)).size, 6);
});

void test('zone progression is finite and ordered', () => {
  for (let index = 0; index < ZONE_IDS.length - 1; index += 1) {
    assert.equal(nextZoneId(ZONE_IDS[index]!), ZONE_IDS[index + 1]);
  }
  assert.equal(nextZoneId(TOP_ZONE_ID), null);
  assert.equal(zoneForY(WORLD_HEIGHT - 1000).id, BOTTOM_ZONE_ID);
  assert.equal(zoneForY(1000).id, TOP_ZONE_ID);
  assert.equal(ZONES.length, ZONE_IDS.length);
});

function horizontalGap(
  from: { x: number; width: number },
  to: { x: number; width: number }
): number {
  return Math.abs(from.x + from.width / 2 - (to.x + to.width / 2));
}
