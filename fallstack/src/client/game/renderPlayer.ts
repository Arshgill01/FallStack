import type Phaser from 'phaser';
import {
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
  const chargeCompression = state === 'charge' ? 1 - input.chargeRatio * 0.15 : 1;
  const width = state === 'fall' ? 24 : state === 'charge' ? 22 : 20;
  const height = (state === 'airborne' ? 32 : state === 'fall' ? 25 : 28) * chargeCompression;
  const top = input.y - height / 2;

  if (state === 'charge') {
    const marks = Math.max(1, Math.ceil(input.chargeRatio * 3));
    for (let i = 0; i < marks; i += 1) {
      graphics
        .fillStyle(c.persimmon, 0.55 + i * 0.15)
        .fillRect(input.x - 10 + i * 7, input.y + height / 2 + 4, 4, 3);
    }
  }

  graphics
    .fillStyle(c.ink, 0.92)
    .fillRoundedRect(input.x - width / 2 + 2, top + 3, width, height, 4);
  graphics
    .fillStyle(c.indigoDeep, 1)
    .fillRoundedRect(input.x - width / 2, top, width, height, 4);
  graphics
    .fillStyle(c.washi, 1)
    .fillRoundedRect(input.x - 5 + input.facing * 2, top + 5, 8, 6, 2);

  const scarfY = top + 13;
  const scarfLength = state === 'airborne' || state === 'fall' ? 13 : 9;
  graphics
    .fillStyle(c.persimmon, 1)
    .fillRect(
      input.facing > 0 ? input.x - 1 : input.x - scarfLength + 1,
      scarfY,
      scarfLength,
      4
    );

  if (state === 'grounded' || state === 'charge') {
    graphics.fillStyle(c.washiDim, 1);
    graphics.fillRect(input.x - 8, input.y + height / 2 - 2, 6, 3);
    graphics.fillRect(input.x + 2, input.y + height / 2 - 2, 6, 3);
  } else {
    graphics.lineStyle(3, c.washiDim, 1);
    const spread = state === 'fall' ? 8 : 5;
    graphics.lineBetween(input.x - 3, input.y + 8, input.x - spread, input.y + 13);
    graphics.lineBetween(input.x + 3, input.y + 8, input.x + spread, input.y + 13);
  }
}

