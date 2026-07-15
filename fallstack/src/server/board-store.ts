import {
  context as devvitContext,
  redis as devvitRedis,
} from '@devvit/web/server';
import {
  createBoardIdentity,
  createBoardSnapshot,
  mutationBeatForReceipt,
  type BoardIdentity,
  type BoardSnapshot,
  type MutationBeat,
} from '../shared/game/board.js';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  createSeededSiteCounters,
  deriveSnapshot,
  isZoneId,
  SEEDED_TOTAL_FALLS,
  TOP_ZONE_ID,
  ZONE_IDS,
  ZERO_COUNTERS,
  type AchievementState,
  type SiteMutationCounters,
  type ZoneId,
} from '../shared/game/mutation.js';
import {
  planClearMutation,
  planFallMutation,
  planSummitMutation,
  type MutationPlan,
} from '../shared/game/mutation-plans.js';
import { type MutationReceipt } from '../shared/game/mutation-receipts.js';
import type { ResolvedFall } from '../shared/game/mutation-events.js';

const DAILY_KEY_TTL_SECONDS = 60 * 60 * 72;
const MAX_TRANSACTION_ATTEMPTS = 3;

type BoardStoreContext = {
  subredditId: string;
  subredditName: string;
  userId?: string;
  loid?: string;
};

type SortedMember = { member: string; score: number };

type BoardTransaction = {
  discard: () => Promise<void>;
  multi: () => Promise<void>;
  exec: () => Promise<unknown[]>;
  expire: (key: string, seconds: number) => Promise<unknown>;
  hIncrBy: (key: string, field: string, amount: number) => Promise<unknown>;
  hSet: (key: string, values: Record<string, string>) => Promise<unknown>;
  zAdd: (key: string, ...members: SortedMember[]) => Promise<unknown>;
  zRemRangeByRank: (
    key: string,
    start: number,
    stop: number
  ) => Promise<unknown>;
};

type BoardStoreRedis = {
  expire: (key: string, seconds: number) => Promise<unknown> | unknown;
  hGet: (key: string, field: string) => Promise<string | undefined>;
  hGetAll: (key: string) => Promise<Record<string, string>>;
  hSet: (
    key: string,
    values: Record<string, string>
  ) => Promise<unknown> | unknown;
  watch: (...keys: string[]) => Promise<BoardTransaction>;
  zRange: (
    key: string,
    start: number | string,
    stop: number | string
  ) => Promise<SortedMember[]>;
};

type BoardStoreDependencies = {
  context: BoardStoreContext;
  redis: BoardStoreRedis;
  now?: () => Date;
};

type ResolvedBoardStoreDependencies = Omit<BoardStoreDependencies, 'now'> & {
  now: () => Date;
};

export type StoredBoardState = {
  board: BoardIdentity;
  revision: number;
  dailySeed: string;
  dateKey: string;
  siteCounters: Record<string, SiteMutationCounters>;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
  achievements: AchievementState;
  recentMutations: MutationBeat[];
};

export type StoredBoardRevision = {
  board: BoardIdentity;
  revision: number;
};

export type PlayerResume = {
  zoneId: ZoneId;
  mode: 'account' | 'session';
};

export function createBoardStore(dependencies: BoardStoreDependencies) {
  const resolved: ResolvedBoardStoreDependencies = {
    ...dependencies,
    now: dependencies.now ?? (() => new Date()),
  };
  return {
    loadBoardRevision: () => loadBoardRevisionWith(resolved),
    loadBoardState: () => loadBoardStateWith(resolved),
    loadBoardStateForDate: (date: Date) =>
      loadBoardStateWith({ ...resolved, now: () => date }),
    loadPlayerResume: () => loadPlayerResumeWith(resolved),
    advancePlayerCheckpoint: (clearedZoneId: ZoneId) =>
      advancePlayerCheckpointWith(resolved, clearedZoneId),
    recordFallMutation: (input: Parameters<typeof recordFallMutationWith>[1]) =>
      recordFallMutationWith(resolved, input),
    recordClearMutation: (
      input: Parameters<typeof recordClearMutationWith>[1]
    ) => recordClearMutationWith(resolved, input),
    recordSummitMutation: (
      input: Parameters<typeof recordSummitMutationWith>[1]
    ) => recordSummitMutationWith(resolved, input),
  };
}

const defaultBoardStore = createBoardStore({
  context: devvitContext,
  redis: devvitRedis,
});

export const loadBoardState = defaultBoardStore.loadBoardState;
export const loadBoardStateForDate = defaultBoardStore.loadBoardStateForDate;
export const loadBoardRevision = defaultBoardStore.loadBoardRevision;
export const loadPlayerResume = defaultBoardStore.loadPlayerResume;
export const advancePlayerCheckpoint =
  defaultBoardStore.advancePlayerCheckpoint;
export const recordFallMutation = defaultBoardStore.recordFallMutation;
export const recordClearMutation = defaultBoardStore.recordClearMutation;
export const recordSummitMutation = defaultBoardStore.recordSummitMutation;

async function loadBoardStateWith(
  dependencies: ResolvedBoardStoreDependencies
): Promise<StoredBoardState> {
  const { board, seed } = currentBoard(dependencies);
  const keys = boardKeys(board);
  const [counterFields, metaFields, achievementFields, recentMembers] =
    await Promise.all([
      dependencies.redis.hGetAll(keys.counters),
      dependencies.redis.hGetAll(keys.meta),
      dependencies.redis.hGetAll(keys.achievements),
      dependencies.redis.zRange(keys.recent, 0, -1),
    ]);
  const siteCounters = createSeededSiteCounters(seed.dailySeed);

  for (const [field, value] of Object.entries(counterFields)) {
    const parsed = parseCounterField(field);
    if (!parsed || !siteCounters[parsed.siteId]) continue;
    siteCounters[parsed.siteId]![parsed.counter] += safeNumber(value);
  }

  const acceptedEvents = safeNumber(metaFields.acceptedEvents);
  return {
    board,
    revision: SEEDED_TOTAL_FALLS + acceptedEvents,
    ...seed,
    siteCounters,
    totalFalls: SEEDED_TOTAL_FALLS + safeNumber(metaFields.organicFalls),
    totalClears: safeNumber(metaFields.organicClears),
    totalSummits: safeNumber(metaFields.organicSummits),
    achievements: parseAchievements(achievementFields),
    recentMutations: recentMembers
      .map(({ member }) => parseMutationBeat(member))
      .filter((beat): beat is MutationBeat => Boolean(beat))
      .slice(-20),
  };
}

async function loadBoardRevisionWith(
  dependencies: ResolvedBoardStoreDependencies
): Promise<StoredBoardRevision> {
  const { board } = currentBoard(dependencies);
  const acceptedEvents = safeNumber(
    await dependencies.redis.hGet(boardKeys(board).meta, 'acceptedEvents')
  );
  return {
    board,
    revision: SEEDED_TOTAL_FALLS + acceptedEvents,
  };
}

async function loadPlayerResumeWith(
  dependencies: ResolvedBoardStoreDependencies
): Promise<PlayerResume> {
  const userId = dependencies.context.userId;
  if (!userId) return { zoneId: ZONE_IDS[0], mode: 'session' };

  const { board } = currentBoard(dependencies);
  const stored = await dependencies.redis.hGet(
    boardKeys(board).progress,
    userId
  );
  return {
    zoneId: isZoneId(stored) ? stored : ZONE_IDS[0],
    mode: 'account',
  };
}

async function advancePlayerCheckpointWith(
  dependencies: ResolvedBoardStoreDependencies,
  clearedZoneId: ZoneId
): Promise<PlayerResume> {
  const nextZoneId = ZONE_IDS[ZONE_IDS.indexOf(clearedZoneId) + 1];
  const userId = dependencies.context.userId;
  if (!nextZoneId)
    return loadPlayerResumeWith(dependencies);
  if (!userId) return { zoneId: nextZoneId, mode: 'session' };

  const { board } = currentBoard(dependencies);
  const key = boardKeys(board).progress;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const tx = await dependencies.redis.watch(key);
    try {
      const stored = await dependencies.redis.hGet(key, userId);
      const currentZoneId = isZoneId(stored) ? stored : ZONE_IDS[0];
      if (ZONE_IDS.indexOf(currentZoneId) >= ZONE_IDS.indexOf(nextZoneId)) {
        await tx.discard();
        return { zoneId: currentZoneId, mode: 'account' };
      }
      await tx.multi();
      await tx.hSet(key, { [userId]: nextZoneId });
      await tx.expire(key, DAILY_KEY_TTL_SECONDS);
      const result = await tx.exec();
      if (result.length > 0)
        return { zoneId: nextZoneId, mode: 'account' };
      lastError = new Error('Checkpoint transaction conflicted.');
    } catch (error) {
      lastError = error;
      await tx.discard().catch(() => {});
    }
  }
  throw lastError ?? new Error('Checkpoint transaction failed.');
}

function currentBoard(dependencies: ResolvedBoardStoreDependencies) {
  const seed = createDailySeed(dependencies.now());
  return {
    seed,
    board: createBoardIdentity({
      communityId: dependencies.context.subredditId,
      communityName: dependencies.context.subredditName,
      ...seed,
    }),
  };
}

export function boardSnapshotFor(state: StoredBoardState): BoardSnapshot {
  return createBoardSnapshot(
    state.board,
    deriveSnapshot({
      dailySeed: state.dailySeed,
      dateKey: state.dateKey,
      counters: createSeededCounters(),
      siteCounters: state.siteCounters,
      totalFalls: state.totalFalls,
      totalClears: state.totalClears,
      totalSummits: state.totalSummits,
      achievements: state.achievements,
    }),
    state.revision,
    state.recentMutations
  );
}

async function recordFallMutationWith(
  dependencies: ResolvedBoardStoreDependencies,
  input: {
    state: StoredBoardState;
    eventId: string;
    fall: ResolvedFall;
    highestY: number;
    username: string;
  }
): Promise<MutationReceipt> {
  const keys = boardKeys(input.state.board);
  const counterField = siteCounterField(input.fall.siteId, input.fall.bucket);
  const contributor = contributorToken(dependencies.context);
  const bucketField = `${contributor}|site|${input.fall.siteId}|${input.fall.bucket}`;
  const dailyField = `${contributor}|falls`;
  const seeded = createSeededSiteCounters(input.state.dailySeed)[
    input.fall.siteId
  ]?.[input.fall.bucket];

  return runTransaction(dependencies.redis, keys, async (read) => {
    const [
      existing,
      organicCounter,
      bucketCount,
      dailyCount,
      acceptedEvents,
      currentHighestY,
    ] = await Promise.all([
      read.receipt(input.eventId),
      read.number(keys.counters, counterField),
      read.number(keys.contributors, bucketField),
      read.number(keys.contributors, dailyField),
      read.number(keys.meta, 'acceptedEvents'),
      read.number(
        keys.achievements,
        'highestClimberY',
        createInitialAchievements().highestClimberY
      ),
    ]);
    const plan = planFallMutation({
      eventId: input.eventId,
      boardId: input.state.board.boardId,
      revision: SEEDED_TOTAL_FALLS + acceptedEvents,
      siteId: input.fall.siteId,
      siteName: input.fall.siteName,
      bucket: input.fall.bucket,
      counter: (seeded ?? 0) + organicCounter,
      contributorBucketCount: bucketCount,
      contributorDailyFallCount: dailyCount,
      existingReceipt: existing,
    });

    return {
      plan,
      queue: async (tx) => {
        await queueReceipt(tx, keys, plan);
        if (!plan.applyMutation) return;
        await tx.hIncrBy(keys.counters, counterField, 1);
        await tx.hIncrBy(keys.contributors, bucketField, 1);
        await tx.hIncrBy(keys.contributors, dailyField, 1);
        await tx.hIncrBy(keys.meta, 'organicFalls', 1);
        await tx.hIncrBy(keys.meta, 'acceptedEvents', 1);
        await queueHighestClimber(
          tx,
          keys,
          input.username,
          input.fall.zoneId,
          input.highestY,
          currentHighestY
        );
        await queueMutationBeat(tx, keys, plan.receipt);
      },
    };
  });
}

async function recordClearMutationWith(
  dependencies: ResolvedBoardStoreDependencies,
  input: {
    state: StoredBoardState;
    eventId: string;
    zoneId: ZoneId;
    siteId: string;
    siteName: string;
    highestY: number;
    username: string;
  }
): Promise<MutationReceipt> {
  const keys = boardKeys(input.state.board);
  const counterField = siteCounterField(input.siteId, 'successfulClears');
  const contributorField = `${contributorToken(dependencies.context)}|zone|${input.zoneId}|clears`;
  const seeded = createSeededSiteCounters(input.state.dailySeed)[input.siteId]
    ?.successfulClears;

  return runTransaction(dependencies.redis, keys, async (read) => {
    const [
      existing,
      organicCounter,
      contributorCount,
      acceptedEvents,
      currentHighestY,
      currentBestStabilizer,
    ] = await Promise.all([
      read.receipt(input.eventId),
      read.number(keys.counters, counterField),
      read.number(keys.contributors, contributorField),
      read.number(keys.meta, 'acceptedEvents'),
      read.number(
        keys.achievements,
        'highestClimberY',
        createInitialAchievements().highestClimberY
      ),
      read.number(keys.achievements, 'bestStabilizerClears'),
    ]);
    const plan = planClearMutation({
      eventId: input.eventId,
      boardId: input.state.board.boardId,
      revision: SEEDED_TOTAL_FALLS + acceptedEvents,
      siteId: input.siteId,
      siteName: input.siteName,
      counter: (seeded ?? 0) + organicCounter,
      contributorClearCount: contributorCount,
      existingReceipt: existing,
    });

    return {
      plan,
      queue: async (tx) => {
        await queueReceipt(tx, keys, plan);
        if (!plan.applyMutation) return;
        await tx.hIncrBy(keys.counters, counterField, 1);
        await tx.hIncrBy(keys.contributors, contributorField, 1);
        await tx.hIncrBy(keys.meta, 'organicClears', 1);
        await tx.hIncrBy(keys.meta, 'acceptedEvents', 1);
        await queueHighestClimber(
          tx,
          keys,
          input.username,
          input.zoneId,
          input.highestY,
          currentHighestY
        );
        await queueBestStabilizer(
          tx,
          keys,
          input.username,
          contributorCount + 1,
          currentBestStabilizer
        );
        await queueMutationBeat(tx, keys, plan.receipt);
      },
    };
  });
}

async function recordSummitMutationWith(
  dependencies: ResolvedBoardStoreDependencies,
  input: {
    state: StoredBoardState;
    eventId: string;
    highestY: number;
    username: string;
  }
): Promise<MutationReceipt> {
  const keys = boardKeys(input.state.board);
  const contributorField = `${contributorToken(dependencies.context)}|summits`;

  return runTransaction(dependencies.redis, keys, async (read) => {
    const [
      existing,
      contributorCount,
      acceptedEvents,
      firstSummit,
      currentHighestY,
    ] = await Promise.all([
      read.receipt(input.eventId),
      read.number(keys.contributors, contributorField),
      read.number(keys.meta, 'acceptedEvents'),
      dependencies.redis.hGet(keys.achievements, 'firstSummitUsername'),
      read.number(
        keys.achievements,
        'highestClimberY',
        createInitialAchievements().highestClimberY
      ),
    ]);
    const plan = planSummitMutation({
      eventId: input.eventId,
      boardId: input.state.board.boardId,
      revision: SEEDED_TOTAL_FALLS + acceptedEvents,
      contributorSummitCount: contributorCount,
      existingReceipt: existing,
    });

    return {
      plan,
      queue: async (tx) => {
        await queueReceipt(tx, keys, plan);
        if (!plan.applyMutation) return;
        await tx.hIncrBy(keys.contributors, contributorField, 1);
        await tx.hIncrBy(keys.meta, 'organicSummits', 1);
        await tx.hIncrBy(keys.meta, 'acceptedEvents', 1);
        if (!firstSummit) {
          await tx.hSet(keys.achievements, {
            firstSummitUsername: input.username,
            firstSummitAt: String(dependencies.now().getTime()),
          });
        }
        await queueHighestClimber(
          tx,
          keys,
          input.username,
          TOP_ZONE_ID,
          input.highestY,
          currentHighestY
        );
      },
    };
  });
}

type BoardKeys = ReturnType<typeof boardKeys>;
type TxClient = BoardTransaction;
type TransactionWork = {
  plan: MutationPlan;
  queue: (tx: TxClient) => Promise<void>;
};

async function runTransaction(
  redis: BoardStoreRedis,
  keys: BoardKeys,
  prepare: (read: TransactionReader) => Promise<TransactionWork>
): Promise<MutationReceipt> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    const tx = await redis.watch(
      keys.meta,
      keys.counters,
      keys.contributors,
      keys.events,
      keys.achievements,
      keys.recent
    );
    try {
      const work = await prepare(transactionReader(redis, keys));
      if (!work.plan.storeReceipt) {
        await tx.discard();
        return work.plan.receipt;
      }
      await tx.multi();
      await work.queue(tx);
      await expireBoardKeys(tx, keys);
      const result = await tx.exec();
      if (result.length > 0) return work.plan.receipt;
      lastError = new Error('Board transaction conflicted.');
    } catch (error) {
      lastError = error;
      await tx.discard().catch(() => {});
    }
  }
  throw lastError ?? new Error('Board transaction failed.');
}

type TransactionReader = {
  number: (key: string, field: string, fallback?: number) => Promise<number>;
  receipt: (eventId: string) => Promise<MutationReceipt | null>;
};

function transactionReader(
  redis: BoardStoreRedis,
  keys: BoardKeys
): TransactionReader {
  return {
    number: async (key, field, fallback) =>
      safeNumber(await redis.hGet(key, field), fallback),
    receipt: async (eventId) =>
      parseMutationReceipt(await redis.hGet(keys.events, eventId)),
  };
}

async function queueReceipt(
  tx: TxClient,
  keys: BoardKeys,
  plan: MutationPlan
): Promise<void> {
  if (!plan.storeReceipt) return;
  await tx.hSet(keys.events, {
    [plan.receipt.eventId]: JSON.stringify(plan.receipt),
  });
}

async function queueMutationBeat(
  tx: TxClient,
  keys: BoardKeys,
  receipt: MutationReceipt
): Promise<void> {
  const beat = mutationBeatForReceipt(receipt);
  if (!beat) return;
  await tx.zAdd(keys.recent, {
    member: JSON.stringify(beat),
    score: beat.revision,
  });
  await tx.zRemRangeByRank(keys.recent, 0, -21);
}

async function queueHighestClimber(
  tx: TxClient,
  keys: BoardKeys,
  username: string,
  zoneId: ZoneId,
  highestY: number,
  currentHighestY: number
): Promise<void> {
  if (highestY >= currentHighestY) return;
  await tx.hSet(keys.achievements, {
    highestClimberUsername: username,
    highestClimberZone: zoneId,
    highestClimberY: String(Math.max(260, highestY)),
  });
}

async function queueBestStabilizer(
  tx: TxClient,
  keys: BoardKeys,
  username: string,
  clears: number,
  currentBest: number
): Promise<void> {
  if (clears <= currentBest) return;
  await tx.hSet(keys.achievements, {
    bestStabilizerUsername: username,
    bestStabilizerClears: String(clears),
  });
}

async function expireBoardKeys(tx: TxClient, keys: BoardKeys): Promise<void> {
  for (const key of Object.values(keys)) {
    await tx.expire(key, DAILY_KEY_TTL_SECONDS);
  }
}

function boardKeys(board: BoardIdentity) {
  const prefix = `fallstack:board:${board.boardId}`;
  return {
    meta: `${prefix}:meta`,
    counters: `${prefix}:counters`,
    contributors: `${prefix}:contributors`,
    events: `${prefix}:events`,
    achievements: `${prefix}:achievements`,
    recent: `${prefix}:recent-mutations`,
    progress: `${prefix}:player-progress`,
  };
}

function siteCounterField(
  siteId: string,
  counter: keyof SiteMutationCounters
): string {
  return `${siteId}|${counter}`;
}

function parseCounterField(
  field: string
): { siteId: string; counter: keyof SiteMutationCounters } | null {
  const separator = field.lastIndexOf('|');
  if (separator < 1) return null;
  const siteId = field.slice(0, separator);
  const counter = field.slice(separator + 1);
  return Object.hasOwn(ZERO_COUNTERS, counter)
    ? { siteId, counter: counter as keyof SiteMutationCounters }
    : null;
}

function parseAchievements(fields: Record<string, string>): AchievementState {
  const initial = createInitialAchievements();
  const highestClimberZone = fields.highestClimberZone as ZoneId | undefined;
  return {
    firstSummitUsername: fields.firstSummitUsername ?? null,
    firstSummitAt: optionalNumber(fields.firstSummitAt),
    highestClimberUsername: fields.highestClimberUsername ?? null,
    highestClimberZone:
      highestClimberZone && createSeededCounters()[highestClimberZone]
        ? highestClimberZone
        : initial.highestClimberZone,
    highestClimberY: safeNumber(
      fields.highestClimberY,
      initial.highestClimberY
    ),
    bestStabilizerUsername: fields.bestStabilizerUsername ?? null,
    bestStabilizerClears: safeNumber(fields.bestStabilizerClears),
  };
}

function parseMutationReceipt(
  value: string | undefined
): MutationReceipt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<MutationReceipt>;
    return typeof parsed.eventId === 'string' && typeof parsed.copy === 'string'
      ? (parsed as MutationReceipt)
      : null;
  } catch {
    return null;
  }
}

function parseMutationBeat(value: string): MutationBeat | null {
  try {
    const parsed = JSON.parse(value) as Partial<MutationBeat>;
    return typeof parsed.revision === 'number' &&
      typeof parsed.siteId === 'string' &&
      typeof parsed.copy === 'string'
      ? (parsed as MutationBeat)
      : null;
  } catch {
    return null;
  }
}

function contributorToken(context: BoardStoreContext): string {
  return encodeURIComponent(context.userId ?? context.loid ?? 'anonymous');
}

function safeNumber(value: string | undefined, fallback = 0): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function optionalNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
