import { WORLD_WIDTH } from '../../shared/game/tower.js';

export type ContainerBounds = {
  width: number;
  height: number;
};

export type GameDimensions = {
  containerW: number;
  containerH: number;
  gameW: number;
  gameH: number;
  renderScale: number;
};

export type BrowserRenderingEnvironment = {
  userAgent: string;
  coarsePointer: boolean;
};

export const DESKTOP_CANVAS_PIXEL_BUDGET = 1_600_000;
const WIDE_CAMERA_BOTTOM_PADDING = 260;
const NARROW_CAMERA_BOTTOM_PADDING = 150;
const MAX_CAMERA_BOTTOM_PADDING_RATIO = 0.6;
export const ROUTE_PLAYABLE_INSET = 34;
export const PLAYER_VISUAL_EDGE_CLEARANCE = 12;
export const CAMERA_AIR_LOOKAHEAD = 64;
export const CAMERA_VERTICAL_CHARGE_LOOKAHEAD = 64;
export const CAMERA_VERTICAL_AIR_LOOKAHEAD = 48;
export const MOBILE_GAME_BREAKPOINT = 600;

export type HorizontalBounds = {
  left: number;
  right: number;
  width: number;
};

export type VerticalSpan = {
  top: number;
  bottom: number;
  weight?: number;
};

export type HorizontalSpan = {
  left: number;
  right: number;
  weight?: number;
};

export type HudNoticePlacement = 'top' | 'bottom';
export type HudNoticeSide = 'left' | 'right';

export function computeGameDimensions(
  bounds: ContainerBounds,
  devicePixelRatio = 1,
  maxRenderScale = 2
): GameDimensions {
  const containerW = cleanPixelSize(bounds.width);
  const containerH = cleanPixelSize(bounds.height);
  const renderScale = renderScaleForDevicePixelRatio(
    devicePixelRatio,
    maxRenderScale
  );
  return {
    containerW,
    containerH,
    gameW: cleanPixelSize(containerW * renderScale),
    gameH: cleanPixelSize(containerH * renderScale),
    renderScale,
  };
}

export function renderScaleForDevicePixelRatio(
  devicePixelRatio: number,
  maxRenderScale = 2
): number {
  const safeMaxRenderScale = Number.isFinite(maxRenderScale)
    ? Math.min(2, Math.max(1, maxRenderScale))
    : 2;
  return Number.isFinite(devicePixelRatio)
    ? Math.min(safeMaxRenderScale, Math.max(1, devicePixelRatio))
    : 1;
}

export function shouldUseDesktopSafariCanvasProfile(
  environment: BrowserRenderingEnvironment
): boolean {
  const userAgent = environment.userAgent;
  const isSafari = /Safari\//.test(userAgent);
  const isSafariCompatibleBrowser =
    /(Chrome|Chromium|CriOS|Edg|EdgiOS|OPR|FxiOS)\//.test(userAgent);
  return isSafari && !isSafariCompatibleBrowser && !environment.coarsePointer;
}

export function canvasRenderScaleForEnvironment(
  bounds: ContainerBounds,
  devicePixelRatio: number,
  environment: BrowserRenderingEnvironment
): number {
  const browserMaximum = shouldUseDesktopSafariCanvasProfile(environment)
    ? 1
    : 2;
  if (environment.coarsePointer)
    return renderScaleForDevicePixelRatio(devicePixelRatio, browserMaximum);
  const cssPixels =
    cleanPixelSize(bounds.width) * cleanPixelSize(bounds.height);
  if (cssPixels <= 0)
    return renderScaleForDevicePixelRatio(devicePixelRatio, browserMaximum);
  const budgetMaximum = Math.sqrt(DESKTOP_CANVAS_PIXEL_BUDGET / cssPixels);
  return renderScaleForDevicePixelRatio(
    devicePixelRatio,
    Math.min(browserMaximum, budgetMaximum)
  );
}

export function gameWorldWidth(viewportWidth: number): number {
  return Math.max(WORLD_WIDTH, cleanPixelSize(viewportWidth));
}

export function routeOffsetForGameWidth(gameWidth: number): number {
  return Math.max(0, (gameWorldWidth(gameWidth) - WORLD_WIDTH) / 2);
}

export function playableRouteBoundsForGameWidth(
  gameWidth: number
): HorizontalBounds {
  const left = routeOffsetForGameWidth(gameWidth) + ROUTE_PLAYABLE_INSET;
  const right =
    routeOffsetForGameWidth(gameWidth) + WORLD_WIDTH - ROUTE_PLAYABLE_INSET;
  return { left, right, width: right - left };
}

export function physicsBoundsForViewport(
  viewportWidth: number,
  gameWidth: number
): HorizontalBounds {
  if (viewportWidth < MOBILE_GAME_BREAKPOINT) {
    const routeBounds = playableRouteBoundsForGameWidth(gameWidth);
    const left = routeBounds.left + PLAYER_VISUAL_EDGE_CLEARANCE;
    const right = routeBounds.right - PLAYER_VISUAL_EDGE_CLEARANCE;
    return { left, right, width: right - left };
  }
  const width = gameWorldWidth(gameWidth);
  return { left: 0, right: width, width };
}

export function cameraScrollXForPlayer(
  playerX: number,
  viewportWidth: number,
  gameWidth: number,
  lookaheadX = 0
): number {
  return Math.max(
    0,
    Math.min(
      playerX + lookaheadX - viewportWidth / 2,
      Math.max(0, gameWorldWidth(gameWidth) - viewportWidth)
    )
  );
}

/**
 * Phaser zooms around the camera centre. When its backing canvas is larger
 * than the CSS viewport, `camera.scrollX/Y` is therefore not the visible
 * world's left/top edge. Convert a desired world-view edge into the scroll
 * value Phaser expects.
 */
export function cameraScrollForWorldViewStart(
  worldViewStart: number,
  viewportSize: number,
  renderScale: number
): number {
  const safeViewportSize = Math.max(0, viewportSize);
  const safeRenderScale = Number.isFinite(renderScale)
    ? Math.max(1, renderScale)
    : 1;
  return worldViewStart - (safeViewportSize * (safeRenderScale - 1)) / 2;
}

export function worldViewStartForCameraScroll(
  cameraScroll: number,
  viewportSize: number,
  renderScale: number
): number {
  const safeViewportSize = Math.max(0, viewportSize);
  const safeRenderScale = Number.isFinite(renderScale)
    ? Math.max(1, renderScale)
    : 1;
  return cameraScroll + (safeViewportSize * (safeRenderScale - 1)) / 2;
}

export function cameraVerticalLookahead(
  charging: boolean,
  chargePercent: number,
  velocityY: number
): number {
  if (charging) {
    const progress = clamp(chargePercent / 100, 0, 1);
    return progress * CAMERA_VERTICAL_CHARGE_LOOKAHEAD;
  }
  return velocityY < 0
    ? Math.min(CAMERA_VERTICAL_AIR_LOOKAHEAD, Math.abs(velocityY) * 0.045)
    : 0;
}

export function chooseHudNoticePlacement(input: {
  viewportHeight: number;
  noticeHeight: number;
  topOffset: number;
  bottomOffset: number;
  protectedSpans: VerticalSpan[];
  companionHeight?: number;
  companionGap?: number;
}): HudNoticePlacement {
  const noticeHeight = Math.max(0, input.noticeHeight);
  const companionHeight = Math.max(0, input.companionHeight ?? 0);
  const companionGap = companionHeight
    ? Math.max(0, input.companionGap ?? 0)
    : 0;
  const top = {
    top: input.topOffset,
    bottom: input.topOffset + noticeHeight,
  };
  const bottom = {
    top: input.viewportHeight - input.bottomOffset - noticeHeight,
    bottom: input.viewportHeight - input.bottomOffset,
  };
  const companion = {
    top: input.topOffset,
    bottom: input.topOffset + companionHeight,
  };
  const stackedCompanion = {
    top: top.bottom + companionGap,
    bottom: top.bottom + companionGap + companionHeight,
  };
  const score = (candidates: VerticalSpan[]) =>
    candidates.reduce(
      (candidateTotal, candidate) =>
        candidateTotal +
        input.protectedSpans.reduce(
          (spanTotal, span) =>
            spanTotal +
            overlapLength(candidate, span) * Math.max(1, span.weight ?? 1),
          0
        ),
      0
    );
  return score(companionHeight ? [bottom, companion] : [bottom]) <
    score(companionHeight ? [top, stackedCompanion] : [top])
    ? 'bottom'
    : 'top';
}

export function chooseHudNoticeSide(input: {
  viewportWidth: number;
  noticeWidth: number;
  leftOffset: number;
  rightOffset: number;
  protectedSpans: HorizontalSpan[];
}): HudNoticeSide {
  const noticeWidth = Math.max(0, input.noticeWidth);
  const left = {
    left: input.leftOffset,
    right: input.leftOffset + noticeWidth,
  };
  const right = {
    left: input.viewportWidth - input.rightOffset - noticeWidth,
    right: input.viewportWidth - input.rightOffset,
  };
  const score = (candidate: HorizontalSpan) =>
    input.protectedSpans.reduce(
      (total, span) =>
        total +
        horizontalOverlapLength(candidate, span) *
          Math.max(1, span.weight ?? 1),
      0
    );
  return score(left) < score(right) ? 'left' : 'right';
}

export function visibleHorizontalSpan(
  left: number,
  right: number,
  cameraScrollX: number,
  viewportWidth: number
): number {
  return Math.max(
    0,
    Math.min(right, cameraScrollX + viewportWidth) -
      Math.max(left, cameraScrollX)
  );
}

export function cameraBottomPaddingForGameWidth(gameWidth: number): number {
  return gameWorldWidth(gameWidth) > WORLD_WIDTH
    ? WIDE_CAMERA_BOTTOM_PADDING
    : NARROW_CAMERA_BOTTOM_PADDING;
}

export function cameraBottomPaddingForViewport(
  gameWidth: number,
  viewportHeight: number
): number {
  return Math.min(
    cameraBottomPaddingForGameWidth(gameWidth),
    Math.max(0, viewportHeight) * MAX_CAMERA_BOTTOM_PADDING_RATIO
  );
}

function cleanPixelSize(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function overlapLength(left: VerticalSpan, right: VerticalSpan): number {
  return Math.max(
    0,
    Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top)
  );
}

function horizontalOverlapLength(
  left: HorizontalSpan,
  right: HorizontalSpan
): number {
  return Math.max(
    0,
    Math.min(left.right, right.right) - Math.max(left.left, right.left)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
