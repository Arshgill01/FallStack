import type Phaser from 'phaser';
import type { BoardEcho } from '../../shared/realtime.js';
import { RELIQUARY_COLORS } from './art-direction.js';
import {
  ECHO_DURATION_MS,
  MAX_ACTIVE_ECHOES,
  echoIsMajor,
  echoStamp,
  offscreenDirection,
  offscreenMarkerCopy,
  type EchoPlacement,
  type OffscreenDirection,
} from './echoes.js';

type ActiveEcho = {
  echo: BoardEcho;
  placement: EchoPlacement;
  startedAt: number;
  stamp: Phaser.GameObjects.Text | null;
};

type Marker = {
  entries: { kind: BoardEcho['kind']; zoneName: string }[];
  until: number;
  text: Phaser.GameObjects.Text | null;
};

const MARKER_HOLD_MS = 2_600;
const GRAVITY = 980;

// Other climbers, rendered at the moment their event lands: a paper ghost
// tumbling off the ledge they missed, a lantern rising where they cleared,
// and a count at the screen edge for anything out of view. Visual only:
// echoes never touch collision, which still changes only at reconcile.
export class EchoLayer {
  #active: ActiveEcho[] = [];
  #markers: Record<OffscreenDirection, Marker> = {
    above: { entries: [], until: 0, text: null },
    below: { entries: [], until: 0, text: null },
  };

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly options: {
      layoutX: (x: number) => number;
      renderScale: () => number;
      reducedMotion: () => boolean;
    }
  ) {}

  show(
    echo: BoardEcho,
    placement: EchoPlacement,
    nowMs: number,
    stamp: string = echoStamp(echo)
  ) {
    const view = this.scene.cameras.main.worldView;
    const direction = offscreenDirection(placement.slot.y, {
      top: view.y,
      bottom: view.bottom,
    });
    if (direction) {
      const marker = this.#markers[direction];
      if (nowMs > marker.until) marker.entries = [];
      marker.entries.push({ kind: echo.kind, zoneName: placement.zoneName });
      marker.until = nowMs + MARKER_HOLD_MS;
      return;
    }
    while (this.#active.length >= MAX_ACTIVE_ECHOES) this.#retire(0);
    this.#active.push({
      echo,
      placement,
      startedAt: nowMs,
      stamp: this.#stamp(echo, placement, stamp),
    });
  }

  draw(graphics: Phaser.GameObjects.Graphics, nowMs: number) {
    for (let index = this.#active.length - 1; index >= 0; index -= 1) {
      const active = this.#active[index]!;
      const t = (nowMs - active.startedAt) / ECHO_DURATION_MS;
      if (t >= 1) {
        this.#retire(index);
        continue;
      }
      this.#drawEcho(graphics, active, t);
    }
    this.#drawMarkers(nowMs);
  }

  clear() {
    while (this.#active.length) this.#retire(0);
    for (const marker of Object.values(this.#markers)) {
      marker.entries = [];
      marker.until = 0;
      marker.text?.setVisible(false);
    }
  }

  #drawEcho(graphics: Phaser.GameObjects.Graphics, active: ActiveEcho, t: number) {
    const c = RELIQUARY_COLORS;
    const { echo, placement } = active;
    const reduced = this.options.reducedMotion();
    const slotX = this.options.layoutX(placement.slot.x);
    const slot = { ...placement.slot, x: slotX };
    const fade = 1 - t;
    const major = echoIsMajor(echo);

    // The slot answers: a ring that opens around what this event fed.
    const ring = reduced ? 6 : 4 + t * 14;
    graphics
      .lineStyle(major ? 3 : 2, major ? c.persimmon : c.ghost, fade * 0.9)
      .strokeRoundedRect(
        slot.x - ring,
        slot.y - ring,
        slot.width + ring * 2,
        slot.height + ring * 2,
        4
      );

    if (echo.kind === 'fall') {
      const seconds = (t * ECHO_DURATION_MS) / 1000;
      const originX = this.options.layoutX(placement.origin.x);
      const targetX = slot.x + slot.width / 2;
      const x = reduced
        ? targetX
        : originX + (targetX - originX) * Math.min(1, seconds / 0.55);
      const y = reduced
        ? slot.y - 18
        : placement.origin.y - 20 - 140 * seconds + 0.5 * GRAVITY * seconds * seconds;
      drawPaperGhost(graphics, x, y, reduced ? 0 : seconds * 7, fade * 0.85);
    } else {
      // Clears and summits rise: lantern sparks lifting off the line.
      for (let index = 0; index < 5; index += 1) {
        const lift = reduced ? 10 : t * 70 + index * 6;
        const x = slot.x + 8 + (index / 4) * Math.max(40, slot.width - 16);
        graphics
          .fillStyle(c.gold, fade * 0.8)
          .fillCircle(x, slot.y - lift, index % 2 ? 2.5 : 3.5);
      }
    }

    if (active.stamp) {
      active.stamp.setAlpha(Math.min(1, fade * 2.2));
      if (!reduced) active.stamp.setY(slot.y - 10 - t * 12);
    }
  }

  #drawMarkers(nowMs: number) {
    const view = this.scene.cameras.main.worldView;
    for (const direction of ['above', 'below'] as const) {
      const marker = this.#markers[direction];
      const live = nowMs < marker.until && marker.entries.length > 0;
      if (!live) {
        marker.text?.setVisible(false);
        continue;
      }
      const text = (marker.text ??= this.#text(true));
      // Clear of the 14px mobile side rail plus its gold inset.
      const x = view.right - 24;
      const y = direction === 'above' ? view.y + 124 : view.bottom - 18;
      text
        .setText(offscreenMarkerCopy(direction, marker.entries))
        .setOrigin(1, direction === 'above' ? 0 : 1)
        .setPosition(x, y)
        .setAlpha(Math.min(1, (marker.until - nowMs) / 600))
        .setVisible(true);
    }
  }

  #stamp(echo: BoardEcho, placement: EchoPlacement, stamp: string) {
    const text = this.#text(echoIsMajor(echo));
    const slotX = this.options.layoutX(placement.slot.x);
    text
      .setText(stamp)
      .setOrigin(0.5, 1)
      .setPosition(slotX + placement.slot.width / 2, placement.slot.y - 10);
    return text;
  }

  #text(major: boolean) {
    const text = this.scene.add.text(0, 0, '', {
      fontFamily: '"Zen Maru Gothic", sans-serif',
      fontSize: '11px',
      fontStyle: '700',
      resolution: this.options.renderScale(),
      color: major ? '#f4efe2' : '#bde5d9',
      backgroundColor: major
        ? 'rgba(142, 48, 43, 0.94)'
        : 'rgba(23, 20, 38, 0.9)',
      padding: { left: 6, right: 6, top: 3, bottom: 3 },
    });
    text.setDepth(5);
    return text;
  }

  #retire(index: number) {
    const [active] = this.#active.splice(index, 1);
    active?.stamp?.destroy();
  }
}

// Another climber, reduced to a washi cut-out: readable as a person, never
// mistaken for the player or for anything solid.
function drawPaperGhost(
  graphics: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  angle: number,
  alpha: number
) {
  const c = RELIQUARY_COLORS;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const point = (dx: number, dy: number) => ({
    x: x + dx * cos - dy * sin,
    y: y + dx * sin + dy * cos,
  });
  const [a, b, d, e] = [point(-9, -5), point(9, -5), point(11, 18), point(-11, 18)];
  graphics.fillStyle(c.washi, alpha * 0.55);
  graphics.fillTriangle(a.x, a.y, b.x, b.y, d.x, d.y);
  graphics.fillTriangle(a.x, a.y, d.x, d.y, e.x, e.y);
  graphics.lineStyle(1.5, c.indigoLit, alpha);
  graphics.lineBetween(a.x, a.y, b.x, b.y);
  graphics.lineBetween(b.x, b.y, d.x, d.y);
  graphics.lineBetween(d.x, d.y, e.x, e.y);
  graphics.lineBetween(e.x, e.y, a.x, a.y);
  const head = point(0, -12);
  graphics.fillStyle(c.washi, alpha * 0.7).fillCircle(head.x, head.y, 7);
  graphics.lineStyle(1.5, c.indigoLit, alpha).strokeCircle(head.x, head.y, 7);
}
