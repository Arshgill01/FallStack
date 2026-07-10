/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHUNK_LIBRARY,
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
  assert.ok(horizontalGap(previous, connector) <= 260);
  assert.ok(horizontalGap(connector, summit) <= 260);
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
  assert.ok(hardest.gap <= 260, `${hardest.from.id} to ${hardest.to.id}`);
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
