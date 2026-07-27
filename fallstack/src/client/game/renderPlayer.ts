import type Phaser from 'phaser';
import {
  playerVisualDimensions,
  playerVisualRotation,
  playerVisualState,
  RELIQUARY_COLORS,
  type PlayerCeremonyState,
  type PlayerVisualState,
} from './art-direction.js';

type Point = { x: number; y: number };

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
    ceremony?: PlayerCeremonyState | null;
    ceremonyProgress?: number;
    ceremonyStrength?: number;
  }
): void {
  const c = RELIQUARY_COLORS;
  const state = playerVisualState(input);
  const progress = clamp(input.ceremonyProgress ?? 1);
  const strength = clamp(input.ceremonyStrength ?? 1);
  const base = playerVisualDimensions(state);
  const charge = state === 'charge' ? clamp(input.chargeRatio) : 0;
  const width = base.width + charge * 2;
  const height = base.height - charge * 3;
  const feetY = input.y + 14;
  const top = feetY - height;
  const bodyTop = top + (state === 'land' ? 12 : 15);
  const bodyWidth = width - (state === 'rising' ? 5 : 3);
  const hoodShiftX =
    state === 'charge'
      ? input.facing * (1 + charge)
      : state === 'fall'
        ? -input.facing * 1.5
        : state === 'rising'
          ? input.facing
          : 0;

  graphics.setRotation(
    playerVisualRotation(state, input.facing, input.reducedMotion)
  );
  graphics.setAlpha(
    state === 'respawn' && !input.reducedMotion ? 0.42 + progress * 0.58 : 1
  );

  drawCeremonyMark(graphics, {
    x: input.x,
    top,
    feetY,
    state,
    progress,
    strength,
    reducedMotion: input.reducedMotion,
  });

  const airborne =
    state === 'rising' || state === 'apex' || state === 'fall';
  const sleeveReach =
    state === 'fall' ? 6 : state === 'apex' ? 4 : state === 'rising' ? 2 : 0;
  const hemLift = airborne ? (state === 'fall' ? 5 : 3) : 0;
  const cloakBottom = feetY - 3 - hemLift;

  drawArchivePack(graphics, {
    x: input.x,
    y: bodyTop + 4,
    bodyWidth,
    facing: input.facing,
    airborne,
  });

  if (sleeveReach > 0) {
    fillPolygon(graphics, c.ink, 0.96, [
      { x: input.x - bodyWidth / 2, y: bodyTop + 4 },
      { x: input.x - bodyWidth / 2 - sleeveReach, y: bodyTop + 11 },
      { x: input.x - bodyWidth / 2 + 2, y: bodyTop + 13 },
    ]);
    fillPolygon(graphics, c.ink, 0.96, [
      { x: input.x + bodyWidth / 2, y: bodyTop + 4 },
      { x: input.x + bodyWidth / 2 + sleeveReach, y: bodyTop + 11 },
      { x: input.x + bodyWidth / 2 - 2, y: bodyTop + 13 },
    ]);
  }

  const cloakOutline: Point[] = [
    { x: input.x - bodyWidth / 2 - 1, y: bodyTop - 1 },
    { x: input.x + bodyWidth / 2 + 1, y: bodyTop - 1 },
    { x: input.x + width / 2, y: cloakBottom - 3 },
    { x: input.x + width / 2 - 3, y: cloakBottom + 1 },
    { x: input.x + 3, y: cloakBottom },
    { x: input.x, y: cloakBottom + 2 },
    { x: input.x - 4, y: cloakBottom },
    { x: input.x - width / 2 + 2, y: cloakBottom + 1 },
    { x: input.x - width / 2, y: cloakBottom - 3 },
  ];
  fillPolygon(graphics, c.ink, 0.98, cloakOutline);

  const cloak: Point[] = cloakOutline.map((point, index) => ({
    x:
      point.x +
      (point.x < input.x ? 1.5 : point.x > input.x ? -1.5 : 0),
    y: point.y + (index < 2 ? 1.5 : 0),
  }));
  fillPolygon(graphics, c.indigo, 1, cloak);

  graphics
    .lineStyle(1, c.indigoLit, 0.82)
    .lineBetween(input.x - bodyWidth / 2 + 3, bodyTop + 3, input.x - 4, cloakBottom - 2)
    .lineBetween(input.x + bodyWidth / 2 - 3, bodyTop + 3, input.x + 5, cloakBottom - 2);
  graphics
    .lineStyle(1, c.ink, 0.72)
    .lineBetween(input.x, bodyTop + 5, input.x, cloakBottom);

  const hoodCenterX = input.x + hoodShiftX;
  const hoodWidth =
    state === 'charge' || state === 'land' ? width - 2 : width - 4;
  const hoodBottom = bodyTop + 2;
  const hoodOutline: Point[] = [
    { x: hoodCenterX, y: top - 2 },
    { x: hoodCenterX + hoodWidth / 2, y: top + 5 },
    { x: hoodCenterX + hoodWidth / 2 - 1, y: top + 12 },
    { x: hoodCenterX + 7, y: hoodBottom },
    { x: hoodCenterX - 7, y: hoodBottom },
    { x: hoodCenterX - hoodWidth / 2 + 1, y: top + 12 },
    { x: hoodCenterX - hoodWidth / 2, y: top + 5 },
  ];
  fillPolygon(graphics, c.ink, 1, hoodOutline);

  const hood: Point[] = [
    { x: hoodCenterX, y: top },
    { x: hoodCenterX + hoodWidth / 2 - 2, y: top + 6 },
    { x: hoodCenterX + hoodWidth / 2 - 3, y: top + 11 },
    { x: hoodCenterX + 6, y: hoodBottom - 2 },
    { x: hoodCenterX - 6, y: hoodBottom - 2 },
    { x: hoodCenterX - hoodWidth / 2 + 3, y: top + 11 },
    { x: hoodCenterX - hoodWidth / 2 + 2, y: top + 6 },
  ];
  fillPolygon(graphics, c.washi, 1, hood);

  graphics
    .lineStyle(1, c.washiDim, 0.95)
    .lineBetween(hoodCenterX, top + 1, hoodCenterX - 6, top + 8)
    .lineBetween(hoodCenterX, top + 1, hoodCenterX + 6, top + 8)
    .lineBetween(hoodCenterX - 6, top + 8, hoodCenterX - 7, hoodBottom - 2)
    .lineBetween(hoodCenterX + 6, top + 8, hoodCenterX + 7, hoodBottom - 2);

  const faceTop = top + 6;
  fillPolygon(graphics, c.indigoDeep, 1, [
    { x: hoodCenterX - 7, y: faceTop + 2 },
    { x: hoodCenterX, y: faceTop - 2 },
    { x: hoodCenterX + 7, y: faceTop + 2 },
    { x: hoodCenterX + 6, y: faceTop + 8 },
    { x: hoodCenterX - 6, y: faceTop + 8 },
  ]);

  graphics
    .fillStyle(c.washiDim, 1)
    .fillRect(
      hoodCenterX - input.facing * 4.5 - 1,
      faceTop + 1,
      2,
      5
    )
    .fillStyle(c.gold, 1)
    .fillCircle(hoodCenterX + input.facing * 3, faceTop + 4, 1.45)
    .lineStyle(0.75, c.goldDeep, 1)
    .strokeCircle(hoodCenterX + input.facing * 3, faceTop + 4, 1.8);

  const tieX = hoodCenterX - input.facing * 7;
  fillPolygon(graphics, c.washiDim, 1, [
    { x: tieX, y: hoodBottom - 3 },
    { x: tieX - input.facing * 5, y: hoodBottom + (airborne ? 3 : 1) },
    { x: tieX - input.facing * 1, y: hoodBottom + 5 },
  ]);

  const cordY = bodyTop + 8;
  graphics
    .lineStyle(1.5, c.gold, 1)
    .lineBetween(input.x - bodyWidth / 2 + 1, cordY, input.x + bodyWidth / 2 - 1, cordY)
    .fillStyle(c.goldDeep, 1)
    .fillCircle(input.x + input.facing * (bodyWidth / 2 - 2), cordY, 1.7);

  drawPrayerStrip(graphics, {
    x: input.x,
    y: bodyTop + 2,
    bottom: cloakBottom - 1,
    facing: input.facing,
    state,
    charge,
  });

  drawFeet(graphics, {
    x: input.x,
    feetY,
    state,
    facing: input.facing,
    width,
  });

  if (state === 'charge') {
    const marks = Math.max(1, Math.ceil(charge * 3));
    for (let index = 0; index < 3; index += 1) {
      const active = index < marks;
      graphics
        .fillStyle(active ? c.persimmon : c.goldDeep, active ? 0.7 + index * 0.14 : 0.38)
        .fillTriangle(
          input.x - 10 + index * 8,
          feetY + 4,
          input.x - 5 + index * 8,
          feetY + 4,
          input.x - 7.5 + index * 8,
          feetY + 1
        );
    }
  }
}

function drawArchivePack(
  graphics: Phaser.GameObjects.Graphics,
  input: {
    x: number;
    y: number;
    bodyWidth: number;
    facing: -1 | 1;
    airborne: boolean;
  }
): void {
  const c = RELIQUARY_COLORS;
  const packX = input.x - input.facing * (input.bodyWidth / 2 + 1);
  const packY = input.y + (input.airborne ? -1 : 0);
  graphics
    .fillStyle(c.ink, 1)
    .fillRect(packX - 4.5, packY - 1, 9, 13)
    .fillStyle(c.washiDim, 1)
    .fillRect(packX - 3.5, packY, 7, 11)
    .lineStyle(1, c.goldDeep, 1)
    .strokeRect(packX - 3.5, packY, 7, 11)
    .lineBetween(packX - 2, packY + 3, packX + 2.5, packY + 2)
    .lineBetween(packX - 2, packY + 7, packX + 2.5, packY + 6)
    .lineStyle(1, c.gold, 1)
    .lineBetween(packX, packY - 1, packX, packY + 12)
    .fillStyle(c.goldDeep, 1)
    .fillCircle(packX + input.facing * 2.5, packY + 6, 1.5);
}

function drawPrayerStrip(
  graphics: Phaser.GameObjects.Graphics,
  input: {
    x: number;
    y: number;
    bottom: number;
    facing: -1 | 1;
    state: PlayerVisualState;
    charge: number;
  }
): void {
  const c = RELIQUARY_COLORS;
  const lift =
    input.state === 'rising'
      ? -input.facing * 4
      : input.state === 'fall'
        ? input.facing * 4
        : input.state === 'apex'
          ? -input.facing * 2
          : input.state === 'charge'
            ? input.facing * input.charge * 2
            : 0;
  const stripWidth = input.state === 'charge' ? 6 : 5;
  fillPolygon(graphics, c.ink, 1, [
    { x: input.x - stripWidth / 2 - 1, y: input.y - 1 },
    { x: input.x + stripWidth / 2 + 1, y: input.y - 1 },
    { x: input.x + lift + stripWidth / 2 + 1, y: input.bottom + 1 },
    { x: input.x + lift - stripWidth / 2 - 1, y: input.bottom + 1 },
  ]);
  fillPolygon(graphics, c.persimmon, 1, [
    { x: input.x - stripWidth / 2, y: input.y },
    { x: input.x + stripWidth / 2, y: input.y },
    { x: input.x + lift + stripWidth / 2, y: input.bottom },
    { x: input.x + lift - stripWidth / 2, y: input.bottom },
  ]);
  const markX = input.x + lift * 0.45;
  graphics
    .lineStyle(1, c.persimmonDeep, 1)
    .lineBetween(markX - 1.2, input.y + 4, markX + 1.2, input.y + 3)
    .lineBetween(markX - 1, input.y + 7, markX + 1.3, input.y + 8);
}

function drawFeet(
  graphics: Phaser.GameObjects.Graphics,
  input: {
    x: number;
    feetY: number;
    state: PlayerVisualState;
    facing: -1 | 1;
    width: number;
  }
): void {
  const c = RELIQUARY_COLORS;
  if (
    input.state === 'grounded' ||
    input.state === 'charge' ||
    input.state === 'land' ||
    input.state === 'checkpoint' ||
    input.state === 'summit' ||
    input.state === 'respawn'
  ) {
    const spread =
      input.state === 'charge' || input.state === 'land'
        ? input.width / 2 - 3
        : 6;
    graphics
      .fillStyle(c.ink, 1)
      .fillRect(input.x - spread - 2, input.feetY - 3, 7, 4)
      .fillRect(input.x + spread - 5, input.feetY - 3, 7, 4)
      .fillStyle(c.washiDim, 1)
      .fillRect(input.x - spread - 1, input.feetY - 2, 5, 2)
      .fillRect(input.x + spread - 4, input.feetY - 2, 5, 2);
    return;
  }

  const spread = input.state === 'fall' ? 11 : input.state === 'apex' ? 8 : 5;
  graphics
    .lineStyle(3, c.ink, 1)
    .lineBetween(input.x - 3, input.feetY - 7, input.x - spread, input.feetY)
    .lineBetween(input.x + 3, input.feetY - 7, input.x + spread, input.feetY)
    .lineStyle(1.5, c.washiDim, 1)
    .lineBetween(input.x - spread, input.feetY, input.x - spread - input.facing * 3, input.feetY)
    .lineBetween(input.x + spread, input.feetY, input.x + spread - input.facing * 3, input.feetY);
}

function drawCeremonyMark(
  graphics: Phaser.GameObjects.Graphics,
  input: {
    x: number;
    top: number;
    feetY: number;
    state: PlayerVisualState;
    progress: number;
    strength: number;
    reducedMotion: boolean;
  }
): void {
  const c = RELIQUARY_COLORS;
  const motionProgress = input.reducedMotion ? 1 : input.progress;

  if (input.state === 'land') {
    const reach = 9 + input.strength * 7;
    graphics
      .lineStyle(1.5, c.washiDim, 0.72)
      .lineBetween(input.x - 4, input.feetY + 1, input.x - reach, input.feetY + 4)
      .lineBetween(input.x + 4, input.feetY + 1, input.x + reach, input.feetY + 4);
    if (!input.reducedMotion) {
      graphics
        .fillStyle(c.washiDim, 0.7)
        .fillTriangle(input.x - reach, input.feetY + 1, input.x - reach - 3, input.feetY - 3, input.x - reach - 1, input.feetY + 4)
        .fillTriangle(input.x + reach, input.feetY + 1, input.x + reach + 3, input.feetY - 4, input.x + reach + 1, input.feetY + 4);
    }
    return;
  }

  if (input.state === 'respawn') {
    const inset = (1 - motionProgress) * 5;
    graphics
      .lineStyle(2, c.washiDim, 0.42 + motionProgress * 0.45)
      .strokeCircle(input.x, input.top + 15, 14 - inset)
      .lineBetween(input.x - 14 + inset, input.top + 15, input.x - 14 + inset, input.feetY + 2)
      .lineBetween(input.x + 14 - inset, input.top + 15, input.x + 14 - inset, input.feetY + 2)
      .lineStyle(1, c.goldDeep, 0.75)
      .lineBetween(input.x - 10, input.feetY + 2, input.x + 10, input.feetY + 2);
    return;
  }

  if (input.state === 'checkpoint') {
    const radius = 15 + motionProgress * 2;
    graphics
      .lineStyle(2, c.gold, 0.6 + motionProgress * 0.35)
      .strokeCircle(input.x, input.top + 17, radius)
      .lineStyle(1, c.washiDim, 0.75)
      .strokeCircle(input.x, input.top + 17, radius - 4);
    for (let index = 0; index < 4; index += 1) {
      const angle = index * (Math.PI / 2);
      graphics.lineBetween(
        input.x + Math.cos(angle) * (radius + 2),
        input.top + 17 + Math.sin(angle) * (radius + 2),
        input.x + Math.cos(angle) * (radius + 6),
        input.top + 17 + Math.sin(angle) * (radius + 6)
      );
    }
    return;
  }

  if (input.state === 'summit') {
    const reach = 17 + motionProgress * 4;
    graphics.lineStyle(2, c.gold, 0.9);
    for (const offset of [-1, -0.55, 0, 0.55, 1]) {
      const angle = -Math.PI / 2 + offset * 0.72;
      graphics.lineBetween(
        input.x + Math.cos(angle) * 14,
        input.top + 12 + Math.sin(angle) * 14,
        input.x + Math.cos(angle) * reach,
        input.top + 12 + Math.sin(angle) * reach
      );
    }
  }
}

function fillPolygon(
  graphics: Phaser.GameObjects.Graphics,
  color: number,
  alpha: number,
  points: Point[]
): void {
  const [first, ...rest] = points;
  if (!first) return;
  graphics.fillStyle(color, alpha).beginPath().moveTo(first.x, first.y);
  for (const point of rest) graphics.lineTo(point.x, point.y);
  graphics.closePath().fillPath();
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
