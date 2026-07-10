import type { ApiErrorResponse } from '../../shared/api';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
} from '../../shared/game/mutation.js';

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export function createLocalSnapshot() {
  const seed = createDailySeed();
  return deriveSnapshot({
    ...seed,
    counters: createSeededCounters(),
    totalFalls: SEEDED_TOTAL_FALLS,
    totalClears: 0,
    totalSummits: 0,
    achievements: createInitialAchievements(),
  });
}

export function newAttemptId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${randomAttemptToken()}`;
}

function randomAttemptToken(): string {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();

  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint32Array(3);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(36)).join('-');
  }

  return Math.random().toString(36).slice(2, 14);
}

export async function parseApiResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const data = parseResponseBody<T>(text);
  if (!res.ok) {
    const message =
      (data as ApiErrorResponse).message ?? 'The tower did not answer.';
    throw new ApiRequestError(message, res.status);
  }
  return data as T;
}

function parseResponseBody<T>(text: string): T | ApiErrorResponse {
  if (!text.trim()) return { status: 'error', message: 'The tower did not answer.' };
  try {
    return JSON.parse(text) as T | ApiErrorResponse;
  } catch {
    return { status: 'error', message: 'The tower did not answer.' };
  }
}
