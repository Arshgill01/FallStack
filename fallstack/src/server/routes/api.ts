import {
  context as devvitContext,
  reddit as devvitReddit,
  realtime as devvitRealtime,
} from '@devvit/web/server';
import { Hono, type Context as HonoContext } from 'hono';
import type {
  ApiErrorResponse,
  BoardRevisionResponse,
  InitGameResponse,
  RecordClearRequest,
  RecordClearResponse,
  RecordFallRequest,
  RecordFallResponse,
  RecordSummitRequest,
  RecordSummitResponse,
} from '../../shared/api.js';
import {
  validateRecordClearRequest,
  validateRecordFallRequest,
  validateRecordSummitRequest,
} from '../../shared/game/events.js';
import {
  resolveClearRescuers,
  resolveClearSite,
  resolveFallObservation,
} from '../../shared/game/mutation-events.js';
import {
  createNonSiteMutationReceipt,
  type MutationReceipt,
} from '../../shared/game/mutation-receipts.js';
import { TOP_ZONE_ID } from '../../shared/game/mutation.js';
import { redditModmailUrl, redditPostUrl } from '../../shared/reddit.js';
import {
  echoForReceipt,
  realtimeChannelForBoard,
  type BoardEcho,
  type BoardRevisionMessage,
} from '../../shared/realtime.js';
import {
  boardSnapshotFor,
  advancePlayerCheckpoint,
  loadBoardRevision,
  loadBoardState,
  loadPlayerLegacy,
  loadPlayerResume,
  recordClearMutation,
  recordFallMutation,
  recordSummitMutation,
} from '../board-store.js';

const defaultBoardStore = {
  loadBoardRevision,
  loadBoardState,
  loadPlayerResume,
  loadPlayerLegacy,
  advancePlayerCheckpoint,
  recordClearMutation,
  recordFallMutation,
  recordSummitMutation,
};

type ApiDependencies = {
  context: { postId?: string; subredditName?: string; username?: string };
  reddit: { getCurrentUsername: () => Promise<string | undefined> };
  realtime?: {
    send: (channel: string, message: BoardRevisionMessage) => Promise<void>;
  };
  boardStore: typeof defaultBoardStore;
  now: () => number;
};

export const api = createApi({
  context: devvitContext,
  reddit: devvitReddit,
  realtime: devvitRealtime,
  boardStore: defaultBoardStore,
  now: Date.now,
});

export function createApi(dependencies: ApiDependencies): Hono {
  const api = new Hono();

  api.get('/init-game', async (c) => {
    const postId = dependencies.context.postId;
    if (!postId) return error(c, 'postId is required but missing from context');

    try {
      const [state, resume, legacy] = await Promise.all([
        dependencies.boardStore.loadBoardState(),
        dependencies.boardStore.loadPlayerResume(),
        dependencies.boardStore.loadPlayerLegacy(),
      ]);
      const username =
        dependencies.context.username ??
        (await dependencies.reddit.getCurrentUsername()) ??
        'climber';

      return c.json<InitGameResponse>({
        type: 'initGame',
        postId,
        postUrl: redditPostUrl(dependencies.context.subredditName, postId),
        supportUrl: redditModmailUrl(dependencies.context.subredditName),
        username,
        resume,
        legacy,
        snapshot: boardSnapshotFor(state),
      });
    } catch (err) {
      console.error('init-game failed', err);
      return error(c, 'The tower failed to wake.', 500);
    }
  });

  api.get('/board-revision', async (c) => {
    if (!dependencies.context.postId)
      return error(c, 'postId is required but missing from context');

    try {
      const state = await dependencies.boardStore.loadBoardRevision();
      return c.json<BoardRevisionResponse>({
        type: 'boardRevision',
        boardId: state.board.boardId,
        revision: state.revision,
      });
    } catch (err) {
      console.error('board-revision failed', err);
      return error(c, 'The tower failed to answer.', 500);
    }
  });

  api.post('/record-fall', async (c) => {
    if (!dependencies.context.postId)
      return error(c, 'postId is required but missing from context');

    const parsed = validateRecordFallRequest(
      await c.req.json<Partial<RecordFallRequest>>().catch(() => null),
      dependencies.now()
    );
    if (!parsed.ok) return error(c, parsed.message);
    const body = parsed.value;
    let state: Awaited<ReturnType<typeof loadBoardState>> | null = null;

    try {
      state = await dependencies.boardStore.loadBoardState();
      if (isStaleBoard(body, state))
        return mutationError(
          c,
          state,
          body.eventId,
          'stale',
          'A new daily tower replaced this board.',
          409
        );
      const resolution = resolveFallObservation(body, boardSnapshotFor(state));
      if (!resolution.ok)
        return mutationError(
          c,
          state,
          body.eventId,
          'invalid',
          resolution.message
        );
      const receipt = await dependencies.boardStore.recordFallMutation({
        state,
        eventId: body.eventId,
        fall: resolution.value,
        highestY: body.highestY,
        username: await currentDisplayUsername(dependencies),
      });
      const snapshot = boardSnapshotFor(
        await dependencies.boardStore.loadBoardState()
      );
      await publishBoardRevision(
        dependencies,
        isNewMutation(receipt, state),
        snapshot,
        echoForReceipt({
          kind: 'fall',
          receipt,
          zoneId: resolution.value.zoneId,
          climber: null,
        })
      );

      return c.json<RecordFallResponse>({
        type: 'recordFall',
        counted: receipt.accepted,
        message: receipt.copy,
        receipt,
        snapshot,
      });
    } catch (err) {
      console.error('record-fall failed', err);
      if (state)
        return mutationError(
          c,
          state,
          body.eventId,
          'unavailable',
          'The shared board did not change. Your climb can continue.',
          500
        );
      return error(c, 'The fall was lost in the stones.', 500);
    }
  });

  api.post('/record-clear', async (c) => {
    if (!dependencies.context.postId)
      return error(c, 'postId is required but missing from context');

    const parsed = validateRecordClearRequest(
      await c.req.json<Partial<RecordClearRequest>>().catch(() => null),
      dependencies.now()
    );
    if (!parsed.ok) return error(c, parsed.message);
    const body = parsed.value;
    let state: Awaited<ReturnType<typeof loadBoardState>> | null = null;

    try {
      state = await dependencies.boardStore.loadBoardState();
      if (isStaleBoard(body, state))
        return mutationError(
          c,
          state,
          body.eventId,
          'stale',
          'A new daily tower replaced this board.',
          409
        );
      const site = resolveClearSite(boardSnapshotFor(state), body.zoneId);
      if (!site)
        return mutationError(
          c,
          state,
          body.eventId,
          'invalid',
          'Invalid clear site.'
        );
      const receipt = await dependencies.boardStore.recordClearMutation({
        state,
        eventId: body.eventId,
        zoneId: body.zoneId,
        ...site,
        highestY: body.highestY,
        username: await currentDisplayUsername(dependencies),
        rescuers: resolveClearRescuers(
          boardSnapshotFor(state),
          body.zoneId,
          body.helperArtifactIds
        ),
      });
      const resume =
        await dependencies.boardStore.advancePlayerCheckpoint(body.zoneId);
      const snapshot = boardSnapshotFor(
        await dependencies.boardStore.loadBoardState()
      );
      await publishBoardRevision(
        dependencies,
        isNewMutation(receipt, state),
        snapshot,
        echoForReceipt({
          kind: 'clear',
          receipt,
          zoneId: body.zoneId,
          climber: await namedClimber(dependencies),
        })
      );

      return c.json<RecordClearResponse>({
        type: 'recordClear',
        counted: receipt.accepted,
        message: receipt.copy,
        receipt,
        resume,
        snapshot,
      });
    } catch (err) {
      console.error('record-clear failed', err);
      if (state)
        return mutationError(
          c,
          state,
          body.eventId,
          'unavailable',
          'The shared board did not change. Your climb can continue.',
          500
        );
      return error(c, 'The checkpoint did not hold.', 500);
    }
  });

  api.post('/record-summit', async (c) => {
    if (!dependencies.context.postId)
      return error(c, 'postId is required but missing from context');

    const parsed = validateRecordSummitRequest(
      await c.req.json<Partial<RecordSummitRequest>>().catch(() => null),
      dependencies.now()
    );
    if (!parsed.ok) return error(c, parsed.message);
    const body = parsed.value;
    let state: Awaited<ReturnType<typeof loadBoardState>> | null = null;

    try {
      state = await dependencies.boardStore.loadBoardState();
      if (isStaleBoard(body, state))
        return mutationError(
          c,
          state,
          body.eventId,
          'stale',
          'A new daily tower replaced this board.',
          409
        );
      const receipt = await dependencies.boardStore.recordSummitMutation({
        state,
        eventId: body.eventId,
        highestY: body.highestY,
        username: await currentDisplayUsername(dependencies),
      });
      const snapshot = boardSnapshotFor(
        await dependencies.boardStore.loadBoardState()
      );
      await publishBoardRevision(
        dependencies,
        isNewMutation(receipt, state),
        snapshot,
        echoForReceipt({
          kind: 'summit',
          receipt,
          zoneId: TOP_ZONE_ID,
          climber: await namedClimber(dependencies),
        })
      );

      return c.json<RecordSummitResponse>({
        type: 'recordSummit',
        counted: receipt.accepted,
        message: receipt.copy,
        receipt,
        snapshot,
      });
    } catch (err) {
      console.error('record-summit failed', err);
      if (state)
        return mutationError(
          c,
          state,
          body.eventId,
          'unavailable',
          'The shared board did not change. Your climb can continue.',
          500
        );
      return error(c, 'The summit went quiet.', 500);
    }
  });

  return api;
}

function isStaleBoard(
  event: { boardId: string; boardRevision: number },
  state: Awaited<ReturnType<typeof loadBoardState>>
): boolean {
  return (
    event.boardId !== state.board.boardId ||
    event.boardRevision > state.revision
  );
}

async function currentDisplayUsername(
  dependencies: ApiDependencies
): Promise<string> {
  const username =
    dependencies.context.username ??
    (await dependencies.reddit.getCurrentUsername()) ??
    null;
  return username ? `u/${username}` : 'a quiet climber';
}

// Display identity for positive echoes only; a signed-out climber stays
// unnamed rather than becoming "a quiet climber" in someone else's tower.
async function namedClimber(
  dependencies: ApiDependencies
): Promise<string | null> {
  const username =
    dependencies.context.username ??
    (await dependencies.reddit.getCurrentUsername()) ??
    null;
  return username && /^[A-Za-z0-9_-]{2,24}$/.test(username)
    ? `u/${username}`
    : null;
}

function isNewMutation(
  receipt: MutationReceipt,
  state: Awaited<ReturnType<typeof loadBoardState>>
): boolean {
  return receipt.accepted && receipt.revisionAfter > state.revision;
}

async function publishBoardRevision(
  dependencies: ApiDependencies,
  accepted: boolean,
  snapshot: ReturnType<typeof boardSnapshotFor>,
  echo: BoardEcho
): Promise<void> {
  if (!accepted || !dependencies.realtime) return;
  await dependencies.realtime
    .send(realtimeChannelForBoard(snapshot.boardId), {
      type: 'board-revision',
      boardId: snapshot.boardId,
      revision: snapshot.revision,
      echo,
    })
    .catch((error: unknown) => {
      console.warn('Realtime revision hint failed; polling will recover.', error);
    });
}

function mutationError(
  c: HonoContext,
  state: Awaited<ReturnType<typeof loadBoardState>>,
  eventId: string,
  rejection: 'stale' | 'invalid' | 'unavailable',
  message: string,
  status: 400 | 409 | 500 = 400
) {
  const receipt = createNonSiteMutationReceipt({
    eventId,
    boardId: state.board.boardId,
    revisionBefore: state.revision,
    rejection,
    copy: message,
  });
  return c.json<ApiErrorResponse>(
    {
      status: 'error',
      message,
      receipt,
      snapshot: boardSnapshotFor(state),
    },
    status
  );
}

function error(c: HonoContext, message: string, status: 400 | 409 | 500 = 400) {
  return c.json<ApiErrorResponse>({ status: 'error', message }, status);
}
