# Phase 17 — Daily Tower Rotation & Seed Management

> Implement the daily seed, date-namespaced state, reset lifecycle, and yesterday-to-today continuity.

---

## Context

Daily return anticipation is one of the product pillars. Everyone climbs the same tower today. Tomorrow, the tower changes, but a memory of yesterday can return as flavor.

This phase ties generation and persistence to calendar time.

---

## What This Phase Builds

### Daily Seed

Derive the seed from UTC date:

```ts
const dateKey = new Date().toISOString().slice(0, 10);
const seed = hash(`fallstack-${dateKey}`);
```

Use UTC for the boundary so all players share the same tower.

### Date-Namespace Keys

Store all daily state under the date:

```text
fallstack:{YYYY-MM-DD}:meta
fallstack:{YYYY-MM-DD}:zone:{zoneId}
fallstack:{YYYY-MM-DD}:caps:{userIdHash}
fallstack:{YYYY-MM-DD}:result
fallstack:{YYYY-MM-DD}:relic
```

Set TTLs around 48 hours unless a result card archive needs longer retention.

### Initialization Flow

On load:

1. Compute today's date key and seed.
2. Read today's meta.
3. If missing, initialize tower meta, seeded state, and TTLs.
4. Generate tower from today's seed.
5. Load zone counters.
6. Derive artifacts and pass state to Phaser.

Initialization must be idempotent.

### Day Change Handling

If the player keeps the post open across the daily boundary:

- Detect stale date on next persistence attempt or polling tick.
- Notify shell to reload today's state.
- Avoid writing yesterday's events into today's counters unless intentionally within a short grace window.

### Daily Relic

Carry one visual/narrative memory forward:

```text
Yesterday's Bell of Shame returns as a relic.
```

For v1, the relic is flavor only. Do not add a complex mechanical relic system before submission.

---

## Key Technical Considerations

- All players on the same UTC date must get the same tower.
- Seeded demo state is written during daily initialization, not on every load.
- Redis TTL cleanup should not delete today's active state.
- Avoid local timezone ambiguity in key names.
- The result card should display the daily seed/date.

---

## How to Know It's Working

- Same date loads the same tower after refresh.
- Different date loads a different tower.
- Today's counters do not mix with yesterday's counters.
- Seeded state initializes once per date.
- A yesterday relic can be shown without changing gameplay balance.

