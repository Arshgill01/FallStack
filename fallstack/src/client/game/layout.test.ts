/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_WIDTH } from '../../shared/game/tower.js';
import {
  cameraBottomPaddingForGameWidth,
  computeGameDimensions,
  gameWorldWidth,
  renderScaleForDevicePixelRatio,
  routeOffsetForGameWidth,
} from './layout.js';

void test('game dimensions use the viewport size without squeezing the tower', () => {
  assert.deepEqual(computeGameDimensions({ width: 390.4, height: 635.6 }), {
    containerW: 390,
    containerH: 636,
    gameW: 390,
    gameH: 636,
    renderScale: 1,
  });
  assert.deepEqual(
    computeGameDimensions({ width: 390.4, height: 635.6 }, 2.5),
    {
      containerW: 390,
      containerH: 636,
      gameW: 780,
      gameH: 1272,
      renderScale: 2,
    }
  );
});

void test('render scale is finite and capped to control canvas memory', () => {
  assert.equal(renderScaleForDevicePixelRatio(Number.NaN), 1);
  assert.equal(renderScaleForDevicePixelRatio(0.8), 1);
  assert.equal(renderScaleForDevicePixelRatio(1.5), 1.5);
  assert.equal(renderScaleForDevicePixelRatio(3), 2);
});

void test('logical game world still preserves the full tower route', () => {
  assert.equal(gameWorldWidth(390), WORLD_WIDTH);
  assert.equal(gameWorldWidth(900), 900);
  assert.equal(routeOffsetForGameWidth(900), (900 - WORLD_WIDTH) / 2);
  assert.equal(cameraBottomPaddingForGameWidth(900), 260);
});

void test('game dimensions clamp empty layout bounds safely', () => {
  assert.deepEqual(computeGameDimensions({ width: -1, height: Number.NaN }), {
    containerW: 0,
    containerH: 0,
    gameW: 0,
    gameH: 0,
    renderScale: 1,
  });
  assert.equal(routeOffsetForGameWidth(0), 0);
  assert.equal(cameraBottomPaddingForGameWidth(WORLD_WIDTH), 150);
});
