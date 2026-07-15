import assert from 'node:assert/strict';
import test from 'node:test';
import { SEEDED_TOTAL_FALLS } from './mutation.js';
import { deriveDailyMemory } from './daily-memory.js';

void test('quiet daily memory does not attribute generated scars to people', () => {
  const memory = deriveDailyMemory({
    dateKey: '2026-07-14',
    totalFalls: SEEDED_TOTAL_FALLS,
    totalClears: 0,
    totalSummits: 0,
  });

  assert.equal(memory.organicFalls, 0);
  assert.match(memory.copy, /generated opening scars/);
  assert.doesNotMatch(memory.copy, /37/);
});

void test('daily memory summarizes only retained organic activity', () => {
  const memory = deriveDailyMemory({
    dateKey: '2026-07-14',
    totalFalls: SEEDED_TOTAL_FALLS + 4,
    totalClears: 2,
    totalSummits: 1,
  });

  assert.equal(
    memory.copy,
    'Yesterday left 4 community falls, 2 clean clears, and 1 summit.'
  );
});
