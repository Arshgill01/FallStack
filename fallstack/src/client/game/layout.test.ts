/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';
import { generateDailyTower, WORLD_WIDTH } from '../../shared/game/tower.js';
import {
  CAMERA_AIR_LOOKAHEAD,
  CAMERA_VERTICAL_AIR_LOOKAHEAD,
  CAMERA_VERTICAL_CHARGE_LOOKAHEAD,
  DESKTOP_CANVAS_PIXEL_BUDGET,
  cameraBottomPaddingForGameWidth,
  cameraBottomPaddingForViewport,
  cameraScrollForWorldViewStart,
  cameraScrollXForPlayer,
  cameraVerticalLookahead,
  canvasRenderScaleForEnvironment,
  chooseHudNoticePlacement,
  chooseHudNoticeSide,
  computeGameDimensions,
  gameWorldWidth,
  PLAYER_VISUAL_EDGE_CLEARANCE,
  physicsBoundsForViewport,
  playableRouteBoundsForGameWidth,
  renderScaleForDevicePixelRatio,
  ROUTE_PLAYABLE_INSET,
  routeOffsetForGameWidth,
  shouldUseDesktopSafariCanvasProfile,
  visibleHorizontalSpan,
  worldViewStartForCameraScroll,
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
  assert.deepEqual(
    computeGameDimensions({ width: 390.4, height: 635.6 }, 2.5, 1),
    {
      containerW: 390,
      containerH: 636,
      gameW: 390,
      gameH: 636,
      renderScale: 1,
    }
  );
});

void test('render scale is finite and capped to control canvas memory', () => {
  assert.equal(renderScaleForDevicePixelRatio(Number.NaN), 1);
  assert.equal(renderScaleForDevicePixelRatio(0.8), 1);
  assert.equal(renderScaleForDevicePixelRatio(1.5), 1.5);
  assert.equal(renderScaleForDevicePixelRatio(3), 2);
  assert.equal(renderScaleForDevicePixelRatio(2, 1), 1);
  assert.equal(renderScaleForDevicePixelRatio(2, 1.5), 1.5);
  assert.equal(renderScaleForDevicePixelRatio(2, Number.NaN), 2);
});

void test('desktop Safari uses the constrained Canvas rendering profile', () => {
  const safari =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15';
  assert.equal(
    shouldUseDesktopSafariCanvasProfile({
      userAgent: safari,
      coarsePointer: false,
    }),
    true
  );
  assert.equal(
    shouldUseDesktopSafariCanvasProfile({
      userAgent: safari,
      coarsePointer: true,
    }),
    false
  );
});

void test('Safari-compatible browsers and mobile Safari keep the default profile', () => {
  const chrome =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
  const iosSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  assert.equal(
    shouldUseDesktopSafariCanvasProfile({
      userAgent: chrome,
      coarsePointer: false,
    }),
    false
  );
  assert.equal(
    shouldUseDesktopSafariCanvasProfile({
      userAgent: iosSafari,
      coarsePointer: true,
    }),
    false
  );
  assert.equal(
    shouldUseDesktopSafariCanvasProfile({
      userAgent: 'Mozilla/5.0 Firefox/141.0',
      coarsePointer: false,
    }),
    false
  );
});

void test('fine-pointer Canvas surfaces share a bounded pixel workload', () => {
  const firefox = {
    userAgent: 'Mozilla/5.0 Firefox/151.0',
    coarsePointer: false,
  };
  for (const bounds of [
    { width: 758, height: 742 },
    { width: 758, height: 1022 },
  ]) {
    const renderScale = canvasRenderScaleForEnvironment(bounds, 2, firefox);
    const dimensions = computeGameDimensions(bounds, 2, renderScale);
    assert.ok(
      dimensions.gameW * dimensions.gameH <=
        DESKTOP_CANVAS_PIXEL_BUDGET +
          Math.max(dimensions.gameW, dimensions.gameH)
    );
    assert.ok(renderScale >= 1 && renderScale < 2);
  }
  assert.equal(
    canvasRenderScaleForEnvironment({ width: 390, height: 711 }, 3, {
      ...firefox,
      coarsePointer: true,
    }),
    2
  );
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

void test('DPR-scaled cameras preserve the requested visible world edge', () => {
  for (const viewportSize of [320, 375, 393, 526, 844]) {
    for (const renderScale of [1, 1.5, 2]) {
      for (const worldViewStart of [0, 43.5, 87, 412, 16_754]) {
        const cameraScroll = cameraScrollForWorldViewStart(
          worldViewStart,
          viewportSize,
          renderScale
        );
        assert.equal(
          worldViewStartForCameraScroll(
            cameraScroll,
            viewportSize,
            renderScale
          ),
          worldViewStart
        );
      }
    }
  }

  assert.equal(cameraScrollForWorldViewStart(0, 393, 2), -196.5);
  assert.equal(cameraScrollForWorldViewStart(87, 393, 2), -109.5);
});

void test('vertical lookahead previews the climb while charging and rising', () => {
  assert.equal(cameraVerticalLookahead(true, 0, 0), 0);
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

void test('mobile notices choose the vertical edge away from play geometry', () => {
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

void test('mobile notices choose the horizontal edge away from play geometry', () => {
  const common = {
    viewportWidth: 320,
    noticeWidth: 188,
    leftOffset: 36,
    rightOffset: 36,
  };
  assert.equal(
    chooseHudNoticeSide({
      ...common,
      protectedSpans: [{ left: -53, right: 95 }],
    }),
    'right'
  );
  assert.equal(
    chooseHudNoticeSide({
      ...common,
      protectedSpans: [{ left: 225, right: 373 }],
    }),
    'left'
  );
  assert.equal(
    chooseHudNoticeSide({
      ...common,
      protectedSpans: [
        { left: 150, right: 175, weight: 2 },
        { left: 40, right: 80 },
      ],
    }),
    'right'
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
