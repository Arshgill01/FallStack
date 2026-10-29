import type Phaser from 'phaser';
import {
  biomeForZone,
  hashString,
  VENT_TUNING,
  ventStrengthAt,
  type BiomeDefinition,
  type GustState,
  type VentColumn,
} from '../../shared/game/biomes.js';
import type { PowerUpKind, PowerUpPickup } from '../../shared/game/powerups.js';
import type { Platform } from '../../shared/game/tower.js';
import type { ZoneId } from '../../shared/game/zones.js';
import { ROUTE_PLAYABLE_INSET } from './layout.js';

const INK = 0x16111a;
const BONE = 0xf3ebdd;

export const POWER_UP_COLORS: Record<PowerUpKind, number> = {
  spark: 0xff7a3d,
  updraft: 0x8fa8ff,
  second_wind: 0x3fd1b5,
  thread: 0xe8c35a,
};

// ── Backdrops ────────────────────────────────────────────────────────────────

export function renderBiomeBackdrop(
  g: Phaser.GameObjects.Graphics,
  input: {
    zoneId: ZoneId;
    zoneTop: number;
    zoneBottom: number;
    gameWidth: number;
    routeOffset: number;
  }
): void {
  const biome = biomeForZone(input.zoneId);
  const p = biome.palette;
  const top = input.zoneTop;
  const height = input.zoneBottom - input.zoneTop;
  const left = input.routeOffset;
  const right = left + 480;

  g.fillStyle(p.near, 1).fillRect(0, top, input.gameWidth, height);
  g.fillStyle(p.sky, 1).fillRect(left + 14, top, 452, height);

  const scene = { g, biome, top, bottom: input.zoneBottom, left, right, seed: input.zoneId };
  if (biome.id === 'kiln_hollow') drawKilnBackdrop(scene);
  else if (biome.id === 'tidewell') drawTidewellBackdrop(scene);
  else if (biome.id === 'gale_loom') drawLoomBackdrop(scene);
  else if (biome.id === 'rime_archive') drawRimeBackdrop(scene);
  else drawOrreryBackdrop(scene);

  // Hard paper-cut walls frame every biome the same way, so the shaft edges
  // read identically whichever stratum the camera is in.
  g.fillStyle(INK, 1);
  g.fillRect(left + 5, top, 9, height);
  g.fillRect(right - 14, top, 9, height);
  g.fillStyle(p.near, 1);
  g.fillRect(left + 14, top, 20, height);
  g.fillRect(right - 34, top, 20, height);
  g.fillStyle(p.accent, 0.5);
  g.fillRect(left + ROUTE_PLAYABLE_INSET - 3, top, 3, height);
  g.fillRect(right - ROUTE_PLAYABLE_INSET, top, 3, height);
}

type BackdropScene = {
  g: Phaser.GameObjects.Graphics;
  biome: BiomeDefinition;
  top: number;
  bottom: number;
  left: number;
  right: number;
  seed: string;
};

function drawKilnBackdrop({ g, biome, top, bottom, left, right, seed }: BackdropScene) {
  const p = biome.palette;
  // Fired-brick arches with glowing kiln mouths at their feet.
  for (let y = top + 300; y < bottom + 200; y += 560) {
    const cx = left + 240;
    g.lineStyle(26, p.far, 1);
    g.beginPath().arc(cx, y, 168, Math.PI, Math.PI * 2).strokePath();
    g.fillStyle(p.far, 1).fillRect(cx - 181, y, 26, 240).fillRect(cx + 155, y, 26, 240);
    g.fillStyle(p.accent, 0.16).fillEllipse(cx - 168, y + 236, 70, 26);
    g.fillStyle(p.accent, 0.16).fillEllipse(cx + 168, y + 236, 70, 26);
  }
  // Brick courses on the walls.
  g.lineStyle(1, p.ledgeShade, 0.9);
  for (let y = top + 8; y < bottom; y += 18) {
    g.lineBetween(left + 34, y, left + 58, y);
    g.lineBetween(right - 58, y, right - 34, y);
  }
  scatter(seed, top, bottom, left, 24, (x, y, r) => {
    g.fillStyle(p.accentLit, 0.35 + (r % 5) / 12).fillCircle(x, y, 1.2 + (r % 3) * 0.5);
  });
}

function drawTidewellBackdrop({ g, biome, top, bottom, left, right, seed }: BackdropScene) {
  const p = biome.palette;
  // Verdigris pipes and slow standing-wave lines.
  for (const x of [left + 92, left + 240, left + 388]) {
    g.fillStyle(p.far, 1).fillRect(x - 9, top, 18, bottom - top);
    g.fillStyle(p.near, 1);
    for (let y = top + 60; y < bottom; y += 240) g.fillRect(x - 12, y, 24, 8);
  }
  g.lineStyle(2, p.accent, 0.18);
  for (let y = top + 180; y < bottom; y += 360) {
    g.beginPath().moveTo(left + 34, y);
    for (let x = left + 34; x <= right - 34; x += 24) {
      g.lineTo(x, y + Math.sin((x - left) / 24) * 5);
    }
    g.strokePath();
  }
  scatter(seed, top, bottom, left, 18, (x, y, r) => {
    g.lineStyle(1, p.accentLit, 0.3).strokeCircle(x, y, 2 + (r % 4));
  });
}

function drawLoomBackdrop({ g, biome, top, bottom, left, right, seed }: BackdropScene) {
  const p = biome.palette;
  // Warp threads stretched the full height of the shaft.
  g.lineStyle(2, p.far, 0.85);
  for (let x = left + 60; x < right - 40; x += 26) g.lineBetween(x, top, x, bottom);
  // Heddle bars every few hundred pixels.
  for (let y = top + 220; y < bottom; y += 480) {
    g.fillStyle(p.far, 1).fillRect(left + 34, y, 412, 7);
    g.fillStyle(p.ledgeLit, 0.25).fillRect(left + 34, y, 412, 2);
  }
  // Cloth banners hang off the walls.
  scatter(seed, top, bottom, left, 5, (_x, y, r) => {
    const side = r % 2 === 0 ? left + 34 : right - 34 - 26;
    g.fillStyle(p.accent, 0.3)
      .beginPath()
      .moveTo(side, y)
      .lineTo(side + 26, y)
      .lineTo(side + 26, y + 70)
      .lineTo(side + 13, y + 58)
      .lineTo(side, y + 70)
      .closePath()
      .fillPath();
  });
}

function drawRimeBackdrop({ g, biome, top, bottom, left, right, seed }: BackdropScene) {
  const p = biome.palette;
  // Frozen shelves of books lining both walls.
  for (let y = top + 40; y < bottom; y += 120) {
    for (const [from, to] of [
      [left + 34, left + 78],
      [right - 78, right - 34],
    ] as const) {
      g.fillStyle(p.far, 1).fillRect(from, y + 40, to - from, 5);
      let x = from + 2;
      let r = hashString(`${seed}:${y}:${from}`);
      while (x < to - 4) {
        const w = 4 + (r % 4);
        const h = 22 + (r % 15);
        g.fillStyle(r % 3 === 0 ? p.near : p.far, 1).fillRect(x, y + 40 - h, w, h);
        x += w + 1;
        r = Math.imul(r ^ (r >>> 13), 2654435761) >>> 0;
      }
      for (let ix = from + 4; ix < to; ix += 9)
        g.fillStyle(p.accent, 0.55).fillTriangle(ix, y + 45, ix + 4, y + 45, ix + 2, y + 52 + (ix % 5));
    }
  }
  // Frost hatching in the cavity.
  g.lineStyle(1, p.accent, 0.08);
  for (let y = top; y < bottom; y += 34) g.lineBetween(left + 80, y, left + 160, y + 80);
  scatter(seed, top, bottom, left, 14, (x, y) => drawGlint(g, x, y, 3, p.accentLit, 0.5));
}

function drawOrreryBackdrop({ g, biome, top, bottom, left, seed }: BackdropScene) {
  const p = biome.palette;
  scatter(seed, top, bottom, left, 40, (x, y, r) => {
    g.fillStyle(p.accentLit, 0.25 + (r % 6) / 10).fillCircle(x, y, 0.8 + (r % 3) * 0.5);
  });
  for (let y = top + 360; y < bottom + 200; y += 720) {
    const cx = left + 240;
    g.lineStyle(2, p.accent, 0.22).strokeEllipse(cx, y, 380, 130);
    g.lineStyle(2, p.accent, 0.16).strokeEllipse(cx, y, 230, 360);
    g.lineStyle(3, p.accent, 0.3).strokeCircle(cx, y, 38);
    g.fillStyle(p.accent, 0.45).fillCircle(cx + 190, y, 7);
    g.fillStyle(p.accentLit, 0.5).fillCircle(cx, y - 180, 5);
  }
}

// ── Ledges ───────────────────────────────────────────────────────────────────

export function renderBiomePlatform(
  g: Phaser.GameObjects.Graphics,
  platform: Platform,
  options: { spring: boolean }
): void {
  const biome = biomeForZone(platform.zoneId);
  const p = biome.palette;
  const { x, y, width: w, height: h } = platform;

  if (platform.kind === 'obstacle') {
    g.fillStyle(INK, 1).fillRect(x - 2, y - 2, w + 4, h + 4);
    g.fillStyle(p.far, 1).fillRect(x, y, w, h);
    g.fillStyle(p.accent, 0.9);
    for (let sy = y + 6; sy < y + h - 4; sy += 14) g.fillRect(x + 3, sy, w - 6, 4);
    return;
  }

  const checkpoint = platform.id.includes('checkpoint');
  const summit = platform.kind === 'summit';

  // A shared ink drop-shadow gives every ledge the same stamped-paper weight.
  g.fillStyle(INK, 1).fillRect(x + 4, y + 5, w, h);

  if (biome.id === 'kiln_hollow') {
    g.fillStyle(p.ledge, 1).fillRect(x, y, w, h);
    g.fillStyle(p.ledgeLit, 1).fillRect(x, y, w, 4);
    g.lineStyle(2, p.ledgeShade, 1).lineBetween(x, y + h / 2 + 2, x + w, y + h / 2 + 2);
    for (let bx = x + 22; bx < x + w - 6; bx += 24) {
      g.lineBetween(bx, y + 4, bx, y + h / 2 + 2);
      g.lineBetween(bx - 12, y + h / 2 + 2, bx - 12, y + h);
    }
  } else if (biome.id === 'tidewell') {
    const r = Math.min(h / 2, 11);
    g.fillStyle(options.spring ? 0x3aa58f : p.ledge, 1).fillRoundedRect(x, y, w, h, r);
    g.fillStyle(p.ledgeLit, 1).fillRoundedRect(x + 8, y + 1, w - 16, 5, 2.5);
    g.fillStyle(p.ledgeShade, 1).fillRoundedRect(x + 6, y + h - 6, w - 12, 4, 2);
    if (options.spring) {
      // Coils underneath and an up-chevron mark which ledges bounce.
      g.lineStyle(3, p.ledgeLit, 0.9);
      for (const cx of [x + w * 0.3, x + w * 0.7]) {
        g.beginPath().moveTo(cx, y + h).lineTo(cx - 5, y + h + 5).lineTo(cx + 5, y + h + 10).lineTo(cx, y + h + 14).strokePath();
      }
      const cx = x + w / 2;
      g.lineStyle(3, INK, 1).beginPath().moveTo(cx - 7, y + h - 6).lineTo(cx, y + 7).lineTo(cx + 7, y + h - 6).strokePath();
    }
  } else if (biome.id === 'gale_loom') {
    g.fillStyle(p.ledge, 1).fillRect(x, y, w, h);
    g.fillStyle(p.ledgeLit, 1).fillRect(x, y, w, 3);
    g.fillStyle(p.ledgeShade, 1).fillRect(x, y + h - 4, w, 4);
    const strips = Math.max(2, Math.floor(w / 36));
    for (let i = 0; i < strips; i++) {
      const sx = x + 12 + (i * (w - 24)) / Math.max(1, strips - 1);
      const len = 14 + (hashString(`${platform.id}:${i}`) % 16);
      g.fillStyle(i % 2 === 0 ? p.accent : 0xe95f45, 0.9).fillRect(sx - 3, y + h, 6, len);
      g.fillStyle(p.ledgeShade, 1).fillTriangle(sx - 3, y + h + len, sx + 3, y + h + len, sx, y + h + len - 4);
    }
  } else if (biome.id === 'rime_archive') {
    g.fillStyle(p.ledge, 1)
      .beginPath()
      .moveTo(x, y)
      .lineTo(x + w, y)
      .lineTo(x + w - 7, y + h)
      .lineTo(x + 7, y + h)
      .closePath()
      .fillPath();
    g.fillStyle(p.ledgeLit, 1).fillRect(x, y, w, 3);
    g.fillStyle(p.ledgeShade, 0.6).fillRect(x + 10, y + 8, w - 20, 2);
    for (let ix = x + 12; ix < x + w - 10; ix += 17) {
      const len = 6 + (hashString(`${platform.id}:${ix}`) % 12);
      g.fillStyle(p.accent, 0.95).fillTriangle(ix - 3, y + h, ix + 3, y + h, ix, y + h + len);
    }
    drawGlint(g, x + w * 0.7, y + 2, 3, BONE, 0.9);
  } else {
    const r = Math.min(h / 2, 9);
    g.fillStyle(p.ledge, 1).fillRoundedRect(x, y, w, h, r);
    g.lineStyle(3, p.accent, 1).strokeRoundedRect(x + 1.5, y + 1.5, w - 3, h - 3, r);
    for (let rx = x + 12; rx < x + w - 6; rx += 20)
      g.fillStyle(p.accentLit, 1).fillCircle(rx, y + h / 2, 2.2);
  }

  if (checkpoint) {
    const gateH = 36;
    g.fillStyle(INK, 1).fillRect(x + 6, y - gateH, 9, gateH).fillRect(x + w - 15, y - gateH, 9, gateH);
    g.fillStyle(p.accent, 1).fillRect(x + 2, y - gateH - 2, w - 4, 8);
    g.fillStyle(INK, 1).fillRect(x + 2, y - gateH + 6, w - 4, 2);
    // Pennant marks the checkpoint without relying on colour alone.
    const cx = x + w / 2;
    g.fillStyle(BONE, 1).fillTriangle(cx - 9, y - gateH + 6, cx + 9, y - gateH + 6, cx, y - gateH + 20);
  }

  if (summit) {
    const cx = x + w / 2;
    g.lineStyle(5, p.accent, 1).beginPath().arc(cx, y - 4, 40, Math.PI, Math.PI * 2).strokePath();
    g.lineStyle(2, p.accentLit, 0.8).strokeEllipse(cx, y - 30, 70, 20);
    g.fillStyle(INK, 1).fillCircle(cx, y - 40, 9);
    g.fillStyle(p.accentLit, 1).fillCircle(cx, y - 40, 6.5);
  }
}

// ── Dynamic layer: vents, gusts, pickups ─────────────────────────────────────

export function renderVents(
  g: Phaser.GameObjects.Graphics,
  vents: VentColumn[],
  input: { timeMs: number; routeOffset: number; reducedMotion: boolean; visible: (y: number) => boolean }
): void {
  for (const vent of vents) {
    if (!input.visible(vent.yBottom) && !input.visible(vent.yTop)) continue;
    const biome = biomeForZone(vent.zoneId);
    const cx = vent.centerX + input.routeOffset;
    const strength = ventStrengthAt(input.timeMs, vent);
    const half = VENT_TUNING.width / 2;
    // Bracket ticks show the column even when it is resting.
    g.lineStyle(2, biome.palette.accent, 0.35 + strength * 0.45);
    for (const y of [vent.yBottom - 8, vent.yTop + 8]) {
      g.lineBetween(cx - half, y, cx - half + 8, y);
      g.lineBetween(cx + half - 8, y, cx + half, y);
    }
    if (strength <= 0) continue;
    const span = vent.yBottom - vent.yTop;
    const count = input.reducedMotion ? 3 : 6;
    for (let i = 0; i < count; i++) {
      const phase = input.reducedMotion ? i / count : ((input.timeMs / 700 + i / count) % 1);
      const y = vent.yBottom - phase * span;
      const w = half * (1.2 + phase * 0.5);
      g.fillStyle(biome.palette.accent, 0.22 * strength * (1 - phase * 0.6)).fillEllipse(cx, y, w, 18);
    }
    g.lineStyle(2, biome.palette.accentLit, 0.4 * strength).lineBetween(cx, vent.yBottom - 4, cx, vent.yTop + 20);
  }
}

export function renderGust(
  g: Phaser.GameObjects.Graphics,
  gust: GustState,
  view: { left: number; top: number; width: number; height: number },
  input: { timeMs: number; reducedMotion: boolean }
): void {
  if (gust.phase === 'calm') return;
  const lines = gust.phase === 'gust' ? 14 : 5;
  const alpha = gust.phase === 'gust' ? 0.5 * gust.strength : 0.22;
  const speed = gust.phase === 'gust' ? 1.1 : 0.4;
  g.lineStyle(2, 0xd7deff, alpha);
  for (let i = 0; i < lines; i++) {
    const r = hashString(`gust:${i}`);
    const y = view.top + ((r % 1000) / 1000) * view.height;
    const len = 40 + (r % 60);
    const travel = input.reducedMotion
      ? (r % 997) / 997
      : ((input.timeMs / 1000) * speed + (r % 97) / 97) % 1;
    const x =
      gust.direction > 0
        ? view.left - len + travel * (view.width + len * 2)
        : view.left + view.width + len - travel * (view.width + len * 2);
    g.lineBetween(x, y, x + gust.direction * len, y);
  }
}

export function renderPickup(
  g: Phaser.GameObjects.Graphics,
  pickup: PowerUpPickup,
  input: { x: number; timeMs: number; reducedMotion: boolean }
): void {
  const bob = input.reducedMotion ? 0 : Math.sin(input.timeMs / 320 + pickup.x) * 3;
  const x = input.x;
  const y = pickup.y + bob;
  const color = POWER_UP_COLORS[pickup.kind];
  if (!input.reducedMotion) {
    const pulse = (input.timeMs / 900 + pickup.x / 100) % 1;
    g.lineStyle(2, color, 0.5 * (1 - pulse)).strokeCircle(x, y, 13 + pulse * 10);
  }
  g.fillStyle(INK, 1).fillCircle(x, y, 13);
  g.fillStyle(color, 1).fillCircle(x, y, 10.5);
  drawPowerUpGlyph(g, pickup.kind, x, y, 1);
}

export function drawPowerUpGlyph(
  g: Phaser.GameObjects.Graphics,
  kind: PowerUpKind,
  x: number,
  y: number,
  scale: number
): void {
  const s = scale;
  if (kind === 'spark') {
    g.fillStyle(INK, 1)
      .beginPath()
      .moveTo(x + 1.5 * s, y - 7 * s)
      .lineTo(x - 4 * s, y + 1 * s)
      .lineTo(x, y + 1 * s)
      .lineTo(x - 1.5 * s, y + 7 * s)
      .lineTo(x + 4 * s, y - 1 * s)
      .lineTo(x, y - 1 * s)
      .closePath()
      .fillPath();
  } else if (kind === 'updraft') {
    g.lineStyle(2.4 * s, INK, 1)
      .beginPath().moveTo(x - 5 * s, y).lineTo(x, y - 5 * s).lineTo(x + 5 * s, y).strokePath()
      .beginPath().moveTo(x - 5 * s, y + 5 * s).lineTo(x, y).lineTo(x + 5 * s, y + 5 * s).strokePath();
  } else if (kind === 'second_wind') {
    g.lineStyle(2.4 * s, INK, 1);
    g.beginPath().arc(x, y + 4 * s, 6 * s, Math.PI * 1.1, Math.PI * 1.9).strokePath();
    g.beginPath().arc(x, y + 8 * s, 4 * s, Math.PI * 1.1, Math.PI * 1.9).strokePath();
    g.fillStyle(INK, 1).fillCircle(x, y - 4 * s, 1.6 * s);
  } else {
    g.lineStyle(2.2 * s, INK, 1).strokeRect(x - 4.5 * s, y - 5.5 * s, 9 * s, 11 * s);
    g.lineStyle(1.4 * s, INK, 1)
      .lineBetween(x - 4.5 * s, y - 2 * s, x + 4.5 * s, y - 2 * s)
      .lineBetween(x - 4.5 * s, y + 2 * s, x + 4.5 * s, y + 2 * s);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

// Seeded scatter across the 400px cavity between the shaft walls.
function scatter(
  seed: string,
  top: number,
  bottom: number,
  left: number,
  count: number,
  draw: (x: number, y: number, r: number) => void
) {
  let r = hashString(seed);
  for (let i = 0; i < count; i++) {
    r = Math.imul(r ^ (r >>> 15), 2246822519) >>> 0;
    const x = left + 40 + (r % 400);
    r = Math.imul(r ^ (r >>> 13), 3266489917) >>> 0;
    const y = top + (r % Math.max(1, bottom - top));
    draw(x, y, r);
  }
}

function drawGlint(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha: number
) {
  g.fillStyle(color, alpha)
    .fillTriangle(x - size, y, x + size, y, x, y - size * 2.4)
    .fillTriangle(x - size, y, x + size, y, x, y + size * 2.4)
    .fillTriangle(x, y - size, x, y + size, x - size * 2.4, y)
    .fillTriangle(x, y - size, x, y + size, x + size * 2.4, y);
}
