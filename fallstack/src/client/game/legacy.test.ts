import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBoardIdentity,
  createBoardSnapshot,
  type BoardSnapshot,
} from '../../shared/game/board.js';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  createSeededSiteCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
  type SiteMutationCounters,
} from '../../shared/game/mutation.js';
import {
  EMPTY_LEGACY,
  legacyCopy,
  readVisitMemory,
  sinceLastVisit,
  visitMemoryFor,
  withReceiptMark,
  writeVisitMemory,
  yourArtifacts,
} from './legacy.js';

const seed = createDailySeed(new Date('2026-07-08T00:00:00Z'));
const identity = createBoardIdentity({
  communityId: 't5_fallstack',
  communityName: 'fallstack',
  ...seed,
});

function board(
  change: (counters: Record<string, SiteMutationCounters>) => void = () => {},
  options: { falls?: number; saves?: Record<string, number>; revision?: number } = {}
): BoardSnapshot {
  const siteCounters = createSeededSiteCounters(seed.dailySeed);
  change(siteCounters);
  return createBoardSnapshot(
    identity,
    deriveSnapshot({
      ...seed,
      counters: createSeededCounters(),
      siteCounters,
      totalFalls: SEEDED_TOTAL_FALLS + (options.falls ?? 0),
      totalClears: 0,
      totalSummits: 0,
      achievements: createInitialAchievements(),
      saves: options.saves ?? {},
    }),
    options.revision ?? SEEDED_TOTAL_FALLS + (options.falls ?? 0)
  );
}

const opening = board();
const firstGap = opening.sites[0]!;
const corpse = opening.zones[0]!.artifacts.find(
  (artifact) => artifact.siteId === firstGap.id && artifact.bucket === 'short_jump'
)!;

void test('your artifacts are the ones your own falls are part of', () => {
  const legacy = {
    marks: [{ siteId: firstGap.id, bucket: 'short_jump' as const, count: 1 }],
    clearedZones: [],
  };
  assert.deepEqual(
    yourArtifacts(opening, legacy).map((artifact) => artifact.id),
    [corpse.id]
  );
  assert.deepEqual(yourArtifacts(opening, EMPTY_LEGACY), []);
});

void test('legacy copy credits what your falls built and who it caught', () => {
  const legacy = {
    marks: [{ siteId: firstGap.id, bucket: 'short_jump' as const, count: 1 }],
    clearedZones: [],
  };
  assert.equal(
    legacyCopy(board(() => {}, { saves: { [corpse.id]: 3 } }), legacy),
    'Your falls helped raise 1 artifact. They caught 3 climbers.'
  );
  assert.equal(
    legacyCopy(opening, {
      marks: [{ siteId: opening.sites[5]!.id, bucket: 'wall_bonk', count: 2 }],
      clearedZones: [],
    }),
    'Your 2 falls are still forming something.'
  );
  assert.equal(legacyCopy(opening, EMPTY_LEGACY), null);
});

void test('accepted fall receipts add to your marks; others do not', () => {
  const receipt = { accepted: true, siteId: firstGap.id, bucket: 'short_jump' as const };
  const once = withReceiptMark(EMPTY_LEGACY, receipt);
  const twice = withReceiptMark(once, receipt);
  assert.deepEqual(twice.marks, [{ siteId: firstGap.id, bucket: 'short_jump', count: 2 }]);
  assert.equal(withReceiptMark(EMPTY_LEGACY, { ...receipt, accepted: false }), EMPTY_LEGACY);
  assert.equal(
    withReceiptMark(EMPTY_LEGACY, { ...receipt, bucket: 'successful_clear' }),
    EMPTY_LEGACY
  );
});

void test('a return visit recaps what the community did meanwhile', () => {
  const before = visitMemoryFor(opening);
  const wallSite = opening.sites[3]!;
  const later = board(
    (counters) => {
      counters[wallSite.id]!.wall_bonk += 3;
      counters[firstGap.id]!.short_jump += 1;
    },
    { falls: 4, saves: { [corpse.id]: 2 } }
  );
  const legacy = {
    marks: [{ siteId: firstGap.id, bucket: 'short_jump' as const, count: 1 }],
    clearedZones: [],
  };
  const recap = sinceLastVisit(before, later, legacy);
  assert.equal(
    recap?.copy,
    'Since your last climb: 4 falls · 1 new artifact. Your footholds caught 2 climbers.'
  );
  assert.deepEqual(new Set(recap?.changedSiteIds), new Set([wallSite.id, firstGap.id]));
  assert.deepEqual(
    new Set(recap?.changedSlots.map((slot) => `${slot.siteId}|${slot.bucket}`)),
    new Set([`${wallSite.id}|wall_bonk`, `${firstGap.id}|short_jump`])
  );
});

void test('no recap without a newer revision of the same board', () => {
  assert.equal(sinceLastVisit(null, opening, EMPTY_LEGACY), null);
  assert.equal(sinceLastVisit(visitMemoryFor(opening), opening, EMPTY_LEGACY), null);
  assert.equal(
    sinceLastVisit(
      { ...visitMemoryFor(opening), boardId: 'community:other:2026-07-07:v1', revision: 0 },
      opening,
      EMPTY_LEGACY
    ),
    null
  );
});

void test('visit memory survives storage round trips and storage failures', () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  };
  writeVisitMemory(storage, opening);
  assert.deepEqual(readVisitMemory(storage, opening.boardId), visitMemoryFor(opening));
  assert.equal(readVisitMemory(storage, 'community:other:2026-07-07:v1'), null);
  store.set('fallstack:last-visit', '{broken');
  assert.equal(readVisitMemory(storage, opening.boardId), null);
  assert.doesNotThrow(() =>
    writeVisitMemory(
      {
        setItem: () => {
          throw new Error('denied');
        },
      },
      opening
    )
  );
});
