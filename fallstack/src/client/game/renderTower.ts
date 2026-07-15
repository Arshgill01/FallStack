import type Phaser from 'phaser';
import type { Platform } from '../../shared/game/tower.js';
import {
  RELIQUARY_COLORS,
  type ReliquaryZone,
} from './art-direction.js';

export function renderReliquaryBackdrop(
  graphics: Phaser.GameObjects.Graphics,
  input: {
    zoneTop: number;
    zoneBottom: number;
    gameWidth: number;
    routeOffset: number;
    zone: ReliquaryZone;
  }
): void {
  const c = RELIQUARY_COLORS;
  const routeLeft = input.routeOffset;
  const routeRight = routeLeft + 480;
  const height = input.zoneBottom - input.zoneTop;
  graphics.fillStyle(c.indigoDeep, 1).fillRect(0, input.zoneTop, input.gameWidth, height);
  graphics
    .fillStyle(c.burgundyDeep, 1)
    .fillRect(routeLeft + 14, input.zoneTop, 452, height);

  // Nested wall planes give the moving camera a persistent sense of depth.
  graphics.fillStyle(c.ink, 0.28);
  graphics.fillRect(routeLeft + 34, input.zoneTop, 24, height);
  graphics.fillRect(routeRight - 58, input.zoneTop, 24, height);
  graphics.fillStyle(c.burgundy, 0.18);
  graphics.fillRect(routeLeft + 58, input.zoneTop, 9, height);
  graphics.fillRect(routeRight - 67, input.zoneTop, 9, height);

  graphics.fillStyle(c.washiDim, 1);
  graphics.fillRect(routeLeft + 5, input.zoneTop, 8, height);
  graphics.fillRect(routeRight - 13, input.zoneTop, 8, height);
  graphics.fillStyle(c.indigo, 1);
  graphics.fillRect(routeLeft + 13, input.zoneTop, 20, height);
  graphics.fillRect(routeRight - 33, input.zoneTop, 20, height);
  graphics.fillStyle(c.goldDeep, 0.8);
  graphics.fillRect(routeLeft + 31, input.zoneTop, 3, height);
  graphics.fillRect(routeRight - 34, input.zoneTop, 3, height);

  const archSpacing =
    input.zone === 'lower_ruins' ? 520 : input.zone === 'bell_shaft' ? 460 : 620;
  const archWidth = input.zone === 'bell_shaft' ? 286 : 350;
  for (
    let y = input.zoneTop + 260;
    y < input.zoneBottom;
    y += archSpacing
  ) {
    const cx = routeLeft + 240;
    graphics.lineStyle(22, c.indigo, 0.72);
    graphics.beginPath();
    graphics.arc(cx, y, archWidth / 2, Math.PI, Math.PI * 2);
    graphics.strokePath();
    graphics.lineStyle(4, c.goldDeep, 0.42);
    graphics.beginPath();
    graphics.arc(cx, y, archWidth / 2 - 15, Math.PI, Math.PI * 2);
    graphics.strokePath();
    graphics.fillStyle(c.indigo, 0.64);
    graphics.fillRect(cx - archWidth / 2 - 11, y, 22, 210);
    graphics.fillRect(cx + archWidth / 2 - 11, y, 22, 210);
  }

  // Broken cross-ties and recessed seams stop long climbs reading as an empty
  // painted shaft. Their stagger preserves the central jump silhouette.
  const seamSpacing = input.zone === 'bell_shaft' ? 170 : 210;
  for (
    let y = input.zoneTop + 110;
    y < input.zoneBottom;
    y += seamSpacing
  ) {
    const stagger = Math.floor((y - input.zoneTop) / seamSpacing) % 2;
    const left = routeLeft + 54 + stagger * 22;
    const right = routeRight - 54 - (1 - stagger) * 28;
    graphics.lineStyle(2, c.indigoLit, 0.2);
    graphics.lineBetween(left, y, right, y - 12);
    graphics.fillStyle(c.indigo, 0.34);
    graphics.fillTriangle(left - 16, y - 10, left + 10, y, left - 16, y + 18);
    graphics.fillTriangle(right + 16, y - 22, right - 10, y - 12, right + 16, y + 6);
  }

  if (input.zone === 'lower_ruins') {
    const repairY = input.zoneBottom - 430;
    graphics.fillStyle(c.washiDim, 0.16).fillRect(routeLeft + 56, repairY, 126, 54);
    graphics.lineStyle(3, c.gold, 0.34);
    graphics.lineBetween(routeLeft + 62, repairY + 12, routeLeft + 174, repairY + 38);
  } else if (input.zone === 'bell_shaft') {
    for (let x = routeLeft + 88; x <= routeRight - 88; x += 76) {
      graphics.lineStyle(3, c.goldDeep, 0.42);
      graphics.lineBetween(x, input.zoneTop, x, input.zoneBottom);
      for (let y = input.zoneTop + 320; y < input.zoneBottom; y += 920) {
        graphics.fillStyle(c.gold, 0.22).fillEllipse(x, y, 32, 44);
        graphics.fillStyle(c.indigoDeep, 0.8).fillEllipse(x, y + 4, 18, 28);
      }
    }
  } else {
    for (let x = routeLeft + 42; x < routeRight - 42; x += 54) {
      graphics.fillStyle(c.indigoLit, 0.52).fillTriangle(
        x,
        input.zoneTop + 72,
        x + 27,
        input.zoneTop + 18,
        x + 54,
        input.zoneTop + 72
      );
    }
    graphics.lineStyle(4, c.ghost, 0.2);
    for (let y = input.zoneTop + 420; y < input.zoneBottom; y += 980) {
      graphics.lineBetween(routeLeft + 60, y, routeRight - 90, y - 110);
    }
  }
}

export function renderReliquaryPlatform(
  graphics: Phaser.GameObjects.Graphics,
  platform: Platform
): void {
  const c = RELIQUARY_COLORS;
  const obstacle = platform.kind === 'obstacle';
  if (obstacle) {
    graphics.fillStyle(c.ink, 0.95).fillRect(
      platform.x + 3,
      platform.y + 2,
      platform.width,
      platform.height
    );
    graphics.fillStyle(c.indigo, 1).fillRect(
      platform.x,
      platform.y,
      platform.width,
      platform.height
    );
    graphics
      .lineStyle(2, c.goldDeep, 0.8)
      .lineBetween(
        platform.x + platform.width / 2,
        platform.y + 6,
        platform.x + platform.width / 2,
        platform.y + platform.height - 6
      );
    return;
  }

  const checkpoint = platform.id.includes('checkpoint');
  const summit = platform.kind === 'summit';
  const metal = platform.kind === 'metal';
  const moon = platform.kind === 'moon' || summit;
  const underface = Math.max(12, platform.height - 5);
  graphics
    .fillStyle(c.ink, 0.96)
    .fillRect(platform.x + 3, platform.y + 5, platform.width, underface + 3);
  graphics
    .fillStyle(summit ? c.goldDeep : metal ? c.indigoLit : c.indigo, 1)
    .fillRect(platform.x, platform.y + 4, platform.width, underface);
  graphics
    .fillStyle(
      checkpoint ? c.gold : moon ? c.ghost : metal ? c.goldDeep : c.washiDim,
      1
    )
    .fillRect(platform.x, platform.y, platform.width, 6);
  graphics
    .fillStyle(c.indigoLit, 0.65)
    .fillRect(platform.x + 6, platform.y + 7, platform.width - 12, 3);

  if (platform.width >= 84) {
    const braceInset = Math.min(24, platform.width * 0.22);
    graphics.fillStyle(c.ink, 0.9);
    graphics.fillTriangle(
      platform.x + braceInset - 6,
      platform.y + platform.height,
      platform.x + braceInset + 7,
      platform.y + platform.height,
      platform.x + braceInset - 3,
      platform.y + platform.height + 8
    );
    graphics.fillTriangle(
      platform.x + platform.width - braceInset - 7,
      platform.y + platform.height,
      platform.x + platform.width - braceInset + 6,
      platform.y + platform.height,
      platform.x + platform.width - braceInset + 3,
      platform.y + platform.height + 8
    );
  }

  const chipSide = stableChipSide(platform.id);
  const chipX = chipSide === 'left' ? platform.x : platform.x + platform.width - 10;
  graphics.fillStyle(c.burgundyDeep, 1).fillTriangle(
    chipX,
    platform.y,
    chipX + 10,
    platform.y,
    chipSide === 'left' ? chipX : chipX + 10,
    platform.y + 7
  );

  if (checkpoint) {
    const center = platform.x + platform.width / 2;
    const gateHeight = 32;
    graphics.fillStyle(c.indigoDeep, 1);
    graphics.fillRect(platform.x + 8, platform.y - gateHeight, 7, gateHeight);
    graphics.fillRect(
      platform.x + platform.width - 15,
      platform.y - gateHeight,
      7,
      gateHeight
    );
    graphics
      .fillStyle(c.gold, 1)
      .fillRect(
        platform.x + 5,
        platform.y - gateHeight,
        platform.width - 10,
        5
      );
    graphics.fillStyle(c.gold, 1).fillRect(center - 3, platform.y + 5, 6, underface);
    graphics
      .lineStyle(2, c.washi, 0.75)
      .lineBetween(center, platform.y - 12, center, platform.y);
  }

  if (metal && !checkpoint) {
    for (let x = platform.x + 12; x < platform.x + platform.width - 8; x += 28) {
      graphics.fillStyle(c.gold, 0.72).fillCircle(x, platform.y + 10, 2.2);
    }
  }

  if (!metal && !moon && !checkpoint) {
    const repairX = platform.x + 18 + stableRepairOffset(platform.id, platform.width);
    graphics.fillStyle(c.goldDeep, 0.86).fillRect(repairX, platform.y, 5, 15);
    graphics.fillStyle(c.gold, 0.72).fillCircle(repairX + 2.5, platform.y + 4, 1.5);
  }

  if (moon && !checkpoint) {
    graphics.lineStyle(2, c.ghost, 0.55);
    graphics.lineBetween(
      platform.x + 8,
      platform.y + 12,
      platform.x + platform.width - 8,
      platform.y + 8
    );
  }

  if (summit) {
    const center = platform.x + platform.width / 2;
    graphics.lineStyle(5, c.gold, 0.9);
    graphics.beginPath();
    graphics.arc(center, platform.y - 4, 38, Math.PI, Math.PI * 2);
    graphics.strokePath();
    graphics.fillStyle(c.persimmon, 1).fillCircle(center, platform.y - 35, 7);
    graphics.fillStyle(c.washi, 0.9).fillCircle(center, platform.y - 35, 2.5);
  }
}

function stableChipSide(id: string): 'left' | 'right' {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'left' : 'right';
}

function stableRepairOffset(id: string, width: number): number {
  let hash = 7;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 33 + id.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) % Math.max(1, Math.floor(width - 46));
}
