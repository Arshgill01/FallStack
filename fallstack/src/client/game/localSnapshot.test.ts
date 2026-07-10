/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
} from '../../shared/game/mutation.js';
import {
  applyLocalClear,
  applyLocalFall,
  applyLocalSummit,
  localFallMessage,
} from './localSnapshot.js';

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

void test('local fall updates derived counters without server state', () => {
  const next = applyLocalFall(baseSnapshot(), {
    attemptId: 'attempt_local_fall',
    zoneId: 'bell_shaft',
    failureBucket: 'wall_bonk',
    chargePercent: 63,
    highestY: 3500,
  });
  const bell = next.zones.find((zone) => zone.id === 'bell_shaft');

  assert.equal(next.totalFalls, 38);
  assert.equal(bell?.counters.wall_bonk, 4);
  assert.match(
    localFallMessage(next, {
      attemptId: 'attempt_local_fall',
      zoneId: 'bell_shaft',
      failureBucket: 'wall_bonk',
      chargePercent: 63,
      highestY: 3500,
    }),
    /counted here/
  );
});

void test('local clear and summit update result summary', () => {
  const cleared = applyLocalClear(baseSnapshot(), {
    attemptId: 'attempt_local_clear',
    zoneId: 'lower_ruins',
    highestY: 3990,
  });
  const summit = applyLocalSummit(cleared);

  assert.equal(cleared.totalClears, 1);
  assert.equal(
    cleared.zones.find((zone) => zone.id === 'lower_ruins')?.counters
      .successfulClears,
    3
  );
  assert.equal(summit.totalSummits, 1);
  assert.equal(summit.result.summitStatus, 'Summit Cleared');
  assert.equal(summit.result.firstSummitUsername, 'you');
  assert.equal(cleared.result.bestStabilizerUsername, 'you');
});

void test('local events preserve existing local result achievements', () => {
  const summit = applyLocalSummit(baseSnapshot());
  const afterFall = applyLocalFall(summit, {
    attemptId: 'attempt_after_summit_fall',
    zoneId: 'moon_roof',
    failureBucket: 'short_jump',
    chargePercent: 72,
    highestY: 900,
  });
  const afterClear = applyLocalClear(afterFall, {
    attemptId: 'attempt_after_summit_clear',
    zoneId: 'bell_shaft',
    highestY: 1900,
  });

  assert.equal(afterFall.totalSummits, 1);
  assert.equal(afterFall.result.firstSummitUsername, 'you');
  assert.equal(afterFall.result.highestClimberUsername, 'you');
  assert.equal(afterFall.result.highestClimberZone, 'Moon Roof');
  assert.equal(afterClear.result.firstSummitUsername, 'you');
  assert.equal(afterClear.result.highestClimberUsername, 'you');
  assert.equal(afterClear.result.highestClimberZone, 'Moon Roof');
});

void test('local falls and clears update highest climber when progress improves', () => {
  const afterFall = applyLocalFall(baseSnapshot(), {
    attemptId: 'attempt_local_high_fall',
    zoneId: 'bell_shaft',
    failureBucket: 'short_jump',
    chargePercent: 81,
    highestY: 1900,
  });
  const afterLowerClear = applyLocalClear(afterFall, {
    attemptId: 'attempt_local_lower_clear',
    zoneId: 'lower_ruins',
    highestY: 3990,
  });

  assert.equal(afterFall.result.highestClimberUsername, 'you');
  assert.equal(afterFall.result.highestClimberZone, 'Bell Shaft');
  assert.equal(afterLowerClear.result.highestClimberUsername, 'you');
  assert.equal(afterLowerClear.result.highestClimberZone, 'Bell Shaft');
});
