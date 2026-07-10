import type { ApiErrorResponse } from '../../shared/api';
import {
  createDailySeed,
  createInitialAchievements,
  createSeededCounters,
  deriveSnapshot,
  SEEDED_TOTAL_FALLS,
} from '../../shared/game/mutation';

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
  const random = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
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
