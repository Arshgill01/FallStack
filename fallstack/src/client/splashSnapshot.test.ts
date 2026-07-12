/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
} from '../shared/game/mutation.js';
import { splashSnapshotCopy } from './splashSnapshot.js';

void test('splash copy reflects the live snapshot instead of seeded totals', () => {
  const snapshot = deriveSnapshot({
    dailySeed: 'fallstack-2026-07-12',
    dateKey: '2026-07-12',
    counters: createSeededCounters(),
    totalFalls: 46,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });

  const copy = splashSnapshotCopy(snapshot);

  assert.equal(copy.headline, "Today's tower has 46 failed climbs in it.");
  assert.equal(copy.artifactLabel, snapshot.zones[0]?.artifacts[0]?.label);
  assert.match(copy.detail, /Add yours carefully\.$/);
});

void test('splash copy has a number-free loading state', () => {
  const copy = splashSnapshotCopy(null);

  assert.doesNotMatch(copy.headline, /\d/);
  assert.doesNotMatch(copy.detail, /\d/);
});
