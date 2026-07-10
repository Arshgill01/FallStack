/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { newAttemptId } from './api.js';

void test('attempt ids are server-safe and collision-resistant in a session', () => {
  const ids = new Set<string>();

  for (let index = 0; index < 50; index += 1) {
    const id = newAttemptId('attempt');
    ids.add(id);
    assert.match(id, /^[a-zA-Z0-9:_-]{8,80}$/);
  }

  assert.equal(ids.size, 50);
});
