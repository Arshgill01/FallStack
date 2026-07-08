# Phase 11 — Mutation Feedback Loop

> Show compact, concrete fall and clear feedback so the player understands that their attempt changed shared state.

---

## Context

The first fall is the proof of the hook. If the player falls and only sees a generic death message, Fallstack becomes just a platformer. This phase connects persistence results to readable feedback.

Feedback must be dry, compact, mildly cursed, and specific.

---

## What This Phase Builds

### Fall Feedback

After each fall, show a mutation banner above the controls:

```text
Your fall added +1 to Moon Shelf. 2 more short jumps spawn a Mercy Nail.
```

The message should name:

- Whether the contribution counted.
- The zone affected.
- The bucket or artifact implication.
- Distance to the next visible threshold when useful.

### Threshold Feedback

When a counter crosses a threshold:

- 3 failures: announce artifact spawn.
- 6 failures: announce upgrade.
- 10 failures: announce zone state shift.

Examples:

```text
14 falls made this foothold.
Moon Shelf is Haunted.
This brick remembers overconfidence.
```

### Capped Feedback

If anti-griefing caps prevent a shared write, still acknowledge local play:

```text
Your fall was noticed, but Bell Shaft has heard enough from you today.
```

Do not imply the shared tower changed when it did not.

### Clear and Checkpoint Feedback

On zone clear:

```text
Lower Ruins stabilized by 3 clean climbs. Next: Bell Shaft, currently Haunted.
```

Show this in the checkpoint banner, not the mutation banner.

### Message Source

Generate feedback from structured state transitions:

- `before` zone state.
- `after` zone state.
- contribution result (`counted`, `capped`, `rate_limited`).
- threshold crossing.

Avoid hardcoding messages in Phaser.

---

## Key Technical Considerations

- Keep feedback short enough for mobile.
- Use `aria-live="polite"` for mutation and checkpoint banners.
- Do not shame individual failure. Positive achievements can name users; failures stay aggregate or anonymous.
- The first fall should always produce concrete feedback, even if it only affects local seeded/demo state during early development.

---

## How to Know It's Working

- Falling shows a banner within one second of respawn.
- The banner tells the player exactly what changed or why it did not count.
- Threshold crossings feel special without blocking play.
- Checkpoint clears explain stabilization and next-zone state.
- Messages fit on mobile without overlapping controls.

