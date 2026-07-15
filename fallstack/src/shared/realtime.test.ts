import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
