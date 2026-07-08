# Phase 12 — Seeded Demo State

> Initialize believable community mutation state so a judge sees the shared hook in the first viewport before any real traffic exists.

---

## Context

The hackathon demo cannot depend on organic traffic. A judge opening the public post alone must see that today's tower already carries community memory. Seeded state is not a fake mode; it is the initial daily state that real contributions merge into.

No visible "demo mode" labels.

---

## What This Phase Builds

### Seeded Daily Counters

On first initialization of a daily tower, create baseline counters:

- Total headline around 37 failed climbs.
- 2-3 artifacts visible in Lower Ruins.
- One zone already Haunted or Cursed.
- At least one origin label: `14 falls made this foothold.`

Example starting shape:

```ts
Lower Ruins:
  short_jump: 14
  wall_bonk: 4
  overjump: 2

Bell Shaft:
  wall_bonk: 8
  overjump: 6

Moon Roof:
  overjump: 10
```

Tune exact values against first-viewport readability.

### Merge Real Contributions

Seeded values are counters in the same state as real play:

- Real contributions increment from the seeded baseline.
- Reloading preserves seeded + real state.
- The seed is only written once per date.

### First Viewport Proof

The opening screen must show:

- Headline: `Today's tower has 37 failed climbs in it.`
- A readable helpful artifact.
- A readable risky artifact or haunted badge.
- Origin text tied to one artifact.
- Compact controls hint.

### First Fall Proof

After the judge's first fall:

- Their contribution attempts to persist normally.
- The banner explains the exact effect.
- If a threshold is crossed, the visible artifact or badge changes.

### Seed Idempotency

Initialization must be safe:

- If today's meta key exists, do not rewrite seeded counters.
- If multiple players open the post simultaneously, only one initialization wins.
- If initialization partially fails, recover without doubling seeded counts.

---

## Key Technical Considerations

- Seeded state is part of the production daily lifecycle, not a client-only mock.
- Do not replace real state with seed state after real contributions exist.
- Do not label seeded state as demo.
- The seeded baseline should feel plausible, not overstuffed.
- The tower must remain finishable with seeded artifacts and curses active.

---

## How to Know It's Working

- Fresh daily state opens with the shared mutation hook visible immediately.
- The headline count matches seeded counters.
- Real falls increment from the seeded values.
- Refreshing does not duplicate seeded counters.
- A single judge alone still experiences mutation feedback in the first session.

