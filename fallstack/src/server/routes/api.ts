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
  mergeAchievementState,
  SEEDED_TOTAL_FALLS,
  ZERO_COUNTERS,
  type GameSnapshot,
  type AchievementState,
  type ZoneId,
  type ZoneMutationCounters,
} from '../../shared/game/mutation';
import { nextZoneId } from '../../shared/game/tower';
import {
  validateRecordClearRequest,
  validateRecordFallRequest,
  validateRecordSummitRequest,
} from '../../shared/game/events';

const USER_BUCKET_CAP = 3;
const USER_DAILY_FAILURE_CAP = 10;
const USER_ZONE_CLEAR_CAP = 3;
const DAILY_KEY_TTL_SECONDS = 60 * 60 * 72;

type StoredDailyState = {
  dailySeed: string;
  dateKey: string;
  counters: Record<ZoneId, ZoneMutationCounters>;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
  achievements: AchievementState;
};

type FirstSummitClaim = {
  username: string;
  at: number;
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

  const parsed = validateRecordFallRequest(
    await c.req.json<Partial<RecordFallRequest>>().catch(() => null)
  );
  if (!parsed.ok) return error(c, parsed.message);
  const body = parsed.value;

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
      incrementDailyKey(bucketCapKey),
      incrementDailyKey(dailyCapKey),
    ]);

    const counted =
      bucketContribution <= USER_BUCKET_CAP &&
      dailyContribution <= USER_DAILY_FAILURE_CAP;

    if (counted) {
      await Promise.all([
        incrementDailyKey(counterKey(state, body.zoneId, body.failureBucket)),
        incrementDailyKey(totalKey(state, 'falls')),
      ]);
      updateHighestClimber(state, username, body.zoneId, body.highestY);
      await saveAchievements(state);
    }

    const latestState = await loadDailyState();
    const snapshot = snapshotFor(latestState);
    const zone = snapshot.zones.find((candidate) => candidate.id === body.zoneId);

    return c.json<RecordFallResponse>({
      type: 'recordFall',
      counted,
      message: fallFeedback({
        zoneName: zone?.name ?? 'This zone',
        bucket: body.failureBucket,
        count: latestState.counters[body.zoneId][body.failureBucket],
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
  const postId = context.postId;
  if (!postId) return error(c, 'postId is required but missing from context');

  const parsed = validateRecordClearRequest(
    await c.req.json<Partial<RecordClearRequest>>().catch(() => null)
  );
  if (!parsed.ok) return error(c, parsed.message);
  const body = parsed.value;

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
    const clearContribution = await incrementDailyKey(clearCapKey);
    const counted = clearContribution <= USER_ZONE_CLEAR_CAP;
    const username = await currentDisplayUsername();

    if (counted) {
      await Promise.all([
        incrementDailyKey(counterKey(state, body.zoneId, 'successfulClears')),
        incrementDailyKey(totalKey(state, 'clears')),
      ]);
      updateHighestClimber(state, username, body.zoneId, body.highestY);
      updateBestStabilizer(state, username, clearContribution);
      await saveAchievements(state);
    }

    const latestState = await loadDailyState();
    const snapshot = snapshotFor(latestState);
    const zone = snapshot.zones.find((candidate) => candidate.id === body.zoneId);
    const next = nextZoneId(body.zoneId);
    const nextZone = next ? snapshot.zones.find((candidate) => candidate.id === next) : undefined;

    return c.json<RecordClearResponse>({
      type: 'recordClear',
      counted,
      message: clearFeedback({
        zoneName: zone?.name ?? 'This zone',
        clears: latestState.counters[body.zoneId].successfulClears,
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
  const postId = context.postId;
  if (!postId) return error(c, 'postId is required but missing from context');

  const parsed = validateRecordSummitRequest(
    await c.req.json<Partial<RecordSummitRequest>>().catch(() => null)
  );
  if (!parsed.ok) return error(c, parsed.message);
  const body = parsed.value;

  try {
    const state = await loadDailyState();
    if (body.dailySeed !== state.dailySeed) {
      return error(c, 'Stale tower seed.', 409);
    }
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
    const summitContribution = await incrementDailyKey(summitCapKey);
    const counted = summitContribution <= 1;
    const username = await currentDisplayUsername();

    if (counted) {
      await claimFirstSummit(state, username);
      updateHighestClimber(state, username, 'moon_roof', 392);
      await incrementDailyKey(totalKey(state, 'summits'));
      await saveAchievements(state);
    }

    return c.json<RecordSummitResponse>({
      type: 'recordSummit',
      counted,
      message: counted ? 'The summit remembers your name.' : 'The summit already knows you.',
      snapshot: snapshotFor(await loadDailyState()),
    });
  } catch (err) {
    console.error('record-summit failed', err);
    return error(c, 'The summit went quiet.');
  }
});

async function loadDailyState(): Promise<StoredDailyState> {
  const seed = createDailySeed();
  const legacy = await redis.get(stateKey(seed.dateKey));
  const legacyState = legacy ? parseStoredState(legacy) : null;
  const baseline = legacy
    ? reviveState(legacyState ?? {}, seed)
    : {
        ...seed,
        counters: createSeededCounters(),
        totalFalls: SEEDED_TOTAL_FALLS,
        totalClears: 0,
        totalSummits: 0,
        achievements: createInitialAchievements(),
      };

  const [deltas, totals, achievements] = await Promise.all([
    loadCounterDeltas(seed),
    loadTotalDeltas(seed),
    loadAchievements(seed),
  ]);

  return {
    ...baseline,
    counters: mergeCounters(baseline.counters, deltas),
    totalFalls: baseline.totalFalls + totals.falls,
    totalClears: baseline.totalClears + totals.clears,
    totalSummits: baseline.totalSummits + totals.summits,
    achievements: { ...baseline.achievements, ...achievements },
  };
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

async function saveAchievements(state: StoredDailyState): Promise<void> {
  const current = await loadAchievements(state);
  state.achievements = mergeAchievementState(current, state.achievements);
  await setDailyKey(achievementKey(state.dateKey), JSON.stringify(state.achievements));
}

function snapshotFor(state: StoredDailyState): GameSnapshot {
  return deriveSnapshot(state);
}

function stateKey(dateKey: string): string {
  return `fallstack:daily:${dateKey}:state`;
}

function achievementKey(dateKey: string): string {
  return `fallstack:daily:${dateKey}:achievements`;
}

function firstSummitKey(dateKey: string): string {
  return `fallstack:daily:${dateKey}:achievement:first-summit`;
}

function keyFor(state: StoredDailyState, suffix: string): string {
  return `fallstack:daily:${state.dateKey}:${suffix}`;
}

function counterKey(
  state: Pick<StoredDailyState, 'dateKey'>,
  zoneId: ZoneId,
  counter: keyof ZoneMutationCounters
): string {
  return `fallstack:daily:${state.dateKey}:counter:${zoneId}:${counter}`;
}

function totalKey(state: Pick<StoredDailyState, 'dateKey'>, total: 'falls' | 'clears' | 'summits'): string {
  return `fallstack:daily:${state.dateKey}:total:${total}`;
}

async function loadCounterDeltas(seed: { dateKey: string }): Promise<Record<ZoneId, ZoneMutationCounters>> {
  const deltas = emptyCounters();
  await Promise.all(
    (Object.keys(deltas) as ZoneId[]).flatMap((zoneId) =>
      (Object.keys(ZERO_COUNTERS) as (keyof ZoneMutationCounters)[]).map(async (counter) => {
        deltas[zoneId][counter] = await readNumber(counterKey(seed, zoneId, counter));
      })
    )
  );
  return deltas;
}

async function loadTotalDeltas(seed: { dateKey: string }): Promise<{
  falls: number;
  clears: number;
  summits: number;
}> {
  const [falls, clears, summits] = await Promise.all([
    readNumber(totalKey(seed, 'falls')),
    readNumber(totalKey(seed, 'clears')),
    readNumber(totalKey(seed, 'summits')),
  ]);
  return { falls, clears, summits };
}

async function loadAchievements(seed: { dateKey: string }): Promise<AchievementState> {
  const [stored, firstSummit] = await Promise.all([
    redis.get(achievementKey(seed.dateKey)),
    readFirstSummitClaim(seed),
  ]);
  const storedAchievements = stored ? parseAchievements(stored) : {};
  return mergeAchievementState(createInitialAchievements(), {
    ...storedAchievements,
    ...(firstSummit
      ? {
          firstSummitUsername: firstSummit.username,
          firstSummitAt: firstSummit.at,
        }
      : {}),
  });
}

async function readNumber(key: string): Promise<number> {
  const value = await redis.get(key);
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function emptyCounters(): Record<ZoneId, ZoneMutationCounters> {
  return Object.fromEntries(
    (Object.keys(createSeededCounters()) as ZoneId[]).map((zoneId) => [zoneId, { ...ZERO_COUNTERS }])
  ) as Record<ZoneId, ZoneMutationCounters>;
}

function mergeCounters(
  baseline: Record<ZoneId, ZoneMutationCounters>,
  deltas: Record<ZoneId, ZoneMutationCounters>
): Record<ZoneId, ZoneMutationCounters> {
  return Object.fromEntries(
    (Object.keys(baseline) as ZoneId[]).map((zoneId) => [
      zoneId,
      {
        short_jump: baseline[zoneId].short_jump + deltas[zoneId].short_jump,
        overjump: baseline[zoneId].overjump + deltas[zoneId].overjump,
        wall_bonk: baseline[zoneId].wall_bonk + deltas[zoneId].wall_bonk,
        helper_overuse: baseline[zoneId].helper_overuse + deltas[zoneId].helper_overuse,
        successfulClears: baseline[zoneId].successfulClears + deltas[zoneId].successfulClears,
      },
    ])
  ) as Record<ZoneId, ZoneMutationCounters>;
}

function parseStoredState(value: string): Partial<StoredDailyState> | null {
  try {
    return JSON.parse(value) as Partial<StoredDailyState>;
  } catch (error) {
    console.error('Ignoring malformed legacy daily state', error);
    return null;
  }
}

function parseAchievements(value: string): Partial<AchievementState> {
  try {
    return JSON.parse(value) as Partial<AchievementState>;
  } catch (error) {
    console.error('Ignoring malformed daily achievements', error);
    return {};
  }
}

function parseFirstSummitClaim(value: string): FirstSummitClaim | null {
  try {
    const parsed = JSON.parse(value) as Partial<FirstSummitClaim>;
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.at === 'number' &&
      Number.isFinite(parsed.at)
    ) {
      return { username: parsed.username, at: parsed.at };
    }
  } catch (error) {
    console.error('Ignoring malformed first summit claim', error);
  }
  return null;
}

async function seenEvent(state: StoredDailyState, eventId: string): Promise<boolean> {
  const key = keyFor(state, `event:${eventId}`);
  const created = await redis.set(key, '1', {
    expiration: dailyExpiration(),
    nx: true,
  });
  return !created;
}

async function claimFirstSummit(state: StoredDailyState, username: string): Promise<void> {
  if (state.achievements.firstSummitUsername) return;

  const claim = { username, at: Date.now() };
  const created = await redis.set(firstSummitKey(state.dateKey), JSON.stringify(claim), {
    expiration: dailyExpiration(),
    nx: true,
  });
  const firstSummit = created ? claim : await readFirstSummitClaim(state);
  if (!firstSummit) return;

  state.achievements.firstSummitUsername = firstSummit.username;
  state.achievements.firstSummitAt = firstSummit.at;
}

async function readFirstSummitClaim(seed: { dateKey: string }): Promise<FirstSummitClaim | null> {
  const stored = await redis.get(firstSummitKey(seed.dateKey));
  return stored ? parseFirstSummitClaim(stored) : null;
}

async function incrementDailyKey(key: string): Promise<number> {
  const value = await redis.incrBy(key, 1);
  await redis.expire(key, DAILY_KEY_TTL_SECONDS);
  return value;
}

async function setDailyKey(key: string, value: string): Promise<void> {
  await redis.set(key, value, { expiration: dailyExpiration() });
}

function dailyExpiration(): Date {
  return new Date(Date.now() + DAILY_KEY_TTL_SECONDS * 1000);
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

function error(c: HonoContext, message: string, status: 400 | 409 | 500 = 400) {
  return c.json<ApiErrorResponse>({ status: 'error', message }, status);
}
