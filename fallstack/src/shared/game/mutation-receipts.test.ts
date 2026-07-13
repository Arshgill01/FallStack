/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClearMutationReceipt,
  createMutationReceipt,
  createNonSiteMutationReceipt,
} from './mutation-receipts.js';

void test('accepted fall receipt proves exact site, delta, and spawned artifact', () => {
  assert.deepEqual(
    createMutationReceipt({
      eventId: 'fall_event_12345678',
      boardId: 'board_2026_07_13_v1',
      revisionBefore: 39,
      siteId: 'impact-v1:start:ledge-orbital_scrapyard-1',
      siteName: 'First Gap',
      bucket: 'short_jump',
      counterBefore: 2,
      counterAfter: 3,
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
      counterBefore: 3,
      counterAfter: 3,
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
    counterBefore: 2,
    counterAfter: 3,
  });

  assert.equal(receipt.accepted, true);
  assert.equal(receipt.revisionAfter, 41);
  assert.equal(receipt.bucket, 'successful_clear');
  assert.equal(receipt.visibleChange, 'site_reinforced');
  assert.equal(receipt.nextThreshold, 6);
  assert.equal(receipt.copy, 'Your clean line reinforced First Gap. 3 more clean clears stabilize it.');
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
