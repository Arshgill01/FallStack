/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { CLIMBER_IDS, CLIMBERS, parseClimberId } from './climbers.js';
import { PLAYER_COLLISION_SIZE } from './movement.js';
import {
  collectPowerUp,
  consumeHeld,
  effectiveChargeHeldMs,
  emptyLoadout,
  isPowerUpActive,
  loadoutAfterRespawn,
  loadoutChips,
  pickupTouchesPlayer,
  placePowerUps,
  POWER_UP_KINDS,
  POWER_UP_TUNING,
  powerUpDurationMs,
  shouldThreadCatch,
} from './powerups.js';
import {
  generateDailyTower,
  isRoutePlatform,
  KNOWN_GOOD_SEED,
  zoneById,
} from './tower.js';

const SEEDS = [KNOWN_GOOD_SEED, 'fallstack-2026-10-29', 'fallstack-2026-11-02'];

void test('pickups are deterministic per seed and stay inside their zone and the shaft', () => {
  for (const seed of SEEDS) {
    const tower = generateDailyTower(seed);
    const pickups = placePowerUps(seed, tower.platforms);
    assert.deepEqual(pickups, placePowerUps(seed, tower.platforms));
    assert.ok(pickups.length >= 20, `${seed} places pickups through the tower`);
    assert.equal(new Set(pickups.map((p) => p.id)).size, pickups.length);
    for (const pickup of pickups) {
      assert.ok(POWER_UP_KINDS.includes(pickup.kind));
      assert.ok(pickup.x >= 36 && pickup.x <= 444);
      const zone = zoneById(pickup.zoneId);
      assert.ok(
        pickup.y >= zone.yTop - 80 && pickup.y <= zone.yBottom,
        `${pickup.id} sits near its zone`
      );
    }
  }
});

void test('pickups never sit inside a platform body', () => {
  for (const seed of SEEDS) {
    const tower = generateDailyTower(seed);
    for (const pickup of placePowerUps(seed, tower.platforms)) {
      for (const platform of tower.platforms) {
        const inside =
          pickup.x > platform.x &&
          pickup.x < platform.x + platform.width &&
          pickup.y > platform.y &&
          pickup.y < platform.y + platform.height;
        assert.equal(inside, false, `${pickup.id} vs ${platform.id}`);
      }
    }
  }
});

void test('arc pickups are off the walking line: standing on a ledge centre misses them', () => {
  for (const seed of SEEDS) {
    const tower = generateDailyTower(seed);
    const route = tower.platforms.filter(isRoutePlatform);
    for (const pickup of placePowerUps(seed, tower.platforms)) {
      if (pickup.placement !== 'arc') continue;
      for (const platform of route) {
        const standing = {
          x: platform.x + platform.width / 2,
          y: platform.y - PLAYER_COLLISION_SIZE.height / 2,
          ...PLAYER_COLLISION_SIZE,
        };
        assert.equal(pickupTouchesPlayer(pickup, standing), false);
      }
    }
  }
});

void test('timed pickups refresh, held pickups cap by climber affinity', () => {
  let loadout = collectPowerUp(emptyLoadout(), 'spark', 'pilgrim', 1000);
  assert.equal(isPowerUpActive(loadout, 'spark', 1000 + 9_999), true);
  assert.equal(isPowerUpActive(loadout, 'spark', 1000 + 10_000), false);
  loadout = collectPowerUp(loadout, 'spark', 'pilgrim', 8000);
  assert.equal(loadout.timedUntil.spark, 18_000);

  assert.equal(powerUpDurationMs('spark', 'wick'), 16_000);
  assert.equal(powerUpDurationMs('updraft', 'kite'), 9_600);
  assert.equal(powerUpDurationMs('updraft', 'wick'), POWER_UP_TUNING.updraftDurationMs);

  let diver = emptyLoadout();
  for (let i = 0; i < 4; i++) diver = collectPowerUp(diver, 'thread', 'diver', 0);
  assert.equal(diver.held.thread, 2);
  let pilgrim = emptyLoadout();
  for (let i = 0; i < 4; i++) pilgrim = collectPowerUp(pilgrim, 'thread', 'pilgrim', 0);
  assert.equal(pilgrim.held.thread, 1);
  for (let i = 0; i < 4; i++) pilgrim = collectPowerUp(pilgrim, 'second_wind', 'pilgrim', 0);
  assert.equal(pilgrim.held.second_wind, 2);

  const used = consumeHeld(pilgrim, 'thread');
  assert.equal(used?.held.thread, 0);
  assert.equal(consumeHeld(used!, 'thread'), null);
});

void test('respawn clears timers but keeps capped held charges', () => {
  let loadout = collectPowerUp(emptyLoadout(), 'updraft', 'kite', 0);
  loadout = collectPowerUp(loadout, 'second_wind', 'kite', 0);
  const after = loadoutAfterRespawn(loadout);
  assert.equal(isPowerUpActive(after, 'updraft', 1), false);
  assert.equal(after.held.second_wind, 1);
});

void test('Spark shortens the charge, and only while active', () => {
  const loadout = collectPowerUp(emptyLoadout(), 'spark', 'pilgrim', 0);
  assert.equal(effectiveChargeHeldMs(250, loadout, 100), 600);
  assert.equal(effectiveChargeHeldMs(250, loadout, 20_000), 250);
});

void test('Safety Thread catches only a real drop below the last ledge', () => {
  const base = { lastSafeY: 1000, threads: 1, velocityY: 400 };
  assert.equal(shouldThreadCatch({ ...base, playerY: 1200 }), false);
  assert.equal(
    shouldThreadCatch({ ...base, playerY: 1000 + POWER_UP_TUNING.threadCatchDrop + 1 }),
    true
  );
  assert.equal(shouldThreadCatch({ ...base, playerY: 1400, threads: 0 }), false);
  assert.equal(shouldThreadCatch({ ...base, playerY: 1400, velocityY: -10 }), false);
  assert.equal(shouldThreadCatch({ ...base, playerY: 1400, lastSafeY: null }), false);
});

void test('HUD chips list active timers before held charges', () => {
  let loadout = collectPowerUp(emptyLoadout(), 'thread', 'diver', 0);
  loadout = collectPowerUp(loadout, 'updraft', 'diver', 0);
  const chips = loadoutChips(loadout, 'diver', 3000);
  assert.deepEqual(
    chips.map((chip) => [chip.kind, chip.value, chip.timed]),
    [
      ['updraft', 30, true],
      ['thread', 1, false],
    ]
  );
  assert.equal(chips[1]!.fraction, 0.5);
});

void test('every climber has a distinct affinity and ids parse strictly', () => {
  assert.equal(new Set(CLIMBER_IDS.map((id) => CLIMBERS[id].affinity)).size, 4);
  assert.equal(parseClimberId('kite'), 'kite');
  assert.equal(parseClimberId('snoo'), null);
  assert.equal(parseClimberId(undefined), null);
});
