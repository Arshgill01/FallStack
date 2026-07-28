/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDailyTower, WORLD_WIDTH } from '../../shared/game/tower.js';
import {
  CAMERA_AIR_LOOKAHEAD,
  CAMERA_VERTICAL_AIR_LOOKAHEAD,
  CAMERA_VERTICAL_CHARGE_LOOKAHEAD,
  cameraBottomPaddingForGameWidth,
  cameraBottomPaddingForViewport,
  cameraScrollXForPlayer,
  cameraVerticalLookahead,
  chooseHudNoticePlacement,
  computeGameDimensions,
  gameWorldWidth,
  PLAYER_VISUAL_EDGE_CLEARANCE,
  physicsBoundsForViewport,
  playableRouteBoundsForGameWidth,
  renderScaleForDevicePixelRatio,
  ROUTE_PLAYABLE_INSET,
  routeOffsetForGameWidth,
  visibleHorizontalSpan,
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

void test('short landscape cameras keep the player inside the viewport', () => {
  assert.equal(cameraBottomPaddingForViewport(900, 600), 260);
  assert.equal(cameraBottomPaddingForViewport(760, 254), 152.4);
  assert.equal(cameraBottomPaddingForViewport(WORLD_WIDTH, 254), 150);
});

void test('physical route bounds follow the reliquary wall planes', () => {
  assert.deepEqual(playableRouteBoundsForGameWidth(WORLD_WIDTH), {
    left: ROUTE_PLAYABLE_INSET,
    right: WORLD_WIDTH - ROUTE_PLAYABLE_INSET,
    width: WORLD_WIDTH - ROUTE_PLAYABLE_INSET * 2,
  });
  assert.deepEqual(playableRouteBoundsForGameWidth(760), {
    left: 174,
    right: 586,
    width: 412,
  });
});

void test('mobile gets contained route walls while desktop keeps its outer edge', () => {
  assert.deepEqual(physicsBoundsForViewport(375, WORLD_WIDTH), {
    left: 34 + PLAYER_VISUAL_EDGE_CLEARANCE,
    right: 446 - PLAYER_VISUAL_EDGE_CLEARANCE,
    width: 412 - PLAYER_VISUAL_EDGE_CLEARANCE * 2,
  });
  assert.deepEqual(physicsBoundsForViewport(480, WORLD_WIDTH), {
    left: 34 + PLAYER_VISUAL_EDGE_CLEARANCE,
    right: 446 - PLAYER_VISUAL_EDGE_CLEARANCE,
    width: 412 - PLAYER_VISUAL_EDGE_CLEARANCE * 2,
  });
  assert.deepEqual(physicsBoundsForViewport(758, 758), {
    left: 0,
    right: 758,
    width: 758,
  });
});

void test('committed-jump lookahead keeps a readable part of the next landing visible', () => {
  const playerHalfWidth = 10;
  for (let seed = 0; seed < 160; seed += 1) {
    const route = generateDailyTower(`camera-visibility-${seed}`)
      .platforms.filter((platform) => platform.kind !== 'obstacle')
      .sort((left, right) => right.y - left.y);
    for (const viewportWidth of [320, 375]) {
      for (let index = 0; index < route.length - 1; index += 1) {
        const from = route[index]!;
        const target = route[index + 1]!;
        const movingLeft =
          target.x + target.width / 2 < from.x + from.width / 2;
        const direction = movingLeft ? -1 : 1;
        const takeoffX = movingLeft
          ? from.x + playerHalfWidth
          : from.x + from.width - playerHalfWidth;
        const cameraScrollX = cameraScrollXForPlayer(
          takeoffX,
          viewportWidth,
          WORLD_WIDTH,
          direction * CAMERA_AIR_LOOKAHEAD
        );
        const visibleLanding = visibleHorizontalSpan(
          target.x + playerHalfWidth,
          target.x + target.width - playerHalfWidth,
          cameraScrollX,
          viewportWidth
        );
        assert.ok(
          visibleLanding >= 40,
          `${from.id} → ${target.id} exposes ${visibleLanding}px at ${viewportWidth}px`
        );
      }
    }
  }
});

void test('vertical lookahead previews the climb while charging and rising', () => {
  assert.equal(cameraVerticalLookahead(true, 0, 0), 24);
  assert.equal(
    cameraVerticalLookahead(true, 100, 0),
    CAMERA_VERTICAL_CHARGE_LOOKAHEAD
  );
  assert.equal(
    cameraVerticalLookahead(false, 0, -2_000),
    CAMERA_VERTICAL_AIR_LOOKAHEAD
  );
  assert.equal(cameraVerticalLookahead(false, 0, 240), 0);
});

void test('mobile notices choose the side away from protected play geometry', () => {
  const common = {
    viewportHeight: 500,
    noticeHeight: 140,
    topOffset: 54,
    bottomOffset: 12,
  };
  assert.equal(
    chooseHudNoticePlacement({
      ...common,
      protectedSpans: [{ top: 70, bottom: 130, weight: 2 }],
    }),
    'bottom'
  );
  assert.equal(
    chooseHudNoticePlacement({
      ...common,
      protectedSpans: [
        { top: 350, bottom: 420, weight: 2 },
        { top: 220, bottom: 245 },
      ],
    }),
    'top'
  );
  assert.equal(
    chooseHudNoticePlacement({
      ...common,
      protectedSpans: [{ top: 225, bottom: 250 }],
      companionHeight: 60,
      companionGap: 16,
    }),
    'bottom'
  );
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
