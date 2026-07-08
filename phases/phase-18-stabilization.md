# Phase 18 — Stabilization System & Clear Rewards

> Implement the positive side of shared mutation: clean clears downgrade curses, stabilize routes, and recognize helpful players.

---

## Context

Failure must help, but accumulated failure must distort. Stabilization is the counterweight. Skilled players should feel like they can repair the route for the community without erasing its history.

This phase consumes checkpoint clear events and writes positive shared contributions.

---

## What This Phase Builds

### Clear Contributions

When the player crosses from zone `N` to zone `N + 1`:

- Count a successful clear for zone `N`.
- Apply per-user clear caps.
- Increment `successfulClears` in that zone's state if counted.
- Re-derive badge/artifacts.

### Badge Recovery

Use clear counts to reduce curse pressure:

- 3 clean clears after a curse: Cursed downgrades toward Haunted/Reinforced.
- 6 clean clears: zone becomes Stabilized for the rest of the day.

The exact badge derivation should stay in pure game logic and be test-covered.

### Stabilized Artifact Behavior

Stabilized zones:

- Keep artifacts visible as history.
- Reduce hazard intensity.
- Calm wobble/pulse animations.
- Make helper artifacts feel safer.

Do not delete the community's history from the tower.

### Stabilizer Identity

Positive achievements may name users:

```text
u/riverknife stabilized the Lower Ruins.
```

Failure contributions remain aggregate or anonymous.

Store stabilizer identity from Devvit-authenticated user context, not client-supplied text.

### Clear Feedback

Checkpoint banner examples:

```text
Lower Ruins settles quiet.
u/riverknife stabilized the Lower Ruins.
Next: Bell Shaft, currently Haunted.
```

Keep the player moving. No menu gate after a clear.

---

## Key Technical Considerations

- Clear writes follow the same additive-counter pattern as failure writes.
- Per-user clear caps prevent one player from instantly stabilizing every zone.
- Stabilization should not make the tower trivial; it should reduce the worst community distortion.
- Result card should use stabilization data for "best stabilizer."

---

## How to Know It's Working

- Clearing a zone increments `successfulClears`.
- Cursed zones downgrade after enough clean clears.
- Zones can become Stabilized.
- Stabilizer usernames appear only for positive achievements.
- Stabilized artifacts remain visible but calmer.
- Clear caps apply server-side.

