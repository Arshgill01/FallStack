import assert from 'node:assert/strict';
import test from 'node:test';
import type { BoardSnapshot } from '../../shared/game/board.js';
import {
  latestRemoteBeat,
  reconciliationDecision,
} from './reconciliation.js';

void test('newer board snapshots apply only at a safe collision point', () => {
  assert.equal(reconciliationDecision(40, 41, true), 'apply');
  assert.equal(reconciliationDecision(40, 41, false), 'defer');
  assert.equal(reconciliationDecision(41, 41, true), 'ignore');
  assert.equal(reconciliationDecision(42, 41, true), 'ignore');
});

void test('a new daily board can replace a higher old revision only at a safe point', () => {
  assert.equal(reconciliationDecision(80, 37, false, true), 'defer');
  assert.equal(reconciliationDecision(80, 37, true, true), 'apply');
});

void test('remote beat selects the newest visible change after current revision', () => {
  const snapshot = {
    recentMutations: [
      { revision: 39, siteName: 'Old Gap' },
      { revision: 41, siteName: 'First Gap' },
      { revision: 43, siteName: 'Bell Mouth' },
    ],
  } as BoardSnapshot;

  assert.equal(latestRemoteBeat(40, snapshot)?.revision, 43);
  assert.equal(latestRemoteBeat(43, snapshot), null);
});
