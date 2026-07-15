/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
} from '../shared/game/mutation.js';
import {
  createBoardIdentity,
  createBoardSnapshot,
} from '../shared/game/board.js';
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

  const board = createBoardSnapshot(
    createBoardIdentity({
      communityId: 't5_fallstack',
      communityName: 'FallStack',
      dateKey: snapshot.dateKey,
      dailySeed: snapshot.dailySeed,
    }),
    snapshot,
    9
  );
  const copy = splashSnapshotCopy(board);

  assert.equal(copy.scopeLabel, 'r/FallStack · one daily tower');
  assert.equal(copy.headline, '37 opening scars · 9 community falls');
  assert.equal(copy.artifactLabel, snapshot.zones[0]?.artifacts[0]?.label);
  assert.match(copy.detail, /what r\/FallStack climbs next\.$/);
});

void test('splash copy has a number-free loading state', () => {
  const copy = splashSnapshotCopy(null);

  assert.doesNotMatch(copy.headline, /\d/);
  assert.doesNotMatch(copy.detail, /\d/);
});
