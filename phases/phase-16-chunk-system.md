# Phase 16 — Chunk-Based Tower Generation

> Replace the hardcoded ledge list with seeded hand-designed chunks stitched into a daily tower.

---

## Context

Fallstack should eventually generate a new finite tower each day, but v1 should stay chunk-first. Hand-designed chunks protect reachability and feel. The generator chooses and stitches them; it does not invent arbitrary platform layouts.

If this phase threatens the deadline, keep the mockup layout as the known-good seed and move daily variation post-submission.

---

## What This Phase Builds

### Chunk Data Model

Each chunk defines:

- `id`
- `theme`
- `difficultyMin`
- `difficultyMax`
- `height`
- `entranceConnector`
- `exitConnector`
- `ledges` in local coordinates
- `artifactSlots`
- optional decorations

Connectors describe where the player enters and exits a chunk. They should include x ranges, not single pixels.

### Chunk Library

Start small:

- 3-5 Lower Ruins chunks: wide ledges, forgiving gaps.
- 3-5 Bell Shaft chunks: narrower ledges, wall-bonk opportunities.
- 3-5 Moon Roof chunks: tighter timing, more precision.

The mockup's hardcoded layout can be decomposed into the first known-good chunk set.

### Seeded Generator

Generator input:

- daily seed
- zone theme
- target difficulty range
- number of chunks per zone

Generator output:

- world-space zones
- ledges
- checkpoints
- artifact slots
- summit

Use a seeded PRNG. Do not use `Math.random()`.

### Stitching

For each zone:

- Place checkpoint at zone floor.
- Select chunks compatible with theme and difficulty.
- Translate local ledges into world coordinates.
- Align chunk exit to the next chunk entrance within reachable ranges.
- Preserve enough vertical space for camera framing.

### Reachability Validation

Validate generated towers before use:

- Every chunk has at least one clear path without artifacts.
- Helpful artifacts may add alternate paths but are never required.
- Cursed artifacts may make a route harder but cannot block the only path.
- If validation fails, swap a chunk or fall back to the known-good seed.

Validation can be approximate for v1: check pairwise jump reachability using the reference max jump envelope.

---

## Key Technical Considerations

- Keep geometry pure and testable outside Phaser.
- Chunk variation should be subtle: width nudges, decoration shifts, artifact-slot choices.
- Do not create endless mode.
- Do not build a player-facing level editor.
- The daily tower remains finite with a summit.

---

## How to Know It's Working

- Same seed produces the same tower.
- Different seeds produce visibly different but still familiar towers.
- Generated towers pass reachability validation.
- Seed #37 can reproduce the known-good mockup path or a close equivalent.
- Artifacts attach to declared slots, not random world positions.

