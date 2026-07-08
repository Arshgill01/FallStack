# Phase 04 — Tower Structure, Zones & Platform Collision

> Build the three-zone tower with checkpoint platforms, regular ledges, collision, zone detection, and summit geometry.

---

## Context

Before procedural chunks, the game needs one known-good climb. The mockup layout is that climb. Hardcode it first, keep the data shape clean, and let Phase 16 replace the source of geometry later.

This phase creates the physical space. Artifact collision comes later.

---

## What This Phase Builds

### Tower Data Model

Each zone should define:

- `id`
- `name`
- `theme`
- `floorY`
- `topY`
- `checkpoint`
- `ledges`
- optional `summit`

Reference world:

```ts
const WORLD_W = 480;
const WORLD_H = zones[0].floorY + 100;
```

### Three Zones

Use the mockup's structure:

| Zone | Theme | floorY | topY | Notes |
|------|-------|--------|------|-------|
| Lower Ruins | ruins | 3320 | 2470 | 5 forgiving stone ledges |
| Bell Shaft | bell | 2470 | 1520 | 6 narrower ledges |
| Moon Roof | moon | 1520 | 200 | 8 precision ledges plus summit |

Names may be tuned later, but keep the three-zone progression.

### Platform Collision

Use simple AABB landing collision:

- Only land when `vy >= 0`.
- Player bottom crosses the ledge top.
- Player overlaps horizontally with about `4px` tolerance.
- Landing snaps the player onto the ledge and zeroes vertical velocity.

Avoid a general physics engine. The mockup proves simple collision is enough.

### Checkpoints

Each zone's floor platform is also its checkpoint:

- Larger than normal ledges.
- Acts as respawn point for that zone.
- Later rendered as a torii-like checkpoint structure.

### Zone Detection

Detect zone from player `y`:

- Player begins in Lower Ruins.
- Moving above a zone boundary enters the next zone.
- Crossing upward from zone `N` into zone `N + 1` emits a clear/checkpoint event.

### Summit

Add a summit platform at the top of Moon Roof. Landing on it should emit `summitCleared`, though Phase 06 may wire the full lifecycle.

---

## Key Technical Considerations

- Keep coordinates in world space.
- Keep ledges data-only so generation can replace hardcoded lists later.
- Artifact slots can be added as metadata but should not affect collision yet.
- The zone floor doubles as both recovery/death boundary and checkpoint reference.

---

## How to Know It's Working

- The player can climb from the starting checkpoint toward the summit using static platforms.
- Landing is stable, with no falling through ledges.
- Zone boundary crossing is detected.
- Checkpoint platforms exist at each zone floor.
- The summit platform exists and can be landed on.

