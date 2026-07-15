import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBoardIdentity,
  createBoardSnapshot,
} from '../../shared/game/board.js';
import {
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
} from '../../shared/game/mutation.js';
import { deriveTowerMemory } from './tower-memory.js';

function createGameSnapshot() {
  const dailySeed = 'fallstack-2026-07-13';
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

function createSnapshot() {
  const gameSnapshot = createGameSnapshot();
  return createBoardSnapshot(
    createBoardIdentity({
      communityId: 't5_fallstack',
      communityName: 'FallStack',
      dateKey: '2026-07-13',
      dailySeed: gameSnapshot.dailySeed,
    }),
    gameSnapshot,
    40,
    [
      {
        revision: 39,
        siteId: 'older-site',
        siteName: 'Old Gap',
        bucket: 'short_jump',
        visibleChange: 'artifact_spawned',
        copy: '3 short jumps raised Old Gap to Corpse Stack.',
      },
      {
        revision: 40,
        siteId: 'latest-site',
        siteName: 'First Gap',
        bucket: 'short_jump',
        visibleChange: 'artifact_upgraded',
        copy: '6 short jumps upgraded First Gap to Mercy Nail.',
      },
    ]
  );
}

void test('tower memory reads from summit to spawn and names a real causal site', () => {
  const memory = deriveTowerMemory(createSnapshot());

  assert.equal(memory.scopeLabel, 'r/FallStack');
  assert.equal(
    memory.introCopy,
    'r/FallStack shaped this daily route. Read it from summit to spawn.'
  );
  assert.equal(memory.revisionLabel, 'BOARD r40');
  assert.deepEqual(
    memory.zones.map((zone) => zone.zoneId),
    ['moon_roof', 'bell_shaft', 'lower_ruins']
  );

  const lowerRuins = memory.zones.at(-1);
  assert.equal(lowerRuins?.zoneName, 'Lower Ruins');
  assert.equal(lowerRuins?.statusLabel, 'Restless');
  assert.equal(lowerRuins?.siteName, 'First Gap');
  assert.match(lowerRuins?.detail ?? '', /4 short jumps/i);
  assert.equal(lowerRuins?.artifactLabel, 'Corpse Stack');
  assert.doesNotMatch(
    memory.zones
      .map((zone) => `${zone.zoneName} ${zone.siteName ?? ''}`)
      .join(' '),
    /orbital|crater|comet|nebula|ring citadel|black hole|event horizon/i
  );
});

void test('tower memory exposes newest shared beats without naming failures', () => {
  const memory = deriveTowerMemory(createSnapshot());

  assert.deepEqual(
    memory.recentBeats.map((beat) => beat.revision),
    [40, 39]
  );
  assert.equal(memory.recentBeats[0]?.copy.startsWith('6 short jumps'), true);
  assert.equal(memory.recentBeats.some((beat) => /\byour\b/i.test(beat.copy)), false);
});

void test('tower memory makes only the implemented UTC rollover promise', () => {
  const memory = deriveTowerMemory(createSnapshot());

  assert.equal(
    memory.rolloverCopy,
    'At 00:00 UTC, r/FallStack gets a fresh shared tower.'
  );
  assert.equal(/relic|worst ledge/i.test(memory.rolloverCopy), false);
});

void test('local tower memory discloses that shared marks are not being written', () => {
  const memory = deriveTowerMemory(createGameSnapshot());

  assert.equal(memory.revisionLabel, 'LOCAL · NOT SHARED');
  assert.equal(
    memory.introCopy,
    'This was local practice. No shared tower changed.'
  );
  assert.equal(
    memory.rolloverCopy,
    'Local practice resets at 00:00 UTC. No shared marks are being written.'
  );
});
