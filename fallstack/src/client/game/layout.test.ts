/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_WIDTH } from '../../shared/game/tower.js';
import {
  cameraBottomPaddingForGameWidth,
  computeGameDimensions,
  gameWorldWidth,
  routeOffsetForGameWidth,
} from './layout.js';

void test('game dimensions preserve logical tower width on narrow viewports', () => {
  assert.deepEqual(computeGameDimensions({ width: 390.4, height: 635.6 }), {
    containerW: 390,
    containerH: 636,
    gameW: WORLD_WIDTH,
    gameH: 636,
  });
});

void test('game dimensions expand the logical world on wide viewports', () => {
  assert.equal(gameWorldWidth(900), 900);
  assert.equal(routeOffsetForGameWidth(900), (900 - WORLD_WIDTH) / 2);
  assert.equal(cameraBottomPaddingForGameWidth(900), 260);
});

void test('game dimensions clamp empty layout bounds safely', () => {
  assert.deepEqual(computeGameDimensions({ width: -1, height: Number.NaN }), {
    containerW: 0,
    containerH: 0,
    gameW: WORLD_WIDTH,
    gameH: 0,
  });
  assert.equal(routeOffsetForGameWidth(0), 0);
  assert.equal(cameraBottomPaddingForGameWidth(WORLD_WIDTH), 150);
});
