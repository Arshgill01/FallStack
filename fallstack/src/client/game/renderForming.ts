import type Phaser from 'phaser';
import type { Artifact } from '../../shared/game/mutation.js';
import { tierPressure, type FormingMark } from '../../shared/game/forming.js';
import { RELIQUARY_COLORS } from './art-direction.js';

// Forming marks are visual-only. They read as unfinished, never as ledges:
// a dashed washi outline with a fill that rises with each fall, and a tally
// row underneath that counts toward the spawn.
export function renderFormingMark(
  graphics: Phaser.GameObjects.Graphics,
  mark: FormingMark,
  options: { reducedMotion: boolean; timeMs: number }
): void {
  const c = RELIQUARY_COLORS;
  const progress = mark.count / mark.needed;
  const breathe = options.reducedMotion
    ? 0.62
    : 0.5 + Math.sin(options.timeMs / 520) * 0.12;

  if (mark.type === 'lantern_trail') {
    for (let i = 0; i < 5; i += 1) {
      const t = i / 4;
      const x = mark.x + 8 + t * Math.max(48, mark.width - 16);
      const y = mark.y + 14 - Math.sin(t * Math.PI) * 34;
      const lit = i < Math.round(progress * 5);
      if (lit) graphics.fillStyle(c.gold, 0.5 * breathe + 0.2).fillCircle(x, y, 3);
      else graphics.lineStyle(1, c.washiDim, 0.4).strokeCircle(x, y, 3);
    }
    drawTally(graphics, mark.x + 4, mark.y + mark.height + 6, mark.count, mark.needed);
    return;
  }

  const height = mark.type === 'ghost_platform' ? 7 : mark.height;
  const fillHeight = Math.max(2, Math.round(height * progress));
  const fillColor =
    mark.type === 'cursed_brick'
      ? c.persimmonDeep
      : mark.type === 'ghost_platform'
        ? c.ghostDeep
        : c.indigoLit;
  graphics
    .fillStyle(fillColor, 0.34)
    .fillRect(mark.x, mark.y + height - fillHeight, mark.width, fillHeight);
  drawDashedRect(
    graphics,
    mark.x,
    mark.y,
    mark.width,
    height,
    mark.type === 'cursed_brick' ? c.persimmon : c.washi,
    breathe
  );
  drawTally(graphics, mark.x + 2, mark.y + height + 6, mark.count, mark.needed);
  for (let index = 0; index < mark.secondaryCount; index += 1) {
    const tickX = mark.x + 2 + (mark.needed + 1 + index) * 6;
    const tickY = mark.y + height + 6;
    graphics
      .lineStyle(2, c.washi, 0.8)
      .lineBetween(tickX, tickY - 3, tickX + 2, tickY + 4);
  }
}

// Pips under a grown artifact that count toward its next tier, so falls
// between 3 and 6 (and 6 and 10) stay visible too.
export function renderTierPressure(
  graphics: Phaser.GameObjects.Graphics,
  artifact: Pick<Artifact, 'bucket' | 'count' | 'x' | 'y' | 'height'>
): void {
  const pressure = tierPressure(artifact.bucket, artifact.count);
  if (!pressure) return;
  drawTally(
    graphics,
    artifact.x + 2,
    artifact.y + artifact.height + 5,
    pressure.filled,
    pressure.total
  );
}

function drawTally(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  filled: number,
  total: number
): void {
  const c = RELIQUARY_COLORS;
  for (let index = 0; index < total; index += 1) {
    const tickX = x + index * 6;
    if (index < filled) {
      graphics.lineStyle(2, c.persimmon, 0.95).lineBetween(tickX, y - 3, tickX + 2, y + 4);
    } else {
      graphics.lineStyle(1, c.washiDim, 0.45).lineBetween(tickX, y - 3, tickX + 2, y + 4);
    }
  }
}

function drawDashedRect(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  alpha: number
): void {
  graphics.lineStyle(1.5, color, alpha);
  const dash = 5;
  const gap = 4;
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    for (let start = 0; start < length; start += dash + gap) {
      const end = Math.min(length, start + dash);
      graphics.lineBetween(
        x1 + ((x2 - x1) * start) / length,
        y1 + ((y2 - y1) * start) / length,
        x1 + ((x2 - x1) * end) / length,
        y1 + ((y2 - y1) * end) / length
      );
    }
  };
  edge(x, y, x + width, y);
  edge(x + width, y, x + width, y + height);
  edge(x + width, y + height, x, y + height);
  edge(x, y + height, x, y);
}
