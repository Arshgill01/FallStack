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

export function cameraBottomPaddingForGameWidth(gameWidth: number): number {
  return gameWorldWidth(gameWidth) > WORLD_WIDTH
    ? WIDE_CAMERA_BOTTOM_PADDING
    : NARROW_CAMERA_BOTTOM_PADDING;
}

function cleanPixelSize(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}
