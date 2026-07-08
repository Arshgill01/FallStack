# Phase 05 — Vertical Follow Camera & Viewport Framing

> Implement the camera that follows the player upward, respects the Reddit post viewport, and keeps useful space above the climber.

---

## Context

Fallstack is a vertical diorama. The camera must frame intention: enough space above the player to read the next jump, enough room below to understand falling, and no wasted empty space caused by mobile controls.

The mockup uses smooth interpolation and a player-low-in-frame bias. Carry that behavior into Phaser.

---

## What This Phase Builds

### Follow Camera

Use a vertical-only camera:

```ts
targetCamY = player.y - viewH * 0.18;
camY += (targetCamY - camY) * 0.12;
```

In Phaser, use the camera system rather than manual canvas translate, but keep the same framing logic.

### Framing Rules

- The world is one screen wide; no horizontal camera travel is needed.
- Keep the player in the lower portion of the viewport.
- Clamp at the bottom so the starting floor does not show empty space.
- Clamp at the top so the summit does not reveal blank sky beyond useful framing.
- Account for the DOM control bar; the visible game viewport ends above it.

### Zone Background Selection

The camera should choose the current visual atmosphere based on the player's zone:

- Lower Ruins: warm sky and distant mountains.
- Bell Shaft: twilight and lantern silhouettes.
- Moon Roof: indigo sky, moon, and stars.

Full rendering polish is Phase 07, but this phase should establish the background switching hook.

### Checkpoint Settling

When a checkpoint is reached:

- Temporarily bias the camera upward to preview the next zone.
- Avoid a hard cut.
- Return to normal follow after a short delay.

This does not need elaborate animation yet.

### Charge Preview Hook

Expose a future hook for charge-time lookahead. It can be disabled for now, but the camera system should be structured so Phase 25 can tune "show nearby landing area while charging."

---

## Key Technical Considerations

- Viewport height changes on mobile and in Reddit's iframe. Treat height as dynamic.
- Reduced-motion should eventually disable decorative camera shake, but not normal follow.
- Camera movement is functional. Do not remove core follow movement for reduced-motion users.
- Keep interpolation stable under frame drops by clamping delta time.

---

## How to Know It's Working

- The camera follows upward smoothly with no jumps.
- The player sits lower than center, leaving more space above.
- The camera does not show empty space below the starting floor or above the summit.
- Zone background selection changes as the player climbs.
- Checkpoint arrival briefly frames the next section without blocking control.

