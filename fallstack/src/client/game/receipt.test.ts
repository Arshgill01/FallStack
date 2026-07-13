import assert from 'node:assert/strict';
import test from 'node:test';
import type { MutationReceipt } from '../../shared/game/mutation-receipts.js';
import { mutationReceiptPresentation } from './receipt.js';

void test('accepted site receipt exposes board, site, and exact counter delta', () => {
  const receipt: MutationReceipt = {
    eventId: 'fall:attempt-1',
    boardId: 'community:t5_test:2026-07-13:v1',
    accepted: true,
    rejection: null,
    revisionBefore: 37,
    revisionAfter: 38,
    siteId: 'impact-v1:start:p1',
    siteName: 'First Gap',
    bucket: 'short_jump',
    counterBefore: 4,
    counterAfter: 5,
    nextThreshold: 6,
    visibleChange: 'mark_added',
    copy: 'Your fall changed First Gap: 4 → 5. 1 more short jump changes it.',
  };

  assert.deepEqual(mutationReceiptPresentation(receipt), {
    acceptedLabel: 'MUTATION COUNTED',
    revisionLabel: 'BOARD r37 → r38',
    siteLabel: 'First Gap',
    bucketLabel: 'SHORT JUMPS',
    counterLabel: '4 → 5',
  });
});

void test('capped receipt is visibly unchanged', () => {
  const receipt: MutationReceipt = {
    eventId: 'fall:attempt-2',
    boardId: 'community:t5_test:2026-07-13:v1',
    accepted: false,
    rejection: 'capped',
    revisionBefore: 38,
    revisionAfter: 38,
    siteId: 'impact-v1:start:p1',
    siteName: 'First Gap',
    bucket: 'helper_overuse',
    counterBefore: 2,
    counterAfter: 2,
    nextThreshold: 3,
    visibleChange: 'none',
    copy: 'First Gap has heard enough from you today. Shared state stayed at 2.',
  };

  assert.deepEqual(mutationReceiptPresentation(receipt), {
    acceptedLabel: 'NOT COUNTED · CAPPED',
    revisionLabel: 'BOARD r38 · UNCHANGED',
    siteLabel: 'First Gap',
    bucketLabel: 'HELPER SLIPS',
    counterLabel: '2 · UNCHANGED',
  });
});
