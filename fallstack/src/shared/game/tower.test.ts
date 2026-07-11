/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chargePowerForHeldMs,
  chargeRatioForHeldMs,
  MOVEMENT_TUNING,
} from './movement.js';
import {
  CHUNK_LIBRARY,
  CHECKPOINT_RESPAWN_CENTER_X,
  KNOWN_GOOD_SEED,
  PLATFORMS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  ZONES,
  generateDailyTower,
  nextZoneId,
  validateTower,
  zoneForY,
} from './tower.js';

void test('known-good tower has finite dimensions and a summit', () => {
  assert.equal(WORLD_WIDTH, 480);
  assert.ok(WORLD_HEIGHT > 2000);
  assert.ok(PLATFORMS.some((platform) => platform.id === 'summit' && platform.kind === 'summit'));
});

void test('movement tuning supports generated tower reachability', () => {
  assert.ok(MOVEMENT_TUNING.generatedHorizontalStep < MOVEMENT_TUNING.reachableHorizontal);
  assert.ok(MOVEMENT_TUNING.generatedMinHorizontalStep > 0);
  assert.ok(MOVEMENT_TUNING.generatedMinHorizontalStep < MOVEMENT_TUNING.generatedHorizontalStep);
  assert.ok(MOVEMENT_TUNING.reachableVertical >= 147);
  assert.ok(MOVEMENT_TUNING.minChargePercent > 0);
  assert.ok(MOVEMENT_TUNING.minChargePercent < 1);
  assert.ok(MOVEMENT_TUNING.minLaunchVelocityX < MOVEMENT_TUNING.maxLaunchVelocityX);
  assert.ok(MOVEMENT_TUNING.maxLaunchVelocityY < MOVEMENT_TUNING.minLaunchVelocityY);
  assert.equal(chargePowerForHeldMs(0), 0);
  assert.equal(chargePowerForHeldMs(MOVEMENT_TUNING.chargeMs), 1);
  assert.equal(chargePowerForHeldMs(MOVEMENT_TUNING.chargeMs * 2), 1);
  assert.equal(chargeRatioForHeldMs(0), MOVEMENT_TUNING.minChargePercent);
  assert.equal(chargeRatioForHeldMs(MOVEMENT_TUNING.chargeMs), 1);
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

    assert.equal(checkpoints.length, 2, tower.seed);
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
    const route = [...tower.platforms].sort((a, b) => b.y - a.y);

    for (let routeIndex = 0; routeIndex < route.length - 1; routeIndex += 1) {
      const from = route[routeIndex]!;
      const to = route[routeIndex + 1]!;
      if (from.id.includes('summit') || to.id.includes('summit')) continue;
      if (from.id.includes('checkpoint') || to.id.includes('checkpoint')) continue;
      assert.ok(
        horizontalGap(from, to) >= MOVEMENT_TUNING.generatedMinHorizontalStep,
        `${tower.seed}: ${from.id} to ${to.id}`
      );
    }
  }
});

void test('current Bell Shaft checkpoint does not respawn over empty air', () => {
  const tower = generateDailyTower('fallstack-2026-07-11');
  const lowerCheckpoint = tower.platforms.find(
    (platform) => platform.id === 'lower_ruins-checkpoint'
  );

  assert.ok(lowerCheckpoint);
  assert.equal(lowerCheckpoint.y, 4000);
  assert.equal(lowerCheckpoint.x + lowerCheckpoint.width / 2, CHECKPOINT_RESPAWN_CENTER_X);
});

void test('current opening route gives the first level meaningful ledge separation', () => {
  const tower = generateDailyTower('fallstack-2026-07-11');
  const lowerRoute = tower.platforms
    .filter((platform) => platform.zoneId === 'lower_ruins')
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
  const route = [...tower.platforms].sort((a, b) => b.y - a.y);
  const connectorIndex = route.findIndex(
    (platform) => platform.id === 'ledge-moon_roof-summit-connector'
  );
  const previous = route[connectorIndex - 1];
  const connector = route[connectorIndex];
  const summit = route[connectorIndex + 1];

  assert.ok(previous);
  assert.ok(connector);
  assert.equal(summit?.id, 'summit');
  assert.equal(validateTower(tower), true);
  assert.ok(horizontalGap(previous, connector) <= MOVEMENT_TUNING.reachableHorizontal);
  assert.ok(horizontalGap(connector, summit) <= MOVEMENT_TUNING.reachableHorizontal);
});

void test('summit pull keeps moon roof ledges within horizontal reach', () => {
  const tower = generateDailyTower('fallstack-2026-07-20-215');
  const route = [...tower.platforms].sort((a, b) => b.y - a.y);
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
  const firstBellPlatform = tower.platforms
    .filter((platform) => platform.zoneId === 'bell_shaft')
    .sort((a, b) => b.y - a.y)[0];

  assert.ok(firstBellPlatform);
  firstBellPlatform.x = 400;
  assert.equal(validateTower(tower), false);
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
  assert.equal(knownGood.chunks.length, 3);
  assert.equal(CHUNK_LIBRARY.every((chunk) => chunk.ledges.length > 0), true);
});

void test('zone progression is finite and ordered', () => {
  assert.equal(nextZoneId('lower_ruins'), 'bell_shaft');
  assert.equal(nextZoneId('bell_shaft'), 'moon_roof');
  assert.equal(nextZoneId('moon_roof'), null);
  assert.equal(zoneForY(5000).id, 'lower_ruins');
  assert.equal(zoneForY(3000).id, 'bell_shaft');
  assert.equal(zoneForY(1000).id, 'moon_roof');
  assert.equal(ZONES.length, 3);
});

function horizontalGap(
  from: { x: number; width: number },
  to: { x: number; width: number }
): number {
  return Math.abs(from.x + from.width / 2 - (to.x + to.width / 2));
}
