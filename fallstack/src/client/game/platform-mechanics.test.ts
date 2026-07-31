import assert from 'node:assert/strict';
import test from 'node:test';
import { canCollideWithPlatform } from './platform-mechanics.js';

void test('checkpoint platforms can be crossed safely from below', () => {
  assert.equal(
    canCollideWithPlatform({
      checkpoint: true,
      playerVelocityY: -120,
      playerBottom: 112,
      playerPreviousBottom: 108,
      platformTop: 100,
    }),
    false
  );
  assert.equal(
    canCollideWithPlatform({
      checkpoint: true,
      playerVelocityY: 120,
      playerBottom: 112,
      playerPreviousBottom: 110,
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
      playerPreviousBottom: 96,
      platformTop: 100,
    }),
    true
  );
});

void test('checkpoint platforms catch a fast descending climber without tunneling', () => {
  assert.equal(
    canCollideWithPlatform({
      checkpoint: true,
      playerVelocityY: 520,
      playerBottom: 114,
      playerPreviousBottom: 105,
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
      playerPreviousBottom: 130,
      platformTop: 100,
    }),
    true
  );
});
