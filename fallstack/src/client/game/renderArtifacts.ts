import type Phaser from 'phaser';
import type { Artifact } from '../../shared/game/mutation.js';
import { RELIQUARY_COLORS } from './art-direction.js';

export type ArtifactLabelRenderer = (
  centerX: number,
  y: number,
  text: string
) => void;

export function renderReliquaryArtifact(
  graphics: Phaser.GameObjects.Graphics,
  artifact: Artifact,
  options: {
    reducedMotion: boolean;
    timeMs: number;
    addLabel: ArtifactLabelRenderer;
  }
): void {
  const c = RELIQUARY_COLORS;

  if (artifact.type === 'lantern_trail') {
    const lift = options.reducedMotion ? 0 : Math.sin(options.timeMs / 420) * 2;
    for (let i = 0; i < 5; i += 1) {
      const t = i / 4;
      const x = artifact.x + 8 + t * Math.max(48, artifact.width - 16);
      const y = artifact.y + 14 - Math.sin(t * Math.PI) * 34 + lift;
      graphics.fillStyle(c.gold, 0.35 + t * 0.12).fillCircle(x, y, 6);
      graphics.fillStyle(c.washi, 0.95).fillCircle(x, y, 2.5);
    }
    options.addLabel(
      artifact.x + artifact.width / 2,
      artifact.y - 12,
      artifact.label
    );
    return;
  }

  if (artifact.type === 'corpse_stack') {
    const layerHeight = Math.max(7, Math.min(10, artifact.height / 3));
    for (let i = 0; i < 3; i += 1) {
      const inset = i * 6;
      const y = artifact.y + artifact.height - layerHeight * (i + 1);
      graphics
        .fillStyle(c.ink, 0.9)
        .fillRect(artifact.x + inset, y + 3, artifact.width - inset * 2, layerHeight);
      graphics
        .fillStyle(i === 2 ? c.gold : c.indigoLit, 1)
        .fillRoundedRect(
          artifact.x + inset,
          y,
          artifact.width - inset * 2,
          layerHeight - 2,
          2
        );
      graphics
        .lineStyle(1.5, c.washiDim, 0.72)
        .lineBetween(
          artifact.x + inset + 8,
          y + 2,
          artifact.x + artifact.width - inset - 8,
          y + 2
        );
    }
    graphics
      .lineStyle(2, c.goldDeep, 0.9)
      .lineBetween(
        artifact.x + artifact.width / 2,
        artifact.y,
        artifact.x + artifact.width / 2,
        artifact.y + artifact.height
      );
  } else if (artifact.type === 'mercy_nail') {
    const headWidth = Math.min(14, artifact.width * 0.24);
    graphics
      .fillStyle(c.ink, 1)
      .fillRoundedRect(artifact.x, artifact.y - 2, headWidth, artifact.height + 4, 3);
    graphics
      .fillStyle(c.gold, 1)
      .fillRoundedRect(
        artifact.x + headWidth - 2,
        artifact.y,
        artifact.width - headWidth + 2,
        Math.min(9, artifact.height),
        2
      );
    graphics.fillStyle(c.goldDeep, 0.95).fillTriangle(
      artifact.x + headWidth,
      artifact.y + Math.min(8, artifact.height),
      artifact.x + artifact.width - 3,
      artifact.y + Math.min(8, artifact.height),
      artifact.x + headWidth,
      artifact.y + artifact.height
    );
    graphics
      .lineStyle(2, c.washi, 0.9)
      .lineBetween(
        artifact.x + headWidth + 3,
        artifact.y + 3,
        artifact.x + artifact.width - 4,
        artifact.y + 3
      );
  } else if (artifact.type === 'ghost_platform') {
    const drift = options.reducedMotion ? 0 : Math.sin(options.timeMs / 650) * 1.5;
    graphics
      .fillStyle(c.ghost, 0.58)
      .fillRoundedRect(artifact.x, artifact.y + drift, artifact.width, 7, 3);
    graphics
      .lineStyle(2, c.ghost, 0.98)
      .lineBetween(
        artifact.x,
        artifact.y + drift,
        artifact.x + artifact.width,
        artifact.y + drift
      );
    graphics.fillStyle(c.ghostDeep, 0.58);
    graphics.fillTriangle(
      artifact.x + artifact.width * 0.18,
      artifact.y + 7 + drift,
      artifact.x + artifact.width * 0.33,
      artifact.y + artifact.height + drift,
      artifact.x + artifact.width * 0.44,
      artifact.y + 7 + drift
    );
    graphics.fillTriangle(
      artifact.x + artifact.width * 0.58,
      artifact.y + 7 + drift,
      artifact.x + artifact.width * 0.72,
      artifact.y + artifact.height + drift,
      artifact.x + artifact.width * 0.84,
      artifact.y + 7 + drift
    );
  } else {
    const wobble = options.reducedMotion ? 0 : Math.sin(options.timeMs / 70) * 0.8;
    graphics
      .fillStyle(c.ink, 0.95)
      .fillRect(artifact.x + wobble, artifact.y + 5, artifact.width, artifact.height);
    graphics
      .fillStyle(c.burgundy, 1)
      .fillRect(artifact.x + wobble, artifact.y, artifact.width, artifact.height - 4);
    graphics
      .fillStyle(c.danger, 1)
      .fillRect(artifact.x + wobble + 4, artifact.y, artifact.width - 8, 4);
    for (let i = 0; i < 3; i += 1) {
      const x = artifact.x + wobble + 8 + i * ((artifact.width - 16) / 2);
      graphics.fillStyle(c.ink, 1).fillTriangle(
        x - 4,
        artifact.y + artifact.height - 4,
        x + 4,
        artifact.y + artifact.height - 4,
        x,
        artifact.y + artifact.height + 7
      );
    }
    graphics
      .lineStyle(2, c.ink, 0.9)
      .lineBetween(
        artifact.x + artifact.width * 0.46 + wobble,
        artifact.y + 2,
        artifact.x + artifact.width * 0.56 + wobble,
        artifact.y + artifact.height - 6
      );
  }

  options.addLabel(
    artifact.x + artifact.width / 2,
    artifact.y - 6,
    artifact.label
  );
}
