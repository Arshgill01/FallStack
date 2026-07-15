import {
  context as devvitContext,
  reddit as devvitReddit,
  redis as devvitRedis,
} from '@devvit/web/server';
import { TOWER_VERSION } from '../../shared/game/board.js';
import { deriveDailyMemory } from '../../shared/game/daily-memory.js';
import { loadBoardStateForDate } from '../board-store.js';

const LEASE_MS = 10 * 60 * 1000;
const COMPLETED_RECORD_MS = 8 * 24 * 60 * 60 * 1000;

type DailyPostContext = {
  subredditId: string;
  subredditName: string;
};

type DailyPostRedis = {
  get: (key: string) => Promise<string | undefined>;
  set: (
    key: string,
    value: string,
    options?: { nx?: boolean; expiration?: Date }
  ) => Promise<string>;
  del: (...keys: string[]) => Promise<void>;
};

type CustomPostInput = {
  title: string;
  subredditName: string;
  entry: string;
  postData: Record<string, string | number>;
  textFallback: { text: string };
  styles: {
    backgroundColor: string;
    backgroundColorDark: string;
    heightPixels: number;
  };
};

type DailyPostDependencies = {
  context: DailyPostContext;
  redis: DailyPostRedis;
  reddit: {
    submitCustomPost: (input: CustomPostInput) => Promise<{ id: string }>;
  };
  loadBoardStateForDate: (date: Date) => Promise<{
    dateKey: string;
    totalFalls: number;
    totalClears: number;
    totalSummits: number;
  }>;
  now?: () => Date;
};

export type DailyPostResult =
  | { status: 'created' | 'existing'; postId: string }
  | { status: 'pending'; postId: null };

export function createDailyPostService(dependencies: DailyPostDependencies) {
  return async function ensureDailyPost(): Promise<DailyPostResult> {
    const now = dependencies.now?.() ?? new Date();
    const dateKey = utcDateKey(now);
    const key = dailyPostKey(dependencies.context.subredditId, dateKey);
    const existing = await dependencies.redis.get(key);
    const existingPostId = storedPostId(existing);
    if (existingPostId)
      return { status: 'existing', postId: existingPostId };

    const reserved = await dependencies.redis.set(key, 'creating', {
      nx: true,
      expiration: new Date(now.getTime() + LEASE_MS),
    });
    if (reserved !== 'OK') {
      const racedPostId = storedPostId(await dependencies.redis.get(key));
      return racedPostId
        ? { status: 'existing', postId: racedPostId }
        : { status: 'pending', postId: null };
    }

    let post: { id: string };
    try {
      const yesterday = previousUtcDay(now);
      const previousState = await dependencies.loadBoardStateForDate(yesterday);
      const memory = deriveDailyMemory(previousState);
      post = await dependencies.reddit.submitCustomPost({
        title: `Fallstack Daily Tower · ${dateKey} · r/${dependencies.context.subredditName}`,
        subredditName: dependencies.context.subredditName,
        entry: 'default',
        postData: {
          boardDate: dateKey,
          towerVersion: TOWER_VERSION,
          previousDate: memory.dateKey,
        },
        textFallback: {
          text: dailyPostFallback(memory.copy),
        },
        styles: {
          backgroundColor: '#f3ead7ff',
          backgroundColorDark: '#1b262fff',
          heightPixels: 512,
        },
      });
    } catch (error) {
      await dependencies.redis.del(key).catch(() => {});
      throw error;
    }

    await dependencies.redis.set(key, `post:${post.id}`, {
      expiration: new Date(now.getTime() + COMPLETED_RECORD_MS),
    });
    return { status: 'created', postId: post.id };
  };
}

export const createPost = createDailyPostService({
  context: devvitContext,
  redis: devvitRedis,
  reddit: devvitReddit,
  loadBoardStateForDate,
});

export function postUrl(subredditName: string, postId: string): string {
  const id = postId.startsWith('t3_') ? postId.slice(3) : postId;
  return `https://www.reddit.com/r/${subredditName}/comments/${id}`;
}

function dailyPostFallback(previousMemory: string): string {
  return [
    '# Fallstack',
    '',
    'A shared daily precision climb. Community falls and clean clears visibly mutate one tower for everyone in this subreddit.',
    '',
    previousMemory,
    '',
    'Open this post in the current Reddit app to play. Desktop: arrows move; hold Space and release to leap. Mobile: use the fixed Left, Jump, and Right controls.',
  ].join('\n');
}

function dailyPostKey(subredditId: string, dateKey: string): string {
  return `fallstack:daily-post:${subredditId}:${dateKey}:v${TOWER_VERSION}`;
}

function storedPostId(value: string | undefined): string | null {
  return value?.startsWith('post:') ? value.slice(5) : null;
}

function previousUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - 1)
  );
}

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
