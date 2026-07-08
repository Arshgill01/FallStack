# Phase 09 — Shared Mutation State & Persistence

> Implement Redis-backed daily zone counters, contribution writes, and pure artifact derivation from aggregate state.

---

## Context

This is the core hook becoming real. Falls do not directly place objects. They increment aggregate counters. Artifacts and badges are derived from those counters so the tower stays legible at any traffic level.

The architecture split matters: Phaser emits events or calls typed `/api` endpoints, the Devvit Web server validates and persists, pure game logic derives state.

---

## What This Phase Builds

### Daily State Shape

For each day and zone, store:

```ts
type ZoneMutationState = {
  zoneId: string;
  failures: {
    short_jump: number;
    overjump: number;
    wall_bonk: number;
    helper_overuse: number;
  };
  successfulClears: number;
  stabilizerUserId?: string;
  updatedAt: number;
};
```

Store daily meta separately:

```ts
type DailyTowerMeta = {
  date: string;
  seed: string;
  totalFalls: number;
  totalClimbs: number;
  summitCleared: boolean;
  firstSummitUserId?: string;
};
```

### Redis Key Scheme

Use date namespacing:

```text
fallstack:{YYYY-MM-DD}:meta
fallstack:{YYYY-MM-DD}:zone:{zoneId}
fallstack:{YYYY-MM-DD}:user:{userIdHash}:caps
```

Prefer hashes/counter fields over storing large JSON blobs when the Devvit Redis API makes that ergonomic. Counters should be additive.

### Mutation Write Flow

1. Phaser detects a fall and submits `{ dailySeed, zoneId, failureBucket, timestamp }` to `/api/record-fall`.
2. The Devvit Web server validates date, seed, zone, bucket, and authenticated user context.
3. The server increments the matching zone counter if contribution caps allow it.
4. The server returns fresh derived state for the zone or full tower.
5. The client applies the derived artifact state to Phaser.

### Pure Derivation

Implement pure functions:

- `deriveArtifacts(zoneState)`
- `deriveZoneBadge(zoneState)`
- `deriveMutationFeedback(before, after, contributionResult)`

Thresholds:

- 1 fall: local mark only.
- 3 matching failures: visible artifact.
- 6 matching failures: upgraded artifact.
- 10 matching failures: Haunted/Cursed pressure.
- 3+ successful clears after curse: downgrade/stabilize path.

### Zone Caps

Derived state must respect per-zone visual caps:

- 1 helpful artifact.
- 1 cursed/hazard artifact.
- 1 route hint or ghost arc.
- 1 zone state badge.

If multiple buckets qualify, choose the strongest or most relevant one deterministically. Do not render every qualifying failure as a separate object.

---

## Key Technical Considerations

- Redis state is authoritative; client state is optimistic at most.
- Do not persist individual fall objects.
- Do not store client-supplied usernames or text.
- Pure logic should be testable without Phaser or Devvit.
- Use additive counters to avoid last-write-wins problems.

---

## How to Know It's Working

- A fall increments the correct Redis counter.
- Reloading the post preserves shared mutation state.
- Three matching failures derive a visible artifact.
- Six matching failures derive an upgraded artifact.
- Ten matching failures affect the zone badge.
- Derived output is identical for identical counter input.
