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
  assert.equal(zoneForY(2164).id, 'lower_ruins');
  assert.equal(zoneForY(1280).id, 'bell_shaft');
  assert.equal(zoneForY(620).id, 'moon_roof');
  assert.equal(ZONES.length, 3);
});
