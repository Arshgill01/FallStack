import type Phaser from 'phaser';
import type { ClimberId } from '../../shared/game/climbers.js';
import {
  playerVisualDimensions,
  playerVisualRotation,
  playerVisualState,
  type PlayerVisualState,
} from './art-direction.js';
import { drawCeremonyMark, renderReliquaryPlayer } from './renderPlayer.js';

export type ClimberRenderInput = Parameters<typeof renderReliquaryPlayer>[1] & {
  // 0..1 while a timed pickup is running, so the figure can show it.
  glow?: number;
};

const INK = 0x16111a;
const BONE = 0xf3ebdd;

type Pose = {
  state: PlayerVisualState;
  width: number;
  height: number;
  feetY: number;
  top: number;
  charge: number;
  airborne: boolean;
  progress: number;
  strength: number;
};

export function renderClimber(
  graphics: Phaser.GameObjects.Graphics,
  climberId: ClimberId,
  input: ClimberRenderInput
): void {
  if (climberId === 'pilgrim') {
    renderReliquaryPlayer(graphics, input);
    return;
  }
  const pose = poseFor(input);
  graphics.setRotation(
    playerVisualRotation(pose.state, input.facing, input.reducedMotion)
  );
  graphics.setAlpha(
    pose.state === 'respawn' && !input.reducedMotion
      ? 0.42 + pose.progress * 0.58
      : 1
  );
  drawCeremonyMark(graphics, {
    x: input.x,
    top: pose.top,
    feetY: pose.feetY,
    state: pose.state,
    progress: pose.progress,
    strength: pose.strength,
    reducedMotion: input.reducedMotion,
  });
  if (climberId === 'wick') drawWick(graphics, input, pose);
  else if (climberId === 'kite') drawKite(graphics, input, pose);
  else drawDiver(graphics, input, pose);
}

function poseFor(input: ClimberRenderInput): Pose {
  const state = playerVisualState(input);
  const base = playerVisualDimensions(state);
  const charge = state === 'charge' ? clamp(input.chargeRatio) : 0;
  const feetY = input.y + 14;
  const height = base.height - charge * 4;
  return {
    state,
    width: base.width + charge * 3,
    height,
    feetY,
    top: feetY - height,
    charge,
    airborne: state === 'rising' || state === 'apex' || state === 'fall',
    progress: clamp(input.ceremonyProgress ?? 1),
    strength: clamp(input.ceremonyStrength ?? 1),
  };
}

// ── Wick: a candle courier whose flame is the charge meter ──────────────────

function drawWick(
  g: Phaser.GameObjects.Graphics,
  input: ClimberRenderInput,
  pose: Pose
): void {
  const x = input.x;
  const bodyW = Math.max(16, pose.width - 8);
  const bodyTop = pose.top + 12;
  const bodyBottom = pose.feetY - 5;
  drawLegs(g, x, bodyBottom, pose, 0x3a2a24);
  // Wax column with an ink outline and two hand-poured drips.
  g.fillStyle(INK, 1).fillRoundedRect(x - bodyW / 2 - 2, bodyTop - 2, bodyW + 4, bodyBottom - bodyTop + 4, 5);
  g.fillStyle(0xf6e7c8, 1).fillRoundedRect(x - bodyW / 2, bodyTop, bodyW, bodyBottom - bodyTop, 4);
  g.fillStyle(0xe2cfa6, 1).fillRect(x + input.facing * (bodyW / 2 - 4) - 2, bodyTop + 4, 4, bodyBottom - bodyTop - 8);
  g.fillStyle(0xfff6e0, 1)
    .fillCircle(x - bodyW / 2 + 4, bodyTop + 6, 3)
    .fillRect(x - bodyW / 2 + 2.5, bodyTop + 6, 3, 7)
    .fillCircle(x + bodyW / 2 - 6, bodyTop + 4, 2.4)
    .fillRect(x + bodyW / 2 - 7.2, bodyTop + 4, 2.4, 5);
  // Eyes sit toward the facing side.
  const eyeY = bodyTop + 10;
  g.fillStyle(INK, 1)
    .fillCircle(x + input.facing * 2 - 3, eyeY, 1.8)
    .fillCircle(x + input.facing * 2 + 3, eyeY, 1.8);
  // Satchel strap and bag.
  g.lineStyle(2, 0x8a3b22, 1).lineBetween(x - bodyW / 2, bodyTop + 4, x + bodyW / 2, bodyTop + 16);
  g.fillStyle(0x8a3b22, 1).fillRect(x - input.facing * (bodyW / 2 + 3) - 3, bodyTop + 14, 6, 7);

  // Flame grows with charge, streams upward when falling, flares with Spark.
  const wickTop = bodyTop - 2;
  g.lineStyle(2, INK, 1).lineBetween(x, wickTop, x, wickTop - 4);
  const glow = clamp(input.glow ?? 0);
  const flameH = 9 + pose.charge * 9 + glow * 4 + (pose.state === 'fall' ? 5 : 0);
  const lean = pose.state === 'fall' ? -input.facing * 2 : pose.airborne ? -input.facing * 3 : 0;
  if (glow > 0) g.fillStyle(0xffb36b, 0.22).fillCircle(x, wickTop - flameH / 2, flameH * 0.9);
  fillFlame(g, x, wickTop - 3, 6 + pose.charge * 2, flameH, lean, 0xff7a3d);
  fillFlame(g, x, wickTop - 3, 3 + pose.charge, flameH * 0.6, lean * 0.6, 0xffd27a);
}

function fillFlame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  baseY: number,
  halfWidth: number,
  height: number,
  lean: number,
  color: number
) {
  g.fillStyle(color, 1)
    .beginPath()
    .moveTo(x - halfWidth, baseY)
    .lineTo(x + lean, baseY - height)
    .lineTo(x + halfWidth, baseY)
    .closePath()
    .fillPath();
  g.fillStyle(color, 1).fillCircle(x, baseY - 1, halfWidth);
}

// ── Kite: a small flyer with a paper kite strapped on ───────────────────────

function drawKite(
  g: Phaser.GameObjects.Graphics,
  input: ClimberRenderInput,
  pose: Pose
): void {
  const x = input.x;
  const headR = 7.5;
  const headY = pose.top + headR + 1;
  const bodyTop = headY + headR - 1;
  const bodyBottom = pose.feetY - 5;
  const glow = clamp(input.glow ?? 0);

  // The kite opens wide in the air and folds flat while charging.
  const span = pose.state === 'charge' ? 7 : pose.airborne ? 15 + glow * 4 : 10;
  const kx = x - input.facing * 9;
  const ky = bodyTop + 2 - (pose.airborne ? 6 : 0);
  if (glow > 0) g.fillStyle(0x8fa8ff, 0.2).fillCircle(kx, ky, span + 6);
  g.fillStyle(INK, 1)
    .beginPath()
    .moveTo(kx, ky - span - 2)
    .lineTo(kx - span * 0.75 - 2, ky)
    .lineTo(kx, ky + span * 0.9 + 2)
    .lineTo(kx + span * 0.75 + 2, ky)
    .closePath()
    .fillPath();
  g.fillStyle(0x8fa8ff, 1)
    .beginPath()
    .moveTo(kx, ky - span)
    .lineTo(kx - span * 0.75, ky)
    .lineTo(kx, ky + span * 0.9)
    .lineTo(kx + span * 0.75, ky)
    .closePath()
    .fillPath();
  g.lineStyle(1.5, 0xd7deff, 1)
    .lineBetween(kx, ky - span, kx, ky + span * 0.9)
    .lineBetween(kx - span * 0.75, ky, kx + span * 0.75, ky);
  // Tail ribbon trails opposite to travel.
  const tailDrop = pose.state === 'rising' ? 10 : 6;
  g.lineStyle(1.5, 0xe95f45, 1)
    .lineBetween(kx, ky + span * 0.9, kx - input.facing * 4, ky + span * 0.9 + tailDrop)
    .lineBetween(kx - input.facing * 4, ky + span * 0.9 + tailDrop, kx - input.facing * 1, ky + span * 0.9 + tailDrop + 6);

  drawLegs(g, x, bodyBottom, pose, 0x2a2230);
  // Tunic.
  const tunicW = Math.max(14, pose.width - 12);
  g.fillStyle(INK, 1)
    .beginPath()
    .moveTo(x - tunicW / 2 - 1, bodyTop - 1)
    .lineTo(x + tunicW / 2 + 1, bodyTop - 1)
    .lineTo(x + tunicW / 2 + 3, bodyBottom + 1)
    .lineTo(x - tunicW / 2 - 3, bodyBottom + 1)
    .closePath()
    .fillPath();
  g.fillStyle(0xe95f45, 1)
    .beginPath()
    .moveTo(x - tunicW / 2, bodyTop)
    .lineTo(x + tunicW / 2, bodyTop)
    .lineTo(x + tunicW / 2 + 2, bodyBottom)
    .lineTo(x - tunicW / 2 - 2, bodyBottom)
    .closePath()
    .fillPath();
  // Scarf: wraps the neck, tail flicks backward when moving.
  g.fillStyle(0x16111a, 1).fillRect(x - tunicW / 2 - 1, bodyTop - 1, tunicW + 2, 5);
  g.fillStyle(0xd7deff, 1).fillRect(x - tunicW / 2, bodyTop, tunicW, 3);
  const scarfLen = pose.airborne ? 10 : 6;
  g.fillStyle(0xd7deff, 1).fillTriangle(
    x - input.facing * (tunicW / 2),
    bodyTop,
    x - input.facing * (tunicW / 2 + scarfLen),
    bodyTop + (pose.state === 'fall' ? -4 : 3),
    x - input.facing * (tunicW / 2),
    bodyTop + 4
  );
  // Head.
  g.fillStyle(INK, 1).fillCircle(x, headY, headR + 1.5);
  g.fillStyle(BONE, 1).fillCircle(x, headY, headR);
  g.fillStyle(INK, 1)
    .fillCircle(x + input.facing * 2.5 - 2.4, headY, 1.4)
    .fillCircle(x + input.facing * 2.5 + 2.4, headY, 1.4);
  if (pose.state === 'fall') g.fillStyle(INK, 1).fillCircle(x + input.facing * 2.5, headY + 3.5, 1.4);
}

// ── Diver: a brass bell helmet and a spool of line ──────────────────────────

function drawDiver(
  g: Phaser.GameObjects.Graphics,
  input: ClimberRenderInput,
  pose: Pose
): void {
  const x = input.x;
  const helmR = 9.5 - pose.charge;
  const helmY = pose.top + helmR + 1;
  const bodyTop = helmY + helmR - 2;
  const bodyBottom = pose.feetY - 5;
  const suitW = Math.max(16, pose.width - 8);
  const glow = clamp(input.glow ?? 0);

  // Heavy boots instead of legs: wider stance, chunkier silhouette.
  const stance = pose.state === 'charge' ? 6 + pose.charge * 2 : pose.airborne ? 4 : 5;
  g.fillStyle(INK, 1)
    .fillRect(x - stance - 4, bodyBottom - 1, 8, pose.feetY - bodyBottom + 1)
    .fillRect(x + stance - 4, bodyBottom - 1, 8, pose.feetY - bodyBottom + 1);
  g.fillStyle(0x3f2a10, 1)
    .fillRect(x - stance - 3, bodyBottom, 6, pose.feetY - bodyBottom - 1)
    .fillRect(x + stance - 3, bodyBottom, 6, pose.feetY - bodyBottom - 1);

  // Suit with a belt and the coiled thread on the trailing hip.
  g.fillStyle(INK, 1).fillRoundedRect(x - suitW / 2 - 2, bodyTop - 1, suitW + 4, bodyBottom - bodyTop + 3, 4);
  g.fillStyle(0x6b4a1e, 1).fillRoundedRect(x - suitW / 2, bodyTop, suitW, bodyBottom - bodyTop, 3);
  g.fillStyle(0x3f2a10, 1).fillRect(x - suitW / 2, bodyBottom - 7, suitW, 3);
  const coilX = x - input.facing * (suitW / 2 + 1);
  g.lineStyle(2, BONE, 1).strokeCircle(coilX, bodyBottom - 9, 4).strokeCircle(coilX, bodyBottom - 9, 1.8);
  if (pose.airborne)
    g.lineStyle(1.2, BONE, 0.7).lineBetween(coilX, bodyBottom - 5, coilX - input.facing * 6, bodyBottom + 6);

  // Bell helmet with porthole; brass brightens while a pickup is running.
  if (glow > 0) g.fillStyle(0xe8c35a, 0.22).fillCircle(x, helmY, helmR + 6);
  g.fillStyle(INK, 1).fillCircle(x, helmY, helmR + 2);
  g.fillStyle(glow > 0 ? 0xffe7a3 : 0xe8c35a, 1).fillCircle(x, helmY, helmR);
  g.fillStyle(0xb8902e, 1).fillRect(x - helmR, helmY + helmR - 4, helmR * 2, 3);
  const portX = x + input.facing * 2.5;
  g.fillStyle(INK, 1).fillCircle(portX, helmY - 0.5, 5.4);
  g.fillStyle(0x2d6e8c, 1).fillCircle(portX, helmY - 0.5, 4);
  g.fillStyle(0x9ed8ff, 0.9).fillCircle(portX - 1.4, helmY - 2, 1.3);
  // Rivets.
  g.fillStyle(0x6b4a1e, 1)
    .fillCircle(x - input.facing * 6.5, helmY - 3, 1.1)
    .fillCircle(x - input.facing * 6.5, helmY + 2, 1.1);
}

function drawLegs(
  g: Phaser.GameObjects.Graphics,
  x: number,
  bodyBottom: number,
  pose: Pose,
  color: number
) {
  const spread = pose.state === 'charge' ? 5 + pose.charge * 2 : pose.airborne ? 3 : 4;
  const tuck = pose.state === 'rising' ? 2 : 0;
  g.lineStyle(3, color, 1)
    .lineBetween(x - spread, bodyBottom, x - spread, pose.feetY - tuck)
    .lineBetween(x + spread, bodyBottom, x + spread - (pose.airborne ? 2 : 0), pose.feetY - tuck);
  g.fillStyle(INK, 1)
    .fillRect(x - spread - 2.5, pose.feetY - tuck - 2, 5, 2.5)
    .fillRect(x + spread - 2.5, pose.feetY - tuck - 2, 5, 2.5);
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}
