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

const WIDE_CAMERA_BOTTOM_PADDING = 260;
const NARROW_CAMERA_BOTTOM_PADDING = 150;
export const ROUTE_PLAYABLE_INSET = 34;
export const CAMERA_AIR_LOOKAHEAD = 64;
export const MOBILE_GAME_BREAKPOINT = 600;

export type HorizontalBounds = {
  left: number;
  right: number;
  width: number;
};

export function computeGameDimensions(
  bounds: ContainerBounds,
  devicePixelRatio = 1
): GameDimensions {
  const containerW = cleanPixelSize(bounds.width);
  const containerH = cleanPixelSize(bounds.height);
  const renderScale = renderScaleForDevicePixelRatio(devicePixelRatio);
  return {
    containerW,
    containerH,
    gameW: cleanPixelSize(containerW * renderScale),
    gameH: cleanPixelSize(containerH * renderScale),
    renderScale,
  };
}

export function renderScaleForDevicePixelRatio(
  devicePixelRatio: number
): number {
  return Number.isFinite(devicePixelRatio)
    ? Math.min(2, Math.max(1, devicePixelRatio))
    : 1;
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
  if (viewportWidth < MOBILE_GAME_BREAKPOINT)
    return playableRouteBoundsForGameWidth(gameWidth);
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

function cleanPixelSize(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
