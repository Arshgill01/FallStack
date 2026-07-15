import assert from 'node:assert/strict';
import test from 'node:test';
import { canCollideWithPlatform } from './platform-mechanics.js';

void test('checkpoint platforms can be crossed safely from below', () => {
  assert.equal(
    canCollideWithPlatform({
      checkpoint: true,
      playerVelocityY: -120,
      playerBottom: 112,
      platformTop: 100,
    }),
    false
  );
  assert.equal(
    canCollideWithPlatform({
      checkpoint: true,
      playerVelocityY: 120,
      playerBottom: 112,
      platformTop: 100,
    }),
    false
  );
});

void test('checkpoint platforms catch a descending climber from above', () => {
  assert.equal(
    canCollideWithPlatform({
      checkpoint: true,
      playerVelocityY: 120,
      playerBottom: 102,
      platformTop: 100,
    }),
    true
  );
});

void test('ordinary route platforms stay solid from every direction', () => {
  assert.equal(
    canCollideWithPlatform({
      checkpoint: false,
      playerVelocityY: -200,
      playerBottom: 140,
      platformTop: 100,
    }),
    true
  );
});
