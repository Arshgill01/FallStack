import assert from 'node:assert/strict';
import test from 'node:test';
import {
  boardSnapshotFor,
  createBoardStore,
  PRESENCE_WINDOW_MS,
} from './board-store.js';
import { createApi } from './routes/api.js';
import { InMemoryRedis } from './testing/in-memory-redis.js';
import {
  echoKeyForEvent,
  type BoardRevisionMessage,
} from '../shared/realtime.js';
import { BOTTOM_ZONE_ID, ZONE_IDS } from '../shared/game/mutation.js';
import { zoneById } from '../shared/game/tower.js';
import {
  resolveClearRescuers,
  resolveClearSite,
} from '../shared/game/mutation-events.js';

void test('concurrent climbers at one site preserve both mutations and ordered revisions', async () => {
  const redis = new InMemoryRedis();
  const now = () => new Date('2026-07-13T12:00:00.000Z');
  const alice = createBoardStore({
    redis,
    context: contextFor('alice'),
    now,
  });
  const bob = createBoardStore({
    redis,
    context: contextFor('bob'),
    now,
  });
  const initial = await alice.loadBoardState();
  const site = boardSnapshotFor(initial).sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);

  const [aliceReceipt, bobReceipt] = await Promise.all([
    alice.recordFallMutation({
      state: initial,
      eventId: 'fall-alice',
      fall: {
        zoneId: site.zoneId,
        siteId: site.id,
        siteName: site.name,
        bucket: 'short_jump',
      },
      highestY: 6100,
      username: 'u/alice',
    }),
    bob.recordFallMutation({
      state: initial,
      eventId: 'fall-bob',
      fall: {
        zoneId: site.zoneId,
        siteId: site.id,
        siteName: site.name,
        bucket: 'short_jump',
      },
      highestY: 6000,
      username: 'u/bob',
    }),
  ]);

  assert.equal(aliceReceipt.accepted, true);
  assert.equal(bobReceipt.accepted, true);
  assert.equal(
    [aliceReceipt.visibleChange, bobReceipt.visibleChange].includes(
      'artifact_upgraded'
    ),
    true
  );
  assert.deepEqual(
    [aliceReceipt.revisionAfter, bobReceipt.revisionAfter].sort(
      (left, right) => left - right
    ),
    [initial.revision + 1, initial.revision + 2]
  );
  assert.deepEqual(
    [aliceReceipt.counterBefore, bobReceipt.counterBefore].sort(
      (left, right) => (left ?? 0) - (right ?? 0)
    ),
    [site.counters.short_jump, site.counters.short_jump + 1]
  );

  const updated = boardSnapshotFor(await alice.loadBoardState());
  const updatedSite = updated.sites.find(
    (candidate) => candidate.id === site.id
  );
  assert.equal(updated.revision, initial.revision + 2);
  assert.equal(updated.totalFalls, initial.totalFalls + 2);
  assert.equal(updatedSite?.counters.short_jump, site.counters.short_jump + 2);
});

void test('one event submitted by 100 duplicate tabs mutates the board once', async () => {
  const redis = new InMemoryRedis();
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => new Date('2026-07-13T12:00:00.000Z'),
  });
  const initial = await store.loadBoardState();
  const site = boardSnapshotFor(initial).sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);

  const receipts = await Promise.all(
    Array.from({ length: 100 }, () =>
      store.recordFallMutation({
        state: initial,
        eventId: 'same-fall-from-many-tabs',
        fall: {
          zoneId: site.zoneId,
          siteId: site.id,
          siteName: site.name,
          bucket: 'short_jump',
        },
        highestY: 6100,
        username: 'u/alice',
      })
    )
  );

  for (const receipt of receipts) assert.deepEqual(receipt, receipts[0]);
  assert.equal(receipts[0]?.accepted, true);

  const updated = boardSnapshotFor(await store.loadBoardState());
  const updatedSite = updated.sites.find(
    (candidate) => candidate.id === site.id
  );
  assert.equal(updated.revision, initial.revision + 1);
  assert.equal(updated.totalFalls, initial.totalFalls + 1);
  assert.equal(updatedSite?.counters.short_jump, site.counters.short_jump + 1);
});

void test('a same-user cap race accepts only the third site contribution', async () => {
  const redis = new InMemoryRedis();
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => new Date('2026-07-13T12:00:00.000Z'),
  });
  const initial = await store.loadBoardState();
  const site = boardSnapshotFor(initial).sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);
  const inputFor = (eventId: string) => ({
    state: initial,
    eventId,
    fall: {
      zoneId: site.zoneId,
      siteId: site.id,
      siteName: site.name,
      bucket: 'short_jump' as const,
    },
    highestY: 6100,
    username: 'u/alice',
  });

  assert.equal(
    (await store.recordFallMutation(inputFor('fall-one'))).accepted,
    true
  );
  assert.equal(
    (await store.recordFallMutation(inputFor('fall-two'))).accepted,
    true
  );
  const raced = await Promise.all([
    store.recordFallMutation(inputFor('fall-three')),
    store.recordFallMutation(inputFor('fall-four')),
  ]);

  assert.equal(raced.filter((receipt) => receipt.accepted).length, 1);
  assert.equal(
    raced.filter((receipt) => receipt.rejection === 'capped').length,
    1
  );
  const updated = boardSnapshotFor(await store.loadBoardState());
  const updatedSite = updated.sites.find(
    (candidate) => candidate.id === site.id
  );
  assert.equal(updated.revision, initial.revision + 3);
  assert.equal(updated.totalFalls, initial.totalFalls + 3);
  assert.equal(updatedSite?.counters.short_jump, site.counters.short_jump + 3);
});

void test('concurrent summits preserve the first winner and best height', async () => {
  const redis = new InMemoryRedis();
  const now = () => new Date('2026-07-13T12:00:00.000Z');
  const alice = createBoardStore({
    redis,
    context: contextFor('alice'),
    now,
  });
  const bob = createBoardStore({
    redis,
    context: contextFor('bob'),
    now,
  });
  const initial = await alice.loadBoardState();

  const receipts = await Promise.all([
    alice.recordSummitMutation({
      state: initial,
      eventId: 'summit-alice',
      highestY: 900,
      username: 'u/alice',
    }),
    bob.recordSummitMutation({
      state: initial,
      eventId: 'summit-bob',
      highestY: 700,
      username: 'u/bob',
    }),
  ]);

  assert.equal(
    receipts.every((receipt) => receipt.accepted),
    true
  );
  assert.deepEqual(
    receipts
      .map((receipt) => receipt.revisionAfter)
      .sort((left, right) => left - right),
    [initial.revision + 1, initial.revision + 2]
  );
  const updated = await alice.loadBoardState();
  assert.equal(updated.achievements.firstSummitUsername, 'u/alice');
  assert.equal(updated.achievements.firstSummitAt, now().getTime());
  assert.equal(updated.achievements.highestClimberUsername, 'u/bob');
  assert.equal(updated.achievements.highestClimberY, 700);
  assert.equal(updated.totalSummits, 2);
});

void test('a weaker concurrent clear cannot replace the best stabilizer', async () => {
  const redis = new InMemoryRedis();
  const now = () => new Date('2026-07-13T12:00:00.000Z');
  const alice = createBoardStore({
    redis,
    context: contextFor('alice'),
    now,
  });
  const bob = createBoardStore({
    redis,
    context: contextFor('bob'),
    now,
  });
  const initial = await alice.loadBoardState();
  const site = boardSnapshotFor(initial).sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);
  const clearInput = (eventId: string, username: string) => ({
    state: initial,
    eventId,
    zoneId: site.zoneId,
    siteId: site.id,
    siteName: site.name,
    highestY: 6000,
    username,
  });

  await alice.recordClearMutation(clearInput('alice-clear-one', 'u/alice'));
  await alice.recordClearMutation(clearInput('alice-clear-two', 'u/alice'));
  const raced = await Promise.all([
    alice.recordClearMutation(clearInput('alice-clear-three', 'u/alice')),
    bob.recordClearMutation(clearInput('bob-clear-one', 'u/bob')),
  ]);

  assert.equal(
    raced.every((receipt) => receipt.accepted),
    true
  );
  const updated = await alice.loadBoardState();
  assert.equal(updated.achievements.bestStabilizerUsername, 'u/alice');
  assert.equal(updated.achievements.bestStabilizerClears, 3);
  assert.equal(updated.totalClears, initial.totalClears + 4);
  assert.equal(updated.revision, initial.revision + 4);
});

void test('exhausted conflicts leave no seen event or partial mutation', async () => {
  const redis = new InMemoryRedis();
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => new Date('2026-07-13T12:00:00.000Z'),
  });
  const initial = await store.loadBoardState();
  const site = boardSnapshotFor(initial).sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);
  const input = {
    state: initial,
    eventId: 'fall-after-conflict-storm',
    fall: {
      zoneId: site.zoneId,
      siteId: site.id,
      siteName: site.name,
      bucket: 'short_jump' as const,
    },
    highestY: 6100,
    username: 'u/alice',
  };

  redis.forceConflicts(3);
  await assert.rejects(
    store.recordFallMutation(input),
    /Board transaction conflicted/
  );
  assert.equal((await store.loadBoardState()).revision, initial.revision);

  const retried = await store.recordFallMutation(input);
  assert.equal(retried.accepted, true);
  assert.equal(retried.revisionAfter, initial.revision + 1);
  assert.equal((await store.loadBoardState()).revision, initial.revision + 1);
});

void test('a previous-day event receives a stale receipt and writes to neither board', async () => {
  const redis = new InMemoryRedis();
  let currentDate = new Date('2026-07-13T12:00:00.000Z');
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => currentDate,
  });
  const previous = await store.loadBoardState();
  const previousSnapshot = boardSnapshotFor(previous);
  const site = previousSnapshot.sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);
  const zone = zoneById(site.zoneId);

  currentDate = new Date('2026-07-14T00:00:01.000Z');
  const current = await store.loadBoardState();
  const api = createApi({
    context: {
      postId: 't3_fallstack',
      subredditName: 'fallstack_dev',
      username: 'alice',
    },
    reddit: { getCurrentUsername: async () => 'alice' },
    boardStore: store,
    now: () => currentDate.getTime(),
  });
  const response = await api.request('/record-fall', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      eventId: 'previous-day-fall',
      boardId: previous.board.boardId,
      boardRevision: previous.revision,
      attemptId: 'previous-attempt',
      respawnZoneId: site.zoneId,
      fallX: 240,
      fallY: zone.yBottom + 40,
      highestY: zone.yBottom - 580,
      lastPlatformId: 'start',
      lastHelperArtifactId: null,
      wallBonkPlatformId: null,
      launchChargePercent: 74,
      launchDirection: -1,
      timestamp: currentDate.getTime(),
    }),
  });
  const body = (await response.json()) as {
    receipt?: { rejection: string | null; boardId: string };
  };

  assert.equal(response.status, 409);
  assert.equal(body.receipt?.rejection, 'stale');
  assert.equal(body.receipt?.boardId, current.board.boardId);
  assert.equal((await store.loadBoardState()).revision, current.revision);
  currentDate = new Date('2026-07-13T12:00:00.000Z');
  assert.equal((await store.loadBoardState()).revision, previous.revision);
});

void test('the revision endpoint reads only current board metadata', async () => {
  const redis = new InMemoryRedis();
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => new Date('2026-07-14T12:00:00.000Z'),
  });
  const initial = await store.loadBoardState();
  redis.resetReadCounts();
  const api = createApi({
    context: { postId: 't3_fallstack', username: 'alice' },
    reddit: { getCurrentUsername: async () => 'alice' },
    boardStore: store,
    now: () => Date.parse('2026-07-14T12:00:00.000Z'),
  });

  const response = await api.request('/board-revision');
  const body = (await response.json()) as {
    type?: string;
    boardId?: string;
    revision?: number;
  };

  assert.equal(response.status, 200);
  assert.deepEqual(body, {
    type: 'boardRevision',
    boardId: initial.board.boardId,
    revision: initial.revision,
    recentClimbers: 0,
  });
  // The 15s poll stays O(1): revision plus the presence count, never the board.
  assert.deepEqual(redis.readCounts(), {
    hGet: 1,
    hGetAll: 0,
    zRange: 0,
    zCard: 1,
  });
});

void test('one user can change at most ten failure sites across the daily board', async () => {
  const redis = new InMemoryRedis();
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => new Date('2026-07-13T12:00:00.000Z'),
  });
  const initial = await store.loadBoardState();
  const sites = boardSnapshotFor(initial).sites.slice(0, 11);
  assert.equal(sites.length, 11);

  const receipts = [];
  for (const [index, site] of sites.entries()) {
    receipts.push(
      await store.recordFallMutation({
        state: initial,
        eventId: `daily-fall-${index}`,
        fall: {
          zoneId: site.zoneId,
          siteId: site.id,
          siteName: site.name,
          bucket: 'short_jump',
        },
        highestY: 6100,
        username: 'u/alice',
      })
    );
  }

  assert.equal(
    receipts.slice(0, 10).every((receipt) => receipt.accepted),
    true
  );
  assert.equal(receipts[10]?.rejection, 'capped');
  const updated = await store.loadBoardState();
  assert.equal(updated.revision, initial.revision + 10);
  assert.equal(updated.totalFalls, initial.totalFalls + 10);
});

void test('requests without a user or loid share one fail-closed contribution cap', async () => {
  const redis = new InMemoryRedis();
  const dependencies = {
    redis,
    context: {
      subredditId: 'fallstack_dev',
      subredditName: 'fallstack_dev',
    },
    now: () => new Date('2026-07-13T12:00:00.000Z'),
  };
  const firstAnonymous = createBoardStore(dependencies);
  const secondAnonymous = createBoardStore(dependencies);
  const initial = await firstAnonymous.loadBoardState();
  const site = boardSnapshotFor(initial).sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);
  const inputFor = (eventId: string) => ({
    state: initial,
    eventId,
    fall: {
      zoneId: site.zoneId,
      siteId: site.id,
      siteName: site.name,
      bucket: 'short_jump' as const,
    },
    highestY: 6100,
    username: 'a quiet climber',
  });

  const receipts = [
    await firstAnonymous.recordFallMutation(inputFor('anonymous-fall-one')),
    await secondAnonymous.recordFallMutation(inputFor('anonymous-fall-two')),
    await firstAnonymous.recordFallMutation(inputFor('anonymous-fall-three')),
    await secondAnonymous.recordFallMutation(inputFor('anonymous-fall-four')),
  ];

  assert.equal(
    receipts.slice(0, 3).every((receipt) => receipt.accepted),
    true
  );
  assert.equal(receipts[3]?.rejection, 'capped');
  assert.equal(
    (await firstAnonymous.loadBoardState()).revision,
    initial.revision + 3
  );
});

void test('high traffic retains only the newest twenty visible mutation beats', async () => {
  const redis = new InMemoryRedis();
  const now = () => new Date('2026-07-13T12:00:00.000Z');
  const reader = createBoardStore({
    redis,
    context: contextFor('reader'),
    now,
  });
  const initial = await reader.loadBoardState();
  const buckets = [
    'short_jump',
    'overjump',
    'wall_bonk',
    'helper_overuse',
  ] as const;
  const emptyCounters = boardSnapshotFor(initial)
    .sites.flatMap((site) =>
      buckets.map((bucket) => ({
        site,
        bucket,
        count: site.counters[bucket],
      }))
    )
    .filter((candidate) => candidate.count === 0)
    .slice(0, 10);
  assert.equal(emptyCounters.length, 10);
  const visibleRevisions: number[] = [];

  for (const [siteIndex, candidate] of emptyCounters.entries()) {
    for (let contribution = 1; contribution <= 10; contribution += 1) {
      const userId = `traffic-${siteIndex}-${contribution}`;
      const writer = createBoardStore({
        redis,
        context: contextFor(userId),
        now,
      });
      const receipt = await writer.recordFallMutation({
        state: initial,
        eventId: `traffic-fall-${siteIndex}-${contribution}`,
        fall: {
          zoneId: candidate.site.zoneId,
          siteId: candidate.site.id,
          siteName: candidate.site.name,
          bucket: candidate.bucket,
        },
        highestY: 6100,
        username: `u/${userId}`,
      });
      if (
        receipt.visibleChange !== 'mark_added' &&
        receipt.visibleChange !== 'none'
      )
        visibleRevisions.push(receipt.revisionAfter);
    }
  }

  assert.ok(visibleRevisions.length > 20, `${visibleRevisions.length} visible beats`);
  const updated = await reader.loadBoardState();
  assert.equal(updated.recentMutations.length, 20);
  assert.deepEqual(
    updated.recentMutations.map((beat) => beat.revision),
    visibleRevisions.slice(-20)
  );
});

void test('daily board data expires after the seventy-two hour retention window', async () => {
  const redis = new InMemoryRedis();
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => new Date('2026-07-13T12:00:00.000Z'),
  });
  const initial = await store.loadBoardState();
  const site = boardSnapshotFor(initial).sites.find(
    (candidate) => candidate.name === 'First Gap'
  );
  assert.ok(site);
  await store.recordFallMutation({
    state: initial,
    eventId: 'fall-before-expiry',
    fall: {
      zoneId: site.zoneId,
      siteId: site.id,
      siteName: site.name,
      bucket: 'short_jump',
    },
    highestY: 6100,
    username: 'u/alice',
  });
  assert.equal((await store.loadBoardState()).revision, initial.revision + 1);

  redis.advanceTime(72 * 60 * 60 * 1000 + 1);
  assert.equal((await store.loadBoardState()).revision, initial.revision);
});

void test('authenticated checkpoints resume per player and never move backward', async () => {
  const redis = new InMemoryRedis();
  const now = () => new Date('2026-07-13T12:00:00.000Z');
  const alice = createBoardStore({ redis, context: contextFor('alice'), now });
  const bob = createBoardStore({ redis, context: contextFor('bob'), now });

  assert.deepEqual(await alice.loadPlayerResume(), {
    zoneId: BOTTOM_ZONE_ID,
    mode: 'account',
  });
  assert.deepEqual(await alice.advancePlayerCheckpoint(ZONE_IDS[0]), {
    zoneId: ZONE_IDS[1],
    mode: 'account',
  });
  assert.deepEqual(await alice.advancePlayerCheckpoint(ZONE_IDS[2]), {
    zoneId: ZONE_IDS[3],
    mode: 'account',
  });
  assert.deepEqual(await alice.advancePlayerCheckpoint(ZONE_IDS[1]), {
    zoneId: ZONE_IDS[3],
    mode: 'account',
  });
  assert.equal((await bob.loadPlayerResume()).zoneId, BOTTOM_ZONE_ID);

  const reloaded = createBoardStore({
    redis,
    context: contextFor('alice'),
    now,
  });
  assert.equal((await reloaded.loadPlayerResume()).zoneId, ZONE_IDS[3]);
});

void test('checkpoint resume resets on UTC rollover and stays session-only anonymously', async () => {
  const redis = new InMemoryRedis();
  let currentDate = new Date('2026-07-13T23:59:59.000Z');
  const authenticated = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => currentDate,
  });
  await authenticated.advancePlayerCheckpoint(ZONE_IDS[0]);
  assert.equal(
    (await authenticated.loadPlayerResume()).zoneId,
    ZONE_IDS[1]
  );

  currentDate = new Date('2026-07-14T00:00:01.000Z');
  assert.equal(
    (await authenticated.loadPlayerResume()).zoneId,
    BOTTOM_ZONE_ID
  );

  const anonymous = createBoardStore({
    redis,
    context: {
      subredditId: 'fallstack_dev',
      subredditName: 'fallstack_dev',
      loid: 'loid-one',
    },
    now: () => currentDate,
  });
  assert.deepEqual(await anonymous.advancePlayerCheckpoint(ZONE_IDS[0]), {
    zoneId: ZONE_IDS[1],
    mode: 'session',
  });
  assert.deepEqual(await anonymous.loadPlayerResume(), {
    zoneId: BOTTOM_ZONE_ID,
    mode: 'session',
  });
});

void test('the clear API derives and returns the authenticated resume checkpoint', async () => {
  const redis = new InMemoryRedis();
  const realtimeMessages: Array<{
    channel: string;
    message: BoardRevisionMessage;
  }> = [];
  const currentDate = new Date('2026-07-13T12:00:00.000Z');
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => currentDate,
  });
  const initial = await store.loadBoardState();
  const api = createApi({
    context: {
      postId: 't3_fallstack',
      subredditName: 'fallstack_dev',
      username: 'alice',
    },
    reddit: { getCurrentUsername: async () => 'alice' },
    realtime: {
      send: async (channel, message) => {
        realtimeMessages.push({ channel, message });
      },
    },
    boardStore: store,
    now: () => currentDate.getTime(),
  });

  const response = await api.request('/record-clear', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      eventId: 'clear-first-zone',
      boardId: initial.board.boardId,
      boardRevision: initial.revision,
      attemptId: 'attempt-first-zone',
      zoneId: ZONE_IDS[0],
      highestY: zoneById(ZONE_IDS[0]).yTop,
      timestamp: currentDate.getTime(),
    }),
  });
  const body = (await response.json()) as {
    resume?: { zoneId: string; mode: string };
  };

  assert.equal(response.status, 200);
  assert.deepEqual(body.resume, {
    zoneId: ZONE_IDS[1],
    mode: 'account',
  });
  assert.deepEqual(realtimeMessages, [
    {
      channel: 'fallstack_community_fallstack_dev_2026_07_13_v1',
      message: {
        type: 'board-revision',
        boardId: initial.board.boardId,
        revision: initial.revision + 1,
        // Clears are positive, so the echo may name the climber.
        echo: {
          kind: 'clear',
          key: echoKeyForEvent('clear-first-zone'),
          zoneId: ZONE_IDS[0],
          siteId: realtimeMessages[0]?.message.echo?.siteId,
          bucket: 'successful_clear',
          count: 3,
          visibleChange: 'site_reinforced',
          climber: 'u/alice',
        },
      },
    },
  ]);

  const initResponse = await api.request('/init-game');
  const initBody = (await initResponse.json()) as {
    postUrl?: string | null;
    supportUrl?: string | null;
    resume?: { zoneId: string; mode: string };
  };
  assert.equal(initResponse.status, 200);
  assert.equal(
    initBody.postUrl,
    'https://www.reddit.com/r/fallstack_dev/comments/fallstack'
  );
  assert.equal(
    initBody.supportUrl,
    'https://www.reddit.com/message/compose?to=/r/fallstack_dev'
  );
  assert.deepEqual(initBody.resume, body.resume);
});

function contextFor(userId: string) {
  return {
    subredditId: 'fallstack_dev',
    subredditName: 'fallstack_dev',
    userId,
  };
}

void test('clears thank community rescuers once per climber, across replays', async () => {
  const redis = new InMemoryRedis();
  const now = () => new Date('2026-07-13T12:00:00.000Z');
  const alice = createBoardStore({ redis, context: contextFor('alice'), now });
  const bob = createBoardStore({ redis, context: contextFor('bob'), now });
  const initial = await alice.loadBoardState();
  const snapshot = boardSnapshotFor(initial);
  const corpse = snapshot.zones[0]!.artifacts.find(
    (artifact) => artifact.type === 'corpse_stack'
  )!;
  const rescuers = resolveClearRescuers(snapshot, ZONE_IDS[0], [
    corpse.id,
    'impact-v1:forged-short_jump',
  ]);
  assert.deepEqual(
    rescuers.map((rescuer) => rescuer.id),
    [corpse.id]
  );
  const clear = (store: typeof alice, eventId: string) =>
    store.loadBoardState().then((state) => {
      const site = resolveClearSite(boardSnapshotFor(state), ZONE_IDS[0])!;
      return store.recordClearMutation({
        state,
        eventId,
        zoneId: ZONE_IDS[0],
        ...site,
        highestY: zoneById(ZONE_IDS[0]).yTop,
        username: 'u/climber',
        rescuers,
      });
    });

  const first = await clear(alice, 'clear-alice-1');
  assert.deepEqual(first.saves?.map((save) => save.savesAfter), [1]);
  const again = await clear(alice, 'clear-alice-2');
  assert.deepEqual(again.saves, [], 'alice already thanked it today');
  const replay = await clear(alice, 'clear-alice-1');
  assert.deepEqual(replay, first, 'a replay returns the stored receipt');
  const fromBob = await clear(bob, 'clear-bob-1');
  assert.deepEqual(fromBob.saves?.map((save) => save.savesAfter), [2]);

  const board = boardSnapshotFor(await alice.loadBoardState());
  const rendered = board.zones[0]!.artifacts.find(
    (artifact) => artifact.id === corpse.id
  );
  assert.deepEqual(board.saves, { [corpse.id]: 2 });
  assert.equal(rendered?.saves, 2);
  assert.match(rendered?.label ?? '', /caught 2\.$/);
});

void test('each climber gets back only their own marks on the tower', async () => {
  const redis = new InMemoryRedis();
  const now = () => new Date('2026-07-13T12:00:00.000Z');
  const alice = createBoardStore({ redis, context: contextFor('alice'), now });
  const bob = createBoardStore({ redis, context: contextFor('bob'), now });
  const nobody = createBoardStore({
    redis,
    context: { subredditId: 'fallstack_dev', subredditName: 'fallstack_dev' },
    now,
  });
  const state = await alice.loadBoardState();
  const site = boardSnapshotFor(state).sites[0]!;
  for (const eventId of ['fall-a-1', 'fall-a-2'])
    await alice.recordFallMutation({
      state: await alice.loadBoardState(),
      eventId,
      fall: { zoneId: site.zoneId, siteId: site.id, siteName: site.name, bucket: 'wall_bonk' },
      highestY: 6000,
      username: 'u/alice',
    });
  const clearSite = resolveClearSite(boardSnapshotFor(state), ZONE_IDS[0])!;
  await alice.recordClearMutation({
    state: await alice.loadBoardState(),
    eventId: 'clear-a-1',
    zoneId: ZONE_IDS[0],
    ...clearSite,
    highestY: zoneById(ZONE_IDS[0]).yTop,
    username: 'u/alice',
  });

  assert.deepEqual(await alice.loadPlayerLegacy(), {
    marks: [{ siteId: site.id, bucket: 'wall_bonk', count: 2 }],
    clearedZones: [ZONE_IDS[0]],
  });
  assert.deepEqual(await bob.loadPlayerLegacy(), { marks: [], clearedZones: [] });
  assert.deepEqual(await nobody.loadPlayerLegacy(), { marks: [], clearedZones: [] });
});

void test('presence counts distinct climbers inside a ten-minute window', async () => {
  const redis = new InMemoryRedis();
  let nowMs = Date.parse('2026-07-13T12:00:00.000Z');
  const now = () => new Date(nowMs);
  const alice = createBoardStore({ redis, context: contextFor('alice'), now });
  const bob = createBoardStore({ redis, context: contextFor('bob'), now });

  await alice.touchPresence();
  await alice.touchPresence();
  await bob.touchPresence();
  assert.equal(await alice.loadRecentClimbers(), 2);

  nowMs += PRESENCE_WINDOW_MS + 1;
  await bob.touchPresence();
  assert.equal(await alice.loadRecentClimbers(), 1, 'alice went quiet');
});
