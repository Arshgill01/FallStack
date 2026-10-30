/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  bucketDrivesVisibleSlot,
  deriveFormingMarks,
  formingCopy,
  siteFace,
  tierPressure,
} from './forming.js';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  ZERO_COUNTERS,
  type SiteMutationCounters,
  type SiteSnapshot,
} from './mutation.js';

function seededSites(): SiteSnapshot[] {
  return deriveSnapshot({
    ...createDailySeed(new Date('2026-07-08T00:00:00Z')),
    counters: createSeededCounters(),
    totalFalls: 37,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  }).sites;
}

function withCounters(
  site: SiteSnapshot,
  counters: Partial<SiteMutationCounters>
): SiteSnapshot {
  return { ...site, counters: { ...ZERO_COUNTERS, ...counters } };
}

void test('one or two matching falls draw the artifact the slot will grow', () => {
  const site = seededSites()[0]!;
  const marks = deriveFormingMarks([withCounters(site, { short_jump: 2 })]);

  assert.equal(marks.length, 1);
  assert.equal(marks[0]?.type, 'corpse_stack');
  assert.equal(marks[0]?.count, 2);
  assert.equal(marks[0]?.needed, 3);
  assert.deepEqual(
    { x: marks[0]?.x, y: marks[0]?.y },
    { x: site.helperSlot.x, y: site.helperSlot.y }
  );
  assert.equal(marks[0]?.copy, '1 more short jump raises a foothold here.');
});

void test('forming marks disappear once the artifact itself spawns', () => {
  const site = seededSites()[0]!;
  assert.deepEqual(
    deriveFormingMarks([withCounters(site, { short_jump: 3 })]),
    []
  );
  assert.deepEqual(deriveFormingMarks([withCounters(site, {})]), []);
});

void test('each slot forms its own silhouette in its own slot', () => {
  const site = seededSites()[0]!;
  const marks = deriveFormingMarks([
    withCounters(site, {
      short_jump: 1,
      wall_bonk: 2,
      overjump: 1,
      successfulClears: 1,
    }),
  ]);

  assert.deepEqual(
    marks.map((mark) => [mark.slot, mark.type]),
    [
      ['helper', 'corpse_stack'],
      ['ghost', 'ghost_platform'],
      ['hazard', 'cursed_brick'],
      ['lantern', 'lantern_trail'],
    ]
  );
  assert.equal(new Set(marks.map((mark) => mark.id)).size, 4);
});

void test('the louder hazard bucket owns the forming brick', () => {
  const site = seededSites()[0]!;
  const [mark] = deriveFormingMarks([
    withCounters(site, { overjump: 1, helper_overuse: 2 }),
  ]);
  assert.equal(mark?.bucket, 'helper_overuse');
  assert.equal(mark?.copy, '1 more helper slip curses this landing.');
});

void test('tier pressure counts toward the next visible tier only', () => {
  assert.equal(tierPressure('short_jump', 2), null);
  assert.deepEqual(tierPressure('short_jump', 4), { filled: 1, total: 3 });
  assert.deepEqual(tierPressure('overjump', 7), { filled: 1, total: 4 });
  assert.equal(tierPressure('overjump', 10), null);
  assert.deepEqual(tierPressure('successful_clear', 5), {
    filled: 2,
    total: 3,
  });
  assert.equal(tierPressure('successful_clear', 6), null);
});

void test('every fall below saturation changes what the site draws', () => {
  const site = seededSites()[0]!;
  for (const bucket of ['short_jump', 'wall_bonk', 'overjump'] as const) {
    for (let count = 0; count < 10; count += 1) {
      const before = withCounters(site, { [bucket]: count });
      const after = withCounters(site, { [bucket]: count + 1 });
      assert.equal(bucketDrivesVisibleSlot(before.counters, bucket), true);
      assert.notEqual(
        siteFace(before),
        siteFace(after),
        `${bucket} ${count} → ${count + 1} was invisible`
      );
    }
    assert.equal(
      bucketDrivesVisibleSlot(withCounters(site, { [bucket]: 10 }).counters, bucket),
      false
    );
  }
});

void test('a quieter hazard bucket cannot change a louder bucket’s brick', () => {
  const counters = { ...ZERO_COUNTERS, overjump: 5, helper_overuse: 1 };
  assert.equal(bucketDrivesVisibleSlot(counters, 'helper_overuse'), false);
  assert.equal(bucketDrivesVisibleSlot(counters, 'overjump'), true);
  assert.equal(
    bucketDrivesVisibleSlot({ ...ZERO_COUNTERS, overjump: 3, helper_overuse: 4 }, 'overjump'),
    false
  );
});

void test('a forming brick shows falls from both hazard buckets', () => {
  const site = seededSites()[0]!;
  for (const [before, bucket] of [
    [{ helper_overuse: 1 }, 'overjump'],
    [{ overjump: 1, helper_overuse: 1 }, 'helper_overuse'],
    [{ overjump: 2, helper_overuse: 1 }, 'helper_overuse'],
  ] as const) {
    const prior = withCounters(site, before);
    const next = withCounters(site, {
      ...before,
      [bucket]: (prior.counters[bucket] ?? 0) + 1,
    });
    assert.equal(bucketDrivesVisibleSlot(prior.counters, bucket), true);
    assert.notEqual(siteFace(prior), siteFace(next), JSON.stringify(before));
  }
});

void test('forming copy names the consequence, not the mechanic', () => {
  assert.equal(
    formingCopy('wall_bonk', 'ghost_platform', 2),
    '2 more wall bonks wake a ghost ledge here.'
  );
  assert.equal(
    formingCopy('successful_clear', 'lantern_trail', 1),
    '1 more clean clear lights a trail here.'
  );
});
