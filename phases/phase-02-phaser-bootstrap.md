# Phase 02 — Phaser Engine Bootstrap

> Get Phaser running inside the expanded Devvit Web `game.html` entrypoint with a canvas that fills the game viewport, handles resize, and renders a static test scene.

---

## Context

Phase 01 creates the Devvit Web interactive post, HTML entrypoints, and initial `/api` path. This phase proves that the actual game runtime can live inside the expanded entrypoint. Nothing about movement, mutation, or persistence is solved here. The deliverable is a stable Phaser canvas inside the Reddit post constraints.

The client shell owns lightweight DOM chrome and mobile controls. Phaser owns the game canvas, scene lifecycle, physics update loop, and tower rendering. Server state still goes through Devvit Web `/api` endpoints.

---

## What This Phase Builds

### Phaser Runtime

- Use the official Devvit Phaser template dependency (`phaser`) bundled by Vite.
- Do not load Phaser from a CDN.
- Configure Phaser with a fixed logical world width of `480`.
- Use a variable canvas height based on the available webview space after header and mobile controls are reserved.
- Prefer `Phaser.AUTO`, but verify `CANVAS` fallback works inside Reddit's iframe.

### Scene Lifecycle

Create the initial scene chain:

- `BootScene`: reads shell config, viewport size, reduced-motion preference, and bridge readiness.
- `PreloadScene`: exists even if there are no external assets yet, so later sound and sprite work has a home.
- `GameScene`: renders the placeholder game world and receives input state from the shell.

The goal is to make future work incremental rather than dumping all logic into one script tag.

### Static Test Scene

Render a minimal but useful test scene:

- A background fill.
- Three debug platforms at different heights.
- A small player placeholder.
- Optional FPS display during local development only.

Do not build the visual identity yet. Debug rectangles are fine in this phase.

### Resize Handling

The canvas should resize when the Reddit iframe or expanded viewport changes:

- Use Phaser scale manager resize events and browser resize signals.
- Recompute canvas height after subtracting reserved DOM chrome.
- Call Phaser scale manager resize APIs instead of recreating the game instance.
- Keep the logical world width stable at `480`.

### Frame Timing

The mockups clamp frame delta to avoid giant physics jumps:

```ts
const dt = Math.min(rawDeltaMs / 1000, 0.032);
```

Carry that pattern into the game update loop. The exact implementation can live in a game-time helper, but the behavior matters.

---

## Key Technical Considerations

- Phaser runs inside the Devvit Web client iframe and has no direct Redis or Reddit API access.
- All privileged Devvit state comes through `/api` endpoints implemented in `src/server`.
- The canvas must not cover the DOM controls. Mobile controls are not Phaser buttons.
- The game world uses `y = 0` at the top and larger `y` values toward the bottom. The player starts near `y = 3320` and climbs upward.
- Avoid WebGL-only effects at this stage. The hackathon target values reliability over rendering novelty.

---

## How to Know It's Working

- The interactive post shows a Phaser canvas inside the expanded Devvit Web entrypoint.
- The canvas resizes cleanly with no clipped content or overlap with controls.
- The scene chain logs or exposes `Boot -> Preload -> Game`.
- The game loop runs steadily without iframe permission errors.
- The placeholder player and platforms render at the expected 480px logical width.
