import type Phaser from 'phaser';
import type { Artifact } from '../../shared/game/mutation.js';
import { RELIQUARY_COLORS } from './art-direction.js';

// A small persimmon seal on artifacts this climber's falls are part of. Shape,
// not color alone: a diamond no other artifact mark uses.
export function renderYourMark(
  graphics: Phaser.GameObjects.Graphics,
  artifact: Pick<Artifact, 'x' | 'y' | 'width'>
): void {
  const c = RELIQUARY_COLORS;
  const x = artifact.x + artifact.width + 3;
  const y = artifact.y - 4;
  graphics.fillStyle(c.ink, 0.9).fillTriangle(x - 6, y + 1, x, y - 5, x + 6, y + 1);
  graphics.fillStyle(c.ink, 0.9).fillTriangle(x - 6, y + 1, x, y + 7, x + 6, y + 1);
  graphics.fillStyle(c.persimmon, 1).fillTriangle(x - 4.5, y + 1, x, y - 3.5, x + 4.5, y + 1);
  graphics.fillStyle(c.persimmon, 1).fillTriangle(x - 4.5, y + 1, x, y + 5.5, x + 4.5, y + 1);
  graphics.fillStyle(c.washi, 1).fillCircle(x, y + 1, 1.4);
}
