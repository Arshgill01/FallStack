import { Hono, type Context as HonoContext } from 'hono';
import { context, redis, reddit } from '@devvit/web/server';
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
  createDailySeed,
  createSeededCounters,
  deriveSnapshot,
  fallFeedback,
  clearFeedback,
  isFailureBucket,
  isZoneId,
  SEEDED_TOTAL_FALLS,
  ZERO_COUNTERS,
  type GameSnapshot,
  type ZoneId,
  type ZoneMutationCounters,
} from '../../shared/game/mutation';
import { nextZoneId } from '../../shared/game/tower';

const USER_BUCKET_CAP = 3;
const USER_DAILY_FAILURE_CAP = 10;
const USER_ZONE_CLEAR_CAP = 3;

type StoredDailyState = {
  dailySeed: string;
  dateKey: string;
  counters: Record<ZoneId, ZoneMutationCounters>;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
};

export const api = new Hono();

api.get('/init-game', async (c) => {
  const postId = context.postId;
  if (!postId) return error(c, 'postId is required but missing from context');

  try {
    const state = await loadDailyState();
    const username = context.username ?? (await reddit.getCurrentUsername()) ?? 'climber';

    return c.json<InitGameResponse>({
      type: 'initGame',
      postId,
      username,
      snapshot: snapshotFor(state),
    });
  } catch (err) {
    console.error('init-game failed', err);
    return error(c, 'The tower failed to wake.');
  }
});

api.post('/record-fall', async (c) => {
  const postId = context.postId;
  if (!postId) return error(c, 'postId is required but missing from context');

  const body = await c.req.json<Partial<RecordFallRequest>>().catch(() => null);
  if (!body || !isZoneId(body.zoneId) || !isFailureBucket(body.failureBucket)) {
    return error(c, 'Invalid fall event.');
  }

  try {
    const state = await loadDailyState();
    if (body.dailySeed !== state.dailySeed) return error(c, 'Stale tower seed.', 409);

    const userKey = contributorKey();
    const bucketCapKey = keyFor(
      state,
      `user:${userKey}:zone:${body.zoneId}:bucket:${body.failureBucket}`
    );
    const dailyCapKey = keyFor(state, `user:${userKey}:falls`);
    const [bucketContribution, dailyContribution] = await Promise.all([
      redis.incrBy(bucketCapKey, 1),
      redis.incrBy(dailyCapKey, 1),
    ]);

    const counted =
      bucketContribution <= USER_BUCKET_CAP &&
      dailyContribution <= USER_DAILY_FAILURE_CAP;

    if (counted) {
      state.counters[body.zoneId][body.failureBucket] += 1;
      state.totalFalls += 1;
      await saveDailyState(state);
    }

    const snapshot = snapshotFor(state);
    const zone = snapshot.zones.find((candidate) => candidate.id === body.zoneId);

    return c.json<RecordFallResponse>({
      type: 'recordFall',
      counted,
      message: fallFeedback({
        zoneName: zone?.name ?? 'This zone',
        bucket: body.failureBucket,
        count: state.counters[body.zoneId][body.failureBucket],
        counted,
      }),
      snapshot,
    });
  } catch (err) {
    console.error('record-fall failed', err);
    return error(c, 'The fall was lost in the stones.');
  }
});

api.post('/record-clear', async (c) => {
  const body = await c.req.json<Partial<RecordClearRequest>>().catch(() => null);
  if (!body || !isZoneId(body.zoneId)) return error(c, 'Invalid clear event.');

  try {
    const state = await loadDailyState();
    if (body.dailySeed !== state.dailySeed) return error(c, 'Stale tower seed.', 409);

    const clearCapKey = keyFor(state, `user:${contributorKey()}:zone:${body.zoneId}:clears`);
    const clearContribution = await redis.incrBy(clearCapKey, 1);
    const counted = clearContribution <= USER_ZONE_CLEAR_CAP;

    if (counted) {
      state.counters[body.zoneId].successfulClears += 1;
      state.totalClears += 1;
      await saveDailyState(state);
    }

    const snapshot = snapshotFor(state);
    const zone = snapshot.zones.find((candidate) => candidate.id === body.zoneId);
    const next = nextZoneId(body.zoneId);
    const nextZone = next ? snapshot.zones.find((candidate) => candidate.id === next) : undefined;

    return c.json<RecordClearResponse>({
      type: 'recordClear',
      counted,
      message: clearFeedback({
        zoneName: zone?.name ?? 'This zone',
        clears: state.counters[body.zoneId].successfulClears,
        counted,
        nextZoneStatus: nextZone?.status,
      }),
      snapshot,
    });
  } catch (err) {
    console.error('record-clear failed', err);
    return error(c, 'The checkpoint did not hold.');
  }
});

api.post('/record-summit', async (c) => {
  const body = await c.req.json<Partial<RecordSummitRequest>>().catch(() => null);

  try {
    const state = await loadDailyState();
    if (body?.dailySeed && body.dailySeed !== state.dailySeed) {
      return error(c, 'Stale tower seed.', 409);
    }

    const summitCapKey = keyFor(state, `user:${contributorKey()}:summits`);
    const summitContribution = await redis.incrBy(summitCapKey, 1);
    const counted = summitContribution <= 1;

    if (counted) {
      state.totalSummits += 1;
      await saveDailyState(state);
    }

    return c.json<RecordSummitResponse>({
      type: 'recordSummit',
      counted,
      message: counted ? 'The summit remembers your name.' : 'The summit already knows you.',
      snapshot: snapshotFor(state),
    });
  } catch (err) {
    console.error('record-summit failed', err);
    return error(c, 'The summit went quiet.');
  }
});

async function loadDailyState(): Promise<StoredDailyState> {
  const seed = createDailySeed();
  const stored = await redis.get(stateKey(seed.dateKey));
  if (stored) {
    return reviveState(JSON.parse(stored) as Partial<StoredDailyState>, seed);
  }

  const state: StoredDailyState = {
    ...seed,
    counters: createSeededCounters(),
    totalFalls: SEEDED_TOTAL_FALLS,
    totalClears: 0,
    totalSummits: 0,
  };
  await saveDailyState(state);
  return state;
}

function reviveState(
  stored: Partial<StoredDailyState>,
  seed: { dailySeed: string; dateKey: string }
): StoredDailyState {
  const counters = createSeededCounters();
  for (const zoneId of Object.keys(counters) as ZoneId[]) {
    counters[zoneId] = { ...ZERO_COUNTERS, ...stored.counters?.[zoneId] };
  }

  return {
    dailySeed: seed.dailySeed,
    dateKey: seed.dateKey,
    counters,
    totalFalls: Math.max(SEEDED_TOTAL_FALLS, stored.totalFalls ?? SEEDED_TOTAL_FALLS),
    totalClears: stored.totalClears ?? 0,
    totalSummits: stored.totalSummits ?? 0,
  };
}

async function saveDailyState(state: StoredDailyState): Promise<void> {
  await redis.set(stateKey(state.dateKey), JSON.stringify(state));
}

function snapshotFor(state: StoredDailyState): GameSnapshot {
  return deriveSnapshot(state);
}

function stateKey(dateKey: string): string {
  return `fallstack:daily:${dateKey}:state`;
}

function keyFor(state: StoredDailyState, suffix: string): string {
  return `fallstack:daily:${state.dateKey}:${suffix}`;
}

function contributorKey(): string {
  return context.userId ?? context.loid ?? 'anonymous';
}

function error(c: HonoContext, message: string, status: 400 | 409 | 500 = 400) {
  return c.json<ApiErrorResponse>({ status: 'error', message }, status);
}
