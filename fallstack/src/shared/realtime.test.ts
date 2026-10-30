import assert from 'node:assert/strict';
import test from 'node:test';
import {
  echoForReceipt,
  echoKeyForEvent,
  parseBoardEcho,
  isBoardRevisionMessage,
  isNewerBoardRevision,
  realtimeChannelForBoard,
} from './realtime.js';

void test('board identities map to supported exact Realtime channels', () => {
  const channel = realtimeChannelForBoard(
    'community:t5_fallstack:2026-07-15:v1'
  );
  assert.equal(
    channel,
    'fallstack_community_t5_fallstack_2026_07_15_v1'
  );
  assert.doesNotMatch(channel, /[^a-zA-Z0-9_]/);
});

void test('Realtime hints are validated and only newer same-board hints fetch', () => {
  const message = {
    type: 'board-revision',
    boardId: 'community:t5_fallstack:2026-07-15:v1',
    revision: 42,
  } as const;
  assert.equal(isBoardRevisionMessage(message), true);
  assert.equal(
    isNewerBoardRevision(
      { boardId: message.boardId, revision: 41 },
      message
    ),
    true
  );
  assert.equal(
    isNewerBoardRevision(
      { boardId: message.boardId, revision: 42 },
      message
    ),
    false
  );
  assert.equal(
    isBoardRevisionMessage({ ...message, revision: Number.NaN }),
    false
  );
});

const fallReceipt = {
  eventId: 'fall:attempt_abc_123',
  boardId: 'community:t5_fallstack:2026-07-15:v1',
  accepted: true,
  rejection: null,
  revisionBefore: 40,
  revisionAfter: 41,
  siteId: 'impact-v1:route-0-3:route-0-4',
  siteName: 'First Gap',
  bucket: 'short_jump',
  counterBefore: 1,
  counterAfter: 2,
  nextThreshold: 3,
  visibleChange: 'mark_added',
  copy: 'Your fall changed First Gap: 1 → 2.',
} as const;

void test('fall echoes carry the site but never the climber', () => {
  const echo = echoForReceipt({
    kind: 'fall',
    receipt: fallReceipt,
    zoneId: 'orbital_scrapyard',
    climber: 'u/alice',
  });
  assert.equal(echo.climber, null);
  assert.equal(echo.siteId, fallReceipt.siteId);
  assert.equal(echo.bucket, 'short_jump');
  assert.equal(echo.count, 2);
  assert.equal(echo.key, echoKeyForEvent(fallReceipt.eventId));
  assert.doesNotMatch(JSON.stringify(echo), /attempt_abc|alice/);
  assert.deepEqual(parseBoardEcho(echo), echo);
});

void test('clear echoes may name the climber who earned them', () => {
  const echo = echoForReceipt({
    kind: 'clear',
    receipt: { ...fallReceipt, bucket: 'successful_clear' },
    zoneId: 'orbital_scrapyard',
    climber: 'u/alice',
  });
  assert.equal(parseBoardEcho(echo)?.climber, 'u/alice');
});

void test('malformed or naming fall echoes are rejected', () => {
  const echo = echoForReceipt({
    kind: 'fall',
    receipt: fallReceipt,
    zoneId: 'orbital_scrapyard',
    climber: null,
  });
  assert.equal(parseBoardEcho({ ...echo, climber: 'u/alice' }), null);
  assert.equal(parseBoardEcho({ ...echo, kind: 'clear', climber: '<b>hi</b>' }), null);
  assert.equal(parseBoardEcho({ ...echo, siteId: 'javascript:alert(1)' }), null);
  assert.equal(parseBoardEcho({ ...echo, zoneId: 'nowhere' }), null);
  assert.equal(parseBoardEcho({ ...echo, key: 'xyz' }), null);
  assert.equal(parseBoardEcho({ ...echo, count: -1 }), null);
  assert.equal(parseBoardEcho(null), null);
});
