# Phase 03 — Player Movement & Jump King Physics

> Implement the analog charge jump model, gravity, ground movement, air nudging, wall bonks, and player state that make the climb feel physical.

---

## Context

The shared mutation hook only works if the first jump feels consequential. The working reference is `fallstack-mockup(3).html`, not the tiered jump experiment in mockup 4. Use analog charge for v1.

This phase is intentionally about feel, not progression. The player should be able to stand, face, charge, leap, arc, bonk, and land on placeholder platforms.

---

## What This Phase Builds

### Player State

Track:

- `x`, `y`
- `vx`, `vy`
- `facing`
- `onGround`
- `charging`
- `chargeStart`
- `lastLaunchPower`
- `lastWallBonk`
- `standingType`
- `lastHelperLandTime`

Reference dimensions:

- `PLAYER_W = 20`
- `PLAYER_H = 28`

### Movement Constants

Start with the mockup values:

```ts
const GRAVITY = 1550;
const WALK_SPEED = 140;
const MAX_CHARGE_MS = 900;
const MIN_POWER = 0.32;
const AIR_ACCEL = 950;
const AIR_MAX_VX = 420;
```

These are not final difficulty tuning values. Phase 25 tunes them. This phase should preserve the reference feel.

### Analog Charge Jump

Holding Space or the mobile jump button starts charging. Releasing launches:

```ts
const held = Math.min(now - chargeStart, 900);
const power = 0.32 + (held / 900) * 0.68;
const vy = -(560 + power * 440);
const vx = facing * (170 + power * 230);
```

Tap jump gives a small hop. Full charge gives a committed leap. The player should be locked in place while charging but allowed to change facing direction.

### Ground and Air Control

On ground:

- Left/right changes facing.
- If not charging, left/right also walks at `140px/s`.

In air:

- Left/right applies acceleration to `vx`.
- Clamp `vx` to `AIR_MAX_VX`.
- Air steering should feel like bending the arc, not flying.

### Wall Bonks

Clamp the player inside the world:

- Left wall around `x = 4`.
- Right wall around `WORLD_W - PLAYER_W - 4`.
- On wall collision, set `vx = 0`.
- Set `lastWallBonk = true` for failure classification.

### Input Sources

Support both:

- Keyboard: ArrowLeft, ArrowRight, Space.
- Shell-forwarded input state: `{ left, right, jump }`.

Both paths must feed the same input state consumed by Phaser. Avoid duplicated movement logic.

---

## Key Technical Considerations

- Charge fill UI is a shell/HUD concern. Phaser should expose charge progress; the shell renders it.
- Do not add mouse aiming, drag aiming, or manual object placement.
- The physics should be deterministic enough for testing but does not need lockstep multiplayer determinism.
- Input release timing matters. Do not debounce jump release.

---

## How to Know It's Working

- Player walks left/right on a platform.
- Holding jump visibly charges through the shell indicator.
- Releasing jump launches a short, medium, or full arc depending on hold duration.
- Air nudging adjusts the arc without overriding the committed jump.
- Side-wall bonks stop horizontal movement and set the bonk flag.
- The feel is close to `fallstack-mockup(3).html`.

