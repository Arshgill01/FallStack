/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createBoardIdentity,
  mutationBeatForReceipt,
  TOWER_VERSION,
} from './board.js';

void test('community board identity is stable for installation, UTC date, and tower version', () => {
  assert.deepEqual(
    createBoardIdentity({
      communityId: 't5_fallstack',
      communityName: 'FallStack',
      dateKey: '2026-07-13',
      dailySeed: 'fallstack-2026-07-13',
    }),
    {
      boardId: `community:t5_fallstack:2026-07-13:v${TOWER_VERSION}`,
      scope: 'community',
      scopeLabel: 'r/FallStack',
      dateKey: '2026-07-13',
      dailySeed: 'fallstack-2026-07-13',
      towerVersion: TOWER_VERSION,
    }
  );
});

void test('board identity does not expose malformed community display text', () => {
  assert.equal(
    createBoardIdentity({
      communityId: 't5_safe',
      communityName: '<script>',
      dateKey: '2026-07-13',
      dailySeed: 'fallstack-2026-07-13',
    }).scopeLabel,
    'this subreddit'
  );
});

void test('visible mutation beats use community voice rather than personal receipt voice', () => {
  const beat = mutationBeatForReceipt({
    eventId: 'fall:attempt-1',
    boardId: 'community:t5_test:2026-07-13:v1',
    accepted: true,
    rejection: null,
    revisionBefore: 40,
    revisionAfter: 41,
    siteId: 'impact-v1:start:p1',
    siteName: 'First Gap',
    bucket: 'short_jump',
    counterBefore: 5,
    counterAfter: 6,
    nextThreshold: 10,
    visibleChange: 'artifact_upgraded',
    copy: 'Your fall upgraded Mercy Nail at First Gap.',
  });

  assert.ok(beat);
  assert.equal(
    beat.copy,
    '6 short jumps upgraded First Gap to Mercy Nail.'
  );
  assert.equal(beat.copy.includes('Your'), false);
});
