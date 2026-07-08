# Phase 06 — Fall Detection, Respawn & Attempt Lifecycle

> Implement fall-below-zone detection, checkpoint respawn, failure classification, session stats, and the event surface that mutation persistence will consume.

---

## Context

The mutation system starts from a simple game fact: an attempt ended in a zone for a reason. This phase creates that fact. It does not persist shared state yet.

The player should be able to climb, fall below a recovery line, respawn at the current checkpoint, and emit a structured attempt result.

---

## What This Phase Builds

### Fall Detection

An attempt ends when:

```ts
player.y > currentZone.floorY + 70
```

Minor wall bonks, bad landings, and missed ledges do not end the attempt unless the player falls below the zone recovery line.

### Respawn

On fall:

- Emit a fall result.
- Increment session fall stats.
- Reset player to the latest checkpoint.
- Zero velocities.
- Set `onGround = true`.
- Clear jump-local flags after classification.

Respawn should be quick. No long death sequence for v1.

### Checkpoint Progression

- Start at Lower Ruins checkpoint.
- Reaching Bell Shaft checkpoint locks respawn to Bell Shaft.
- Reaching Moon Roof checkpoint locks respawn to Moon Roof.
- Checkpoint progress never moves backward during the session.

Crossing from zone `N` to `N + 1` counts as clearing zone `N`.

### Failure Buckets

Classify falls in this order:

1. `helper_overuse`: player stood on `corpse_stack` or `mercy_nail` for less than 4 seconds before falling.
2. `wall_bonk`: `lastWallBonk` was set during the jump.
3. `overjump`: `lastLaunchPower > 0.82`.
4. Default: `short_jump`.

These four buckets are canonical for v1.

### Session Stats

Track:

- climbs / jump launches
- falls
- checkpoints reached
- summit clears

These stats feed the HUD immediately and the result card later.

### Event Surface

Emit structured events from Phaser to the shell:

```ts
fallRecorded({ zoneId, failureBucket, chargePower, timestamp })
checkpointReached({ clearedZoneId, nextZoneId, timestamp })
summitCleared({ zoneId, timestamp })
```

The shell decides what gets persisted.

---

## Key Technical Considerations

- Do not let Phaser write Redis state.
- Keep failure classification deterministic and inspectable.
- The bucket names must match AGENTS.md: `short_jump`, `overjump`, `wall_bonk`, `helper_overuse`.
- The player can continue immediately after respawn.

---

## How to Know It's Working

- Falling below a zone floor respawns at the active checkpoint.
- After reaching Bell Shaft, falling does not reset to Lower Ruins.
- Falls classify into exactly one of the four buckets.
- Checkpoint clears increment session stats.
- Summit landing emits the summit event.
- The shell receives structured lifecycle events.

