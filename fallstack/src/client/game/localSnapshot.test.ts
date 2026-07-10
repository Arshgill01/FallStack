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
});
