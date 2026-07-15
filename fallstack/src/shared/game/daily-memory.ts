import { SEEDED_TOTAL_FALLS } from './mutation.js';

export type DailyMemory = {
  dateKey: string;
  organicFalls: number;
  clears: number;
  summits: number;
  copy: string;
};

export function deriveDailyMemory(input: {
  dateKey: string;
  totalFalls: number;
  totalClears: number;
  totalSummits: number;
}): DailyMemory {
  const organicFalls = Math.max(0, input.totalFalls - SEEDED_TOTAL_FALLS);
  const clears = Math.max(0, input.totalClears);
  const summits = Math.max(0, input.totalSummits);
  const activity = organicFalls + clears + summits;

  return {
    dateKey: input.dateKey,
    organicFalls,
    clears,
    summits,
    copy:
      activity === 0
        ? 'Yesterday stayed quiet; today begins with generated opening scars.'
        : `Yesterday left ${countLabel(organicFalls, 'community fall')}, ${countLabel(clears, 'clean clear')}, and ${countLabel(summits, 'summit')}.`,
  };
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}
