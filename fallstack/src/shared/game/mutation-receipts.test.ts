/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClearMutationReceipt,
  createMutationReceipt,
  createNonSiteMutationReceipt,
} from './mutation-receipts.js';
import { ZERO_COUNTERS } from './mutation.js';
import { mutationBeatForReceipt } from './board.js';

void test('accepted fall receipt proves exact site, delta, and spawned artifact', () => {
  assert.deepEqual(
    createMutationReceipt({
      eventId: 'fall_event_12345678',
      boardId: 'board_2026_07_13_v1',
      revisionBefore: 39,
      siteId: 'impact-v1:start:ledge-orbital_scrapyard-1',
      siteName: 'First Gap',
      bucket: 'short_jump',
      siteBefore: { ...ZERO_COUNTERS, short_jump: 2 },
    }),
    {
      eventId: 'fall_event_12345678',
      boardId: 'board_2026_07_13_v1',
      accepted: true,
      rejection: null,
      revisionBefore: 39,
      revisionAfter: 40,
      siteId: 'impact-v1:start:ledge-orbital_scrapyard-1',
      siteName: 'First Gap',
      bucket: 'short_jump',
      counterBefore: 2,
      counterAfter: 3,
      nextThreshold: 6,
      visibleChange: 'artifact_spawned',
      artifactType: 'corpse_stack',
      artifactTier: 'base',
      copy: 'Your fall spawned Corpse Stack at First Gap. 3 more short jumps upgrade it.',
    }
  );
});

void test('capped receipt never claims a board or counter change', () => {
  assert.deepEqual(
    createMutationReceipt({
      eventId: 'fall_event_87654321',
      boardId: 'board_2026_07_13_v1',
      revisionBefore: 40,
      siteId: 'impact-v1:start:ledge-orbital_scrapyard-1',
      siteName: 'First Gap',
      bucket: 'short_jump',
      siteBefore: { ...ZERO_COUNTERS, short_jump: 3 },
      rejection: 'capped',
    }),
    {
      eventId: 'fall_event_87654321',
      boardId: 'board_2026_07_13_v1',
      accepted: false,
      rejection: 'capped',
      revisionBefore: 40,
      revisionAfter: 40,
      siteId: 'impact-v1:start:ledge-orbital_scrapyard-1',
      siteName: 'First Gap',
      bucket: 'short_jump',
      counterBefore: 3,
      counterAfter: 3,
      nextThreshold: 6,
      visibleChange: 'none',
      artifactType: null,
      artifactTier: null,
      copy: 'First Gap has heard enough from you today. Shared state stayed at 3.',
    }
  );
});

void test('third clean clear reinforces the exact site', () => {
  const receipt = createClearMutationReceipt({
    eventId: 'clear_event_12345678',
    boardId: 'board_2026_07_13_v1',
    revisionBefore: 40,
    siteId: 'impact-v1:start:ledge-orbital_scrapyard-1',
    siteName: 'First Gap',
    siteBefore: { ...ZERO_COUNTERS, successfulClears: 2 },
  });

  assert.equal(receipt.accepted, true);
  assert.equal(receipt.revisionAfter, 41);
  assert.equal(receipt.bucket, 'successful_clear');
  assert.equal(receipt.visibleChange, 'site_reinforced');
  assert.equal(receipt.nextThreshold, 6);
  assert.equal(receipt.copy, 'Your clean line reinforced First Gap. 3 more clean clears stabilize it.');
});

function wallBonkReceipt(siteBefore: typeof ZERO_COUNTERS) {
  return createMutationReceipt({
    eventId: 'fall_event_wall_bonk',
    boardId: 'board_2026_07_13_v1',
    revisionBefore: 50,
    siteId: 'impact-v1:a:b',
    siteName: 'Moon Chapel · Lower Scar',
    bucket: 'wall_bonk',
    siteBefore,
  });
}

void test('receipts announce what the site renders, not raw thresholds', () => {
  // A third wall bonk spawns a ghost beside an existing corpse stack.
  const spawned = wallBonkReceipt({ ...ZERO_COUNTERS, short_jump: 4, wall_bonk: 2 });
  assert.equal(spawned.visibleChange, 'artifact_spawned');
  assert.equal(spawned.artifactType, 'ghost_platform');

  // The sixth marks the ghost as remembered; the tenth overgrows it.
  assert.equal(
    wallBonkReceipt({ ...ZERO_COUNTERS, wall_bonk: 5 }).visibleChange,
    'artifact_upgraded'
  );
  assert.equal(
    wallBonkReceipt({ ...ZERO_COUNTERS, wall_bonk: 9 }).visibleChange,
    'site_cursed'
  );

  // A helper slip under a louder overjump brick changes nothing visible.
  const quiet = createMutationReceipt({
    eventId: 'fall_event_helper_slip',
    boardId: 'board_2026_07_13_v1',
    revisionBefore: 50,
    siteId: 'impact-v1:a:b',
    siteName: 'Moon Chapel · Lower Scar',
    bucket: 'helper_overuse',
    siteBefore: { ...ZERO_COUNTERS, overjump: 5, helper_overuse: 2 },
  });
  assert.equal(quiet.visibleChange, 'mark_added');
  assert.match(quiet.copy, /^Your fall changed /);
});

void test('tier upgrades name what the artifact now does, here and remotely', () => {
  const holds = wallBonkReceipt({ ...ZERO_COUNTERS, wall_bonk: 5 });
  assert.equal(holds.artifactTier, 'remembered');
  assert.match(holds.copy, /^Your fall made Moon Chapel · Lower Scar's Ghost Platform hold longer\./);
  assert.equal(
    mutationBeatForReceipt(holds)?.copy,
    "6 wall bonks made Moon Chapel · Lower Scar's Ghost Platform hold longer."
  );

  const flickers = wallBonkReceipt({ ...ZERO_COUNTERS, wall_bonk: 9 });
  assert.equal(
    flickers.copy,
    'Your fall overgrew Moon Chapel · Lower Scar: its Ghost Platform now flickers out fast.'
  );
  assert.equal(
    mutationBeatForReceipt(flickers)?.copy,
    'Moon Chapel · Lower Scar became overgrown after 10 wall bonks: its Ghost Platform flickers out fast.'
  );
});

void test('stale board receipt cannot imply a mutation', () => {
  assert.deepEqual(
    createNonSiteMutationReceipt({
      eventId: 'summit_event_12345678',
      boardId: 'board_2026_07_13_v1',
      revisionBefore: 41,
      rejection: 'stale',
      copy: 'A new daily tower replaced this board.',
    }),
    {
      eventId: 'summit_event_12345678',
      boardId: 'board_2026_07_13_v1',
      accepted: false,
      rejection: 'stale',
      revisionBefore: 41,
      revisionAfter: 41,
      siteId: null,
      siteName: null,
      bucket: null,
      counterBefore: null,
      counterAfter: null,
      nextThreshold: null,
      visibleChange: 'none',
      copy: 'A new daily tower replaced this board.',
    }
  );
});

void test('unavailable board receipt proves the shared board stayed unchanged', () => {
  const receipt = createNonSiteMutationReceipt({
    eventId: 'fall:attempt-unavailable',
    boardId: 'community:t5_test:2026-07-13:v1',
    revisionBefore: 42,
    rejection: 'unavailable',
    copy: 'The shared board did not change. Your climb can continue.',
  });

  assert.equal(receipt.accepted, false);
  assert.equal(receipt.rejection, 'unavailable');
  assert.equal(receipt.revisionAfter, 42);
  assert.equal(receipt.visibleChange, 'none');
});
