import assert from 'node:assert/strict';
import test from 'node:test';
import { boardSnapshotFor, createBoardStore } from './board-store.js';
import { createApi } from './routes/api.js';
import { BOTTOM_ZONE_ID, ZONE_IDS } from '../shared/game/mutation.js';
import { zoneById } from '../shared/game/tower.js';

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
    context: { postId: 't3_fallstack', username: 'alice' },
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
  });
  assert.deepEqual(redis.readCounts(), {
    hGet: 1,
    hGetAll: 0,
    zRange: 0,
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
    .slice(0, 7);
  assert.equal(emptyCounters.length, 7);
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

  assert.equal(visibleRevisions.length, 21);
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
  const currentDate = new Date('2026-07-13T12:00:00.000Z');
  const store = createBoardStore({
    redis,
    context: contextFor('alice'),
    now: () => currentDate,
  });
  const initial = await store.loadBoardState();
  const api = createApi({
    context: { postId: 't3_fallstack', username: 'alice' },
    reddit: { getCurrentUsername: async () => 'alice' },
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

  const initResponse = await api.request('/init-game');
  const initBody = (await initResponse.json()) as {
    resume?: { zoneId: string; mode: string };
  };
  assert.equal(initResponse.status, 200);
  assert.deepEqual(initBody.resume, body.resume);
});

function contextFor(userId: string) {
  return {
    subredditId: 'fallstack_dev',
    subredditName: 'fallstack_dev',
    userId,
  };
}

type SortedMember = { member: string; score: number };

class InMemoryRedis {
  readonly #hashes = new Map<string, Map<string, string>>();
  readonly #sortedSets = new Map<string, Map<string, number>>();
  readonly #versions = new Map<string, number>();
  readonly #expiresAt = new Map<string, number>();
  #forcedConflicts = 0;
  #now = 0;
  #hGetReads = 0;
  #hGetAllReads = 0;
  #zRangeReads = 0;

  async watch(...keys: string[]): Promise<InMemoryTransaction> {
    return new InMemoryTransaction(
      this,
      new Map(keys.map((key) => [key, this.version(key)]))
    );
  }

  async hGet(key: string, field: string): Promise<string | undefined> {
    this.#hGetReads += 1;
    this.purgeExpired(key);
    return this.#hashes.get(key)?.get(field);
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    this.#hGetAllReads += 1;
    this.purgeExpired(key);
    return Object.fromEntries(this.#hashes.get(key) ?? []);
  }

  async zRange(
    key: string,
    start: number | string,
    stop: number | string
  ): Promise<SortedMember[]> {
    this.#zRangeReads += 1;
    this.purgeExpired(key);
    const members = this.sortedMembers(key);
    const [first, last] = rankRange(members.length, start, stop);
    return first > last ? [] : members.slice(first, last + 1);
  }

  version(key: string): number {
    return this.#versions.get(key) ?? 0;
  }

  forceConflicts(count: number): void {
    this.#forcedConflicts = count;
  }

  takeForcedConflict(): boolean {
    if (this.#forcedConflicts <= 0) return false;
    this.#forcedConflicts -= 1;
    return true;
  }

  advanceTime(milliseconds: number): void {
    this.#now += milliseconds;
  }

  resetReadCounts(): void {
    this.#hGetReads = 0;
    this.#hGetAllReads = 0;
    this.#zRangeReads = 0;
  }

  readCounts(): { hGet: number; hGetAll: number; zRange: number } {
    return {
      hGet: this.#hGetReads,
      hGetAll: this.#hGetAllReads,
      zRange: this.#zRangeReads,
    };
  }

  hSet(key: string, values: Record<string, string>): number {
    const hash = this.hash(key);
    for (const [field, value] of Object.entries(values)) hash.set(field, value);
    this.bump(key);
    return Object.keys(values).length;
  }

  hIncrBy(key: string, field: string, amount: number): number {
    const hash = this.hash(key);
    const next = Number(hash.get(field) ?? 0) + amount;
    hash.set(field, String(next));
    this.bump(key);
    return next;
  }

  zAdd(key: string, members: SortedMember[]): number {
    const set = this.sortedSet(key);
    for (const member of members) set.set(member.member, member.score);
    this.bump(key);
    return members.length;
  }

  zRemRangeByRank(key: string, start: number, stop: number): number {
    const members = this.sortedMembers(key);
    const [first, last] = rankRange(members.length, start, stop);
    if (first > last) return 0;
    const set = this.sortedSet(key);
    for (const item of members.slice(first, last + 1)) set.delete(item.member);
    this.bump(key);
    return last - first + 1;
  }

  expire(key: string, seconds: number): number {
    this.#expiresAt.set(key, this.#now + seconds * 1000);
    return 1;
  }

  private hash(key: string): Map<string, string> {
    let hash = this.#hashes.get(key);
    if (!hash) {
      hash = new Map();
      this.#hashes.set(key, hash);
    }
    return hash;
  }

  private sortedSet(key: string): Map<string, number> {
    let set = this.#sortedSets.get(key);
    if (!set) {
      set = new Map();
      this.#sortedSets.set(key, set);
    }
    return set;
  }

  private sortedMembers(key: string): SortedMember[] {
    return [...(this.#sortedSets.get(key) ?? [])]
      .map(([member, score]) => ({ member, score }))
      .sort(
        (left, right) =>
          left.score - right.score || left.member.localeCompare(right.member)
      );
  }

  private bump(key: string): void {
    this.#versions.set(key, this.version(key) + 1);
  }

  private purgeExpired(key: string): void {
    const expiresAt = this.#expiresAt.get(key);
    if (expiresAt === undefined || expiresAt > this.#now) return;
    this.#hashes.delete(key);
    this.#sortedSets.delete(key);
    this.#expiresAt.delete(key);
    this.bump(key);
  }
}

class InMemoryTransaction {
  readonly #commands: Array<() => unknown> = [];
  #discarded = false;

  constructor(
    private readonly redis: InMemoryRedis,
    private readonly watched: Map<string, number>
  ) {}

  async multi(): Promise<void> {}

  async discard(): Promise<void> {
    this.#discarded = true;
    this.#commands.length = 0;
  }

  async hSet(
    key: string,
    values: Record<string, string>
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.hSet(key, values));
    return this;
  }

  async hIncrBy(
    key: string,
    field: string,
    amount: number
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.hIncrBy(key, field, amount));
    return this;
  }

  async zAdd(
    key: string,
    ...members: SortedMember[]
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.zAdd(key, members));
    return this;
  }

  async zRemRangeByRank(
    key: string,
    start: number,
    stop: number
  ): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.zRemRangeByRank(key, start, stop));
    return this;
  }

  async expire(key: string, seconds: number): Promise<InMemoryTransaction> {
    this.#commands.push(() => this.redis.expire(key, seconds));
    return this;
  }

  async exec(): Promise<unknown[]> {
    if (this.#discarded) return [];
    if (this.redis.takeForcedConflict()) return [];
    if (
      [...this.watched].some(
        ([key, version]) => this.redis.version(key) !== version
      )
    )
      return [];
    return this.#commands.map((command) => command());
  }
}

function rankRange(
  length: number,
  start: number | string,
  stop: number | string
): [number, number] {
  const first = normalizedRank(length, Number(start));
  const last = normalizedRank(length, Number(stop));
  return [Math.max(0, first), Math.min(length - 1, last)];
}

function normalizedRank(length: number, rank: number): number {
  return rank < 0 ? length + rank : rank;
}
