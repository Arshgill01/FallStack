import assert from 'node:assert/strict';
import test from 'node:test';
import type { BoardSnapshot } from '../../shared/game/board.js';
import { fetchChangedBoardSnapshot } from './board-sync.js';

void test('an unchanged revision probe does not fetch the full board', async () => {
  const requested: string[] = [];
  const snapshot = await fetchChangedBoardSnapshot(
    { boardId: 'community:t5_test:2026-07-14:v1', revision: 42 },
    async (input) => {
      requested.push(String(input));
      return Response.json({
        type: 'boardRevision',
        boardId: 'community:t5_test:2026-07-14:v1',
        revision: 42,
      });
    }
  );

  assert.equal(snapshot, null);
  assert.deepEqual(requested, ['/api/board-revision']);
});

void test('a newer revision fetches and returns the full board', async () => {
  const requested: string[] = [];
  const changed = {
    boardId: 'community:t5_test:2026-07-14:v1',
    revision: 43,
  } as BoardSnapshot;
  const snapshot = await fetchChangedBoardSnapshot(
    { boardId: changed.boardId, revision: 42 },
    async (input) => {
      const path = String(input);
      requested.push(path);
      return path === '/api/board-revision'
        ? Response.json({
            type: 'boardRevision',
            boardId: changed.boardId,
            revision: changed.revision,
          })
        : Response.json({
            type: 'initGame',
            postId: 't3_fallstack',
            username: 'alice',
            snapshot: changed,
          });
    }
  );

  assert.deepEqual(snapshot, changed);
  assert.deepEqual(requested, ['/api/board-revision', '/api/init-game']);
});

void test('a new daily board fetches fully even when its revision is lower', async () => {
  const requested: string[] = [];
  const nextDay = {
    boardId: 'community:t5_test:2026-07-15:v1',
    revision: 37,
  } as BoardSnapshot;
  await fetchChangedBoardSnapshot(
    { boardId: 'community:t5_test:2026-07-14:v1', revision: 84 },
    async (input) => {
      const path = String(input);
      requested.push(path);
      return path === '/api/board-revision'
        ? Response.json({
            type: 'boardRevision',
            boardId: nextDay.boardId,
            revision: nextDay.revision,
          })
        : Response.json({
            type: 'initGame',
            postId: 't3_fallstack',
            username: 'alice',
            snapshot: nextDay,
          });
    }
  );

  assert.deepEqual(requested, ['/api/board-revision', '/api/init-game']);
});
