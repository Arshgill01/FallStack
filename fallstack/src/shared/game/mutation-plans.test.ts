/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  planClearMutation,
  planFallMutation,
  planSummitMutation,
} from './mutation-plans.js';

const input = {
  eventId: 'fall_event_12345678',
  boardId: 'board_2026_07_13_v1',
  revision: 39,
  siteId: 'impact-v1:start:ledge-orbital_scrapyard-1',
  siteName: 'First Gap',
  bucket: 'short_jump' as const,
  counter: 2,
  contributorBucketCount: 0,
  contributorDailyFallCount: 0,
};

void test('first fall plans one accepted counter and revision increment', () => {
  const plan = planFallMutation(input);

  assert.equal(plan.applyMutation, true);
  assert.equal(plan.storeReceipt, true);
  assert.equal(plan.receipt.accepted, true);
  assert.equal(plan.receipt.counterAfter, 3);
  assert.equal(plan.receipt.revisionAfter, 40);
});

void test('one hundred duplicate submissions reuse one stored receipt', () => {
  const first = planFallMutation(input);
  let applied = Number(first.applyMutation);

  for (let index = 0; index < 100; index += 1) {
    const duplicate = planFallMutation({
      ...input,
      existingReceipt: first.receipt,
    });
    applied += Number(duplicate.applyMutation);
    assert.deepEqual(duplicate.receipt, first.receipt);
    assert.equal(duplicate.storeReceipt, false);
  }

  assert.equal(applied, 1);
});

void test('contributor caps store a stable rejected receipt without mutation', () => {
  const plan = planFallMutation({
    ...input,
    contributorBucketCount: 3,
  });

  assert.equal(plan.applyMutation, false);
  assert.equal(plan.storeReceipt, true);
  assert.equal(plan.receipt.rejection, 'capped');
  assert.equal(plan.receipt.counterAfter, 2);
  assert.equal(plan.receipt.revisionAfter, 39);
});

void test('clear and summit plans apply their independent contributor caps', () => {
  const clear = planClearMutation({
    eventId: 'clear_event_12345678',
    boardId: input.boardId,
    revision: 40,
    siteId: input.siteId,
    siteName: input.siteName,
    counter: 2,
    contributorClearCount: 3,
  });
  const summit = planSummitMutation({
    eventId: 'summit_event_12345678',
    boardId: input.boardId,
    revision: 40,
    contributorSummitCount: 0,
  });

  assert.equal(clear.receipt.rejection, 'capped');
  assert.equal(clear.applyMutation, false);
  assert.equal(summit.receipt.accepted, true);
  assert.equal(summit.applyMutation, true);
  assert.equal(summit.receipt.revisionAfter, 41);
});
