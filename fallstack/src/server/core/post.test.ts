import assert from 'node:assert/strict';
import test from 'node:test';
import { SEEDED_TOTAL_FALLS } from '../../shared/game/mutation.js';
import { createDailyPostService, postUrl } from './post.js';

void test('concurrent and repeated daily post requests submit only once', async () => {
  const redis = new FakeRedis();
  const submissions: Array<Record<string, unknown>> = [];
  const previousDates: string[] = [];
  const ensure = createDailyPostService({
    context: { subredditId: 't5_fallstack', subredditName: 'fallstack' },
    redis,
    reddit: {
      submitCustomPost: async (input) => {
        submissions.push(input);
        return { id: 't3_daily' };
      },
    },
    loadBoardStateForDate: async (date) => {
      previousDates.push(date.toISOString());
      return {
        dateKey: '2026-07-14',
        totalFalls: SEEDED_TOTAL_FALLS + 4,
        totalClears: 2,
        totalSummits: 1,
      };
    },
    now: () => new Date('2026-07-15T00:05:00.000Z'),
  });

  const raced = await Promise.all([ensure(), ensure()]);
  assert.equal(
    raced.filter((result) => result.status === 'created').length,
    1
  );
  assert.equal(
    raced.filter((result) => result.status === 'pending').length,
    1
  );
  assert.deepEqual(await ensure(), {
    status: 'existing',
    postId: 't3_daily',
  });
  assert.equal(submissions.length, 1);
  assert.deepEqual(previousDates, ['2026-07-14T00:00:00.000Z']);
  assert.match(String(submissions[0]?.title), /2026-07-15/);
  assert.equal(submissions[0]?.entry, 'default');
  assert.deepEqual(submissions[0]?.postData, {
    boardDate: '2026-07-15',
    towerVersion: 1,
    previousDate: '2026-07-14',
  });
  assert.match(
    String((submissions[0]?.textFallback as { text: string }).text),
    /4 community falls, 2 clean clears, and 1 summit/
  );
  assert.match(
    String((submissions[0]?.textFallback as { text: string }).text),
    /Report a problem via r\/fallstack modmail/
  );
});

void test('a failed submission releases its lease and can be retried', async () => {
  const redis = new FakeRedis();
  let submissions = 0;
  const ensure = createDailyPostService({
    context: { subredditId: 't5_fallstack', subredditName: 'fallstack' },
    redis,
    reddit: {
      submitCustomPost: async () => {
        submissions += 1;
        if (submissions === 1) throw new Error('reddit unavailable');
        return { id: 't3_retry' };
      },
    },
    loadBoardStateForDate: quietPreviousDay,
    now: () => new Date('2026-07-15T00:05:00.000Z'),
  });

  await assert.rejects(ensure(), /reddit unavailable/);
  assert.deepEqual(await ensure(), {
    status: 'created',
    postId: 't3_retry',
  });
  assert.equal(submissions, 2);
});

void test('UTC rollover receives a distinct idempotency record', async () => {
  const redis = new FakeRedis();
  let date = new Date('2026-07-15T23:59:59.000Z');
  let submissions = 0;
  const ensure = createDailyPostService({
    context: { subredditId: 't5_fallstack', subredditName: 'fallstack' },
    redis,
    reddit: {
      submitCustomPost: async () => ({ id: `t3_day_${++submissions}` }),
    },
    loadBoardStateForDate: quietPreviousDay,
    now: () => date,
  });

  assert.equal((await ensure()).status, 'created');
  date = new Date('2026-07-16T00:05:00.000Z');
  assert.equal((await ensure()).status, 'created');
  assert.equal(submissions, 2);
});

void test('post URLs use Reddit comment paths without a fullname prefix', () => {
  assert.equal(
    postUrl('fallstack', 't3_abc123'),
    'https://www.reddit.com/r/fallstack/comments/abc123'
  );
});

async function quietPreviousDay(date: Date) {
  return {
    dateKey: date.toISOString().slice(0, 10),
    totalFalls: SEEDED_TOTAL_FALLS,
    totalClears: 0,
    totalSummits: 0,
  };
}

class FakeRedis {
  readonly values = new Map<string, string>();

  async get(key: string): Promise<string | undefined> {
    return this.values.get(key);
  }

  async set(
    key: string,
    value: string,
    options?: { nx?: boolean; expiration?: Date }
  ): Promise<string> {
    if (options?.nx && this.values.has(key)) return '';
    this.values.set(key, value);
    return 'OK';
  }

  async del(...keys: string[]): Promise<void> {
    for (const key of keys) this.values.delete(key);
  }
}
