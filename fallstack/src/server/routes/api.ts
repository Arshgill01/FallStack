import { context, reddit } from '@devvit/web/server';
import { Hono, type Context as HonoContext } from 'hono';
import type {
  ApiErrorResponse,
  InitGameResponse,
  RecordClearRequest,
  RecordClearResponse,
  RecordFallRequest,
  RecordFallResponse,
  RecordSummitRequest,
  RecordSummitResponse,
} from '../../shared/api';
import {
  validateRecordClearRequest,
  validateRecordFallRequest,
  validateRecordSummitRequest,
} from '../../shared/game/events';
import {
  resolveClearSite,
  resolveFallObservation,
} from '../../shared/game/mutation-events';
import { createNonSiteMutationReceipt } from '../../shared/game/mutation-receipts';
import {
  boardSnapshotFor,
  loadBoardState,
  recordClearMutation,
  recordFallMutation,
  recordSummitMutation,
} from '../board-store';

export const api = new Hono();

api.get('/init-game', async (c) => {
  const postId = context.postId;
  if (!postId) return error(c, 'postId is required but missing from context');

  try {
    const state = await loadBoardState();
    const username =
      context.username ?? (await reddit.getCurrentUsername()) ?? 'climber';

    return c.json<InitGameResponse>({
      type: 'initGame',
      postId,
      username,
      snapshot: boardSnapshotFor(state),
    });
  } catch (err) {
    console.error('init-game failed', err);
    return error(c, 'The tower failed to wake.');
  }
});

api.post('/record-fall', async (c) => {
  if (!context.postId)
    return error(c, 'postId is required but missing from context');

  const parsed = validateRecordFallRequest(
    await c.req.json<Partial<RecordFallRequest>>().catch(() => null)
  );
  if (!parsed.ok) return error(c, parsed.message);
  const body = parsed.value;
  let state: Awaited<ReturnType<typeof loadBoardState>> | null = null;

  try {
    state = await loadBoardState();
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
    const receipt = await recordFallMutation({
      state,
      eventId: body.eventId,
      fall: resolution.value,
      highestY: body.highestY,
      username: await currentDisplayUsername(),
    });

    return c.json<RecordFallResponse>({
      type: 'recordFall',
      counted: receipt.accepted,
      message: receipt.copy,
      receipt,
      snapshot: boardSnapshotFor(await loadBoardState()),
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
    return error(c, 'The fall was lost in the stones.');
  }
});

api.post('/record-clear', async (c) => {
  if (!context.postId)
    return error(c, 'postId is required but missing from context');

  const parsed = validateRecordClearRequest(
    await c.req.json<Partial<RecordClearRequest>>().catch(() => null)
  );
  if (!parsed.ok) return error(c, parsed.message);
  const body = parsed.value;
  let state: Awaited<ReturnType<typeof loadBoardState>> | null = null;

  try {
    state = await loadBoardState();
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
    const receipt = await recordClearMutation({
      state,
      eventId: body.eventId,
      zoneId: body.zoneId,
      ...site,
      highestY: body.highestY,
      username: await currentDisplayUsername(),
    });

    return c.json<RecordClearResponse>({
      type: 'recordClear',
      counted: receipt.accepted,
      message: receipt.copy,
      receipt,
      snapshot: boardSnapshotFor(await loadBoardState()),
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
    return error(c, 'The checkpoint did not hold.');
  }
});

api.post('/record-summit', async (c) => {
  if (!context.postId)
    return error(c, 'postId is required but missing from context');

  const parsed = validateRecordSummitRequest(
    await c.req.json<Partial<RecordSummitRequest>>().catch(() => null)
  );
  if (!parsed.ok) return error(c, parsed.message);
  const body = parsed.value;
  let state: Awaited<ReturnType<typeof loadBoardState>> | null = null;

  try {
    state = await loadBoardState();
    if (isStaleBoard(body, state))
      return mutationError(
        c,
        state,
        body.eventId,
        'stale',
        'A new daily tower replaced this board.',
        409
      );
    const receipt = await recordSummitMutation({
      state,
      eventId: body.eventId,
      highestY: body.highestY,
      username: await currentDisplayUsername(),
    });

    return c.json<RecordSummitResponse>({
      type: 'recordSummit',
      counted: receipt.accepted,
      message: receipt.copy,
      receipt,
      snapshot: boardSnapshotFor(await loadBoardState()),
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
    return error(c, 'The summit went quiet.');
  }
});

function isStaleBoard(
  event: { boardId: string; boardRevision: number },
  state: Awaited<ReturnType<typeof loadBoardState>>
): boolean {
  return (
    event.boardId !== state.board.boardId ||
    event.boardRevision > state.revision
  );
}

async function currentDisplayUsername(): Promise<string> {
  const username =
    context.username ?? (await reddit.getCurrentUsername()) ?? null;
  return username ? `u/${username}` : 'a quiet climber';
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
