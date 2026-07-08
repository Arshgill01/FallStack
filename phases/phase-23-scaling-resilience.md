# Phase 23 — Scaling & Resilience

> Make the shared state model hold up under low traffic, high traffic, duplicate tabs, reloads, failed writes, and stale clients.

---

## Context

The game must work for one judge and for hundreds of players. The state model is intentionally aggregate: counters, thresholds, and capped derived artifacts. This phase hardens that model.

---

## What This Phase Builds

### Traffic-Level Behavior

Validate the intended scaling model:

- 1 player: seeded state and personal falls make the hook visible.
- 10 players: most contributions count.
- 50 players: artifacts remain capped and legible.
- 100 players: zone state communicates aggregate pressure.
- 500 players: counters continue to work without storing fall objects.

### Write Resilience

Handle:

- Redis write failure.
- stale daily seed.
- duplicate event retry.
- webview reload mid-attempt.
- backend timeout.

Client feedback should distinguish local play from shared writes:

```text
Your fall was felt here. The tower will remember when the connection returns.
```

Use this carefully; do not claim persistence if it failed.

### Polling / Refresh

If no real-time pubsub exists:

- Poll shared state at a modest interval.
- Refresh after mutation writes.
- Refresh after checkpoint writes.
- Avoid per-frame network calls.

### Idempotency

Mutation events should carry a client-generated attempt ID. Server can use it to avoid double-counting retries within a short TTL window.

### Graceful Degradation

If shared state cannot load:

- Show the seeded local/default state.
- Allow solo play.
- Mark shared writes as unavailable.
- Do not crash the post.

---

## Key Technical Considerations

- Batch state writes per attempt, not per jump or frame.
- Keep Redis payloads small.
- Derive artifacts client-side from server-returned counters, but treat server counters as authoritative.
- Avoid background polling that burns platform quotas.

---

## How to Know It's Working

- Duplicate mutation retries do not double-count.
- Reloading mid-session recovers daily state.
- High counters still derive at most the capped number of visible artifacts.
- Failed Redis writes do not break local gameplay.
- Polling updates the tower without excessive network calls.

