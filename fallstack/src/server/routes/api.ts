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
  createInitialAchievements,
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
  type AchievementState,
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
  achievements: AchievementState;
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
  if (!body || !validAttemptId(body.attemptId) || !isZoneId(body.zoneId) || !isFailureBucket(body.failureBucket)) {
    return error(c, 'Invalid fall event.');
  }

  try {
    const state = await loadDailyState();
    if (body.dailySeed !== state.dailySeed) return error(c, 'Stale tower seed.', 409);
    const duplicate = await seenEvent(state, `fall:${body.attemptId}`);
    if (duplicate) {
      return c.json<RecordFallResponse>({
        type: 'recordFall',
        counted: false,
        message: 'Your fall was already heard.',
        snapshot: snapshotFor(state),
      });
    }

    const userKey = contributorKey();
    const username = await currentDisplayUsername();
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
      updateHighestClimber(state, username, body.zoneId, body.highestY);
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
  if (!body || !validAttemptId(body.attemptId) || !isZoneId(body.zoneId)) return error(c, 'Invalid clear event.');

  try {
    const state = await loadDailyState();
    if (body.dailySeed !== state.dailySeed) return error(c, 'Stale tower seed.', 409);
    const duplicate = await seenEvent(state, `clear:${body.attemptId}:${body.zoneId}`);
    if (duplicate) {
      return c.json<RecordClearResponse>({
        type: 'recordClear',
        counted: false,
        message: 'That checkpoint already held.',
        snapshot: snapshotFor(state),
      });
    }

    const clearCapKey = keyFor(state, `user:${contributorKey()}:zone:${body.zoneId}:clears`);
    const clearContribution = await redis.incrBy(clearCapKey, 1);
    const counted = clearContribution <= USER_ZONE_CLEAR_CAP;
    const username = await currentDisplayUsername();

    if (counted) {
      state.counters[body.zoneId].successfulClears += 1;
      state.totalClears += 1;
      updateHighestClimber(state, username, body.zoneId, body.highestY);
      updateBestStabilizer(state, username, clearContribution);
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
    if (!validAttemptId(body?.attemptId)) return error(c, 'Invalid summit event.');
    const duplicate = await seenEvent(state, `summit:${body.attemptId}`);
    if (duplicate) {
      return c.json<RecordSummitResponse>({
        type: 'recordSummit',
        counted: false,
        message: 'The summit already knows you.',
        snapshot: snapshotFor(state),
      });
    }

    const summitCapKey = keyFor(state, `user:${contributorKey()}:summits`);
    const summitContribution = await redis.incrBy(summitCapKey, 1);
    const counted = summitContribution <= 1;
    const username = await currentDisplayUsername();

    if (counted) {
      if (!state.achievements.firstSummitUsername) {
        state.achievements.firstSummitUsername = username;
        state.achievements.firstSummitAt = Date.now();
      }
      updateHighestClimber(state, username, 'moon_roof', 392);
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
    achievements: createInitialAchievements(),
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
    achievements: { ...createInitialAchievements(), ...stored.achievements },
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

async function seenEvent(state: StoredDailyState, eventId: string): Promise<boolean> {
  const key = keyFor(state, `event:${eventId}`);
  const existing = await redis.get(key);
  if (existing) return true;
  await redis.set(key, '1');
  await redis.expire(key, 60 * 60 * 30);
  return false;
}

function updateHighestClimber(
  state: StoredDailyState,
  username: string,
  zoneId: ZoneId,
  highestY: number | undefined
) {
  if (typeof highestY !== 'number' || Number.isNaN(highestY)) return;
  if (highestY < state.achievements.highestClimberY) {
    state.achievements.highestClimberY = Math.max(260, highestY);
    state.achievements.highestClimberZone = zoneId;
    state.achievements.highestClimberUsername = username;
  }
}

function updateBestStabilizer(state: StoredDailyState, username: string, userClearCount: number) {
  if (userClearCount > state.achievements.bestStabilizerClears) {
    state.achievements.bestStabilizerClears = userClearCount;
    state.achievements.bestStabilizerUsername = username;
  }
}

async function currentDisplayUsername(): Promise<string> {
  const username = context.username ?? (await reddit.getCurrentUsername()) ?? null;
  return username ? `u/${username}` : 'a quiet climber';
}

function contributorKey(): string {
  return context.userId ?? context.loid ?? 'anonymous';
}

function validAttemptId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9:_-]{8,80}$/.test(value);
}

function error(c: HonoContext, message: string, status: 400 | 409 | 500 = 400) {
  return c.json<ApiErrorResponse>({ status: 'error', message }, status);
}
