import type Phaser from 'phaser';
import {
  playerVisualDimensions,
  playerVisualState,
  RELIQUARY_COLORS,
} from './art-direction.js';

export function renderReliquaryPlayer(
  graphics: Phaser.GameObjects.Graphics,
  input: {
    x: number;
    y: number;
    facing: -1 | 1;
    charging: boolean;
    grounded: boolean;
    velocityY: number;
    chargeRatio: number;
    reducedMotion: boolean;
  }
): void {
  const c = RELIQUARY_COLORS;
  const state = playerVisualState(input);
  const dimensions = playerVisualDimensions(state);
  const chargeCompression =
    state === 'charge' ? 1 - input.chargeRatio * 0.12 : 1;
  const width = dimensions.width;
  const height = dimensions.height * chargeCompression;
  const feetY = input.y + 14;
  const top = feetY - height;

  if (state === 'charge') {
    const marks = Math.max(1, Math.ceil(input.chargeRatio * 3));
    for (let i = 0; i < marks; i += 1) {
      graphics
        .fillStyle(c.persimmon, 0.55 + i * 0.15)
        .fillRoundedRect(input.x - 12 + i * 9, feetY + 3, 6, 3, 1.5);
    }
  }

  // A broad ink silhouette keeps the climber readable against every material.
  graphics
    .fillStyle(c.ink, 0.94)
    .fillRoundedRect(input.x - width / 2 + 2, top + 3, width, height, 6);

  const headY = top + 2;
  const bodyTop = top + 14;
  graphics
    .fillStyle(c.indigoDeep, 1)
    .fillRoundedRect(input.x - 9, headY, 18, 16, 5);
  graphics
    .fillStyle(c.indigo, 1)
    .fillRoundedRect(
      input.x - width / 2,
      bodyTop,
      width,
      Math.max(14, feetY - bodyTop),
      5
    );

  // The pale face and single gold eye survive at narrow phone scale.
  graphics
    .fillStyle(c.washi, 1)
    .fillRoundedRect(input.x - 6 + input.facing * 2, headY + 4, 10, 7, 2);
  graphics
    .fillStyle(c.gold, 1)
    .fillCircle(input.x + input.facing * 3, headY + 7, 1.5);

  const scarfY = bodyTop + 1;
  const scarfLength = state === 'airborne' || state === 'fall' ? 18 : 12;
  graphics
    .fillStyle(c.persimmon, 1)
    .fillRoundedRect(
      input.facing > 0 ? input.x - 2 : input.x - scarfLength + 2,
      scarfY,
      scarfLength,
      5,
      2
    );
  graphics
    .fillStyle(c.goldDeep, 0.9)
    .fillRect(input.x - 2, bodyTop + 7, 4, Math.max(8, feetY - bodyTop - 9));

  if (state === 'grounded' || state === 'charge') {
    graphics.fillStyle(c.washiDim, 1);
    graphics.fillRoundedRect(input.x - 11, feetY - 3, 9, 4, 1.5);
    graphics.fillRoundedRect(input.x + 2, feetY - 3, 9, 4, 1.5);
  } else {
    graphics.lineStyle(3, c.washiDim, 1);
    const spread = state === 'fall' ? 12 : 8;
    graphics.lineBetween(input.x - 4, feetY - 8, input.x - spread, feetY);
    graphics.lineBetween(input.x + 4, feetY - 8, input.x + spread, feetY);
  }
}
