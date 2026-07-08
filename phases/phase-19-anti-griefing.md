# Phase 19 — Anti-Griefing, Rate Limits & Contribution Integrity

> Harden the mutation system against abuse — enforce contribution caps, validate mutation events server-side, handle edge cases around rapid input, duplicate tabs, and malicious attempts to corrupt tower state.

---

## Context

By now the mutation pipeline exists: players fall, failure events fire, the server increments counters, artifacts spawn. The community loop works. But it works on good faith. A modified client could spam failures. A determined player could open ten tabs and inflate counters. A single skilled player could stabilize every zone in one session and flatten the experience for everyone else.

This phase closes those gaps. The caps defined in §29 of the concept log exist for game design reasons — they shape the community experience. This phase makes those caps enforceable, not just suggested.

The key principle: **caps limit shared impact, not play.** A player who hits their contribution ceiling can keep climbing, keep falling, keep playing. They just stop reshaping the tower for everyone else. The game doesn't punish them — it thanks them and moves on.

---

## What This Phase Builds

### Server-Side Cap Enforcement

The cap values from §29:

| Cap Type | Limit | Scope |
|----------|-------|-------|
| Matching failure contributions per zone | 3 per user per day | Per zone |
| Total failure contributions | 10 per user per day | Global |
| Clears that count toward stabilization | TBD per zone per day | Per zone |

These must be validated on the Devvit Web server, not the client. The client sends a mutation event to `/api/record-fall`; the server checks caps before writing to Redis. Even if someone patches the client JavaScript to skip local cap checks, the server rejects over-cap contributions.

Storage pattern for tracking caps:

```
fallstack:{date}:caps:{userId}:zone:{zoneId}:failures  → integer (HINCRBY)
fallstack:{date}:caps:{userId}:total_failures           → integer (HINCRBY)
fallstack:{date}:caps:{userId}:zone:{zoneId}:clears     → integer (HINCRBY)
```

The check-then-write flow:

1. Client sends `{ zoneId, outcome, failureType, ... }` to `/api/record-fall`
2. Devvit Web server receives it with authenticated server context
3. Server reads current cap counters for this user + date
4. If under cap: increment counter, write mutation to zone state, return `{ counted: true }`
5. If at/over cap: skip the mutation write, return `{ counted: false, reason: 'capped' }`
6. Client shows appropriate feedback either way

### Per-Zone Clear Caps

A skilled player shouldn't be able to stabilize every zone in one sitting. The clear cap limits how many clears from one user count toward a zone's stabilization threshold per day. The exact number is a tuning value — start with something like 2-3 per zone per day. The point is that stabilization requires community breadth, not individual skill.

### Session Integrity Validation

Every mutation event the server receives should be sanity-checked:

- **Seed validation:** The event references a daily seed. Verify it matches today's seed. Reject events referencing yesterday's seed (unless within a brief grace window around midnight).
- **Zone existence:** The `zoneId` in the event must correspond to a real zone in today's tower layout. Reject events for zones that don't exist.
- **Timestamp sanity:** If the event includes a client timestamp, verify it's within a reasonable window (e.g., not more than 5 minutes old, not in the future). This isn't about precision — it's about rejecting obviously bogus events.
- **Event type validation:** The `failureType` must be one of the defined buckets (`short_jump`, `overjump`, `wall_bonk`, `helper_overuse`). Reject unknown types.

### Concurrent Session Handling

Two tabs open, same user:

- Both tabs play independently on the client side
- Both send mutation events to the same Devvit backend
- The backend uses Devvit server user context for both — same user, same caps
- Redis operations use `HINCRBY` which is atomic — two concurrent increments won't corrupt the counter
- Cap checks happen atomically: read current value, check against cap, increment if under
- If there's a race where both tabs check "am I under cap?" simultaneously and both see "yes," the worst case is one extra contribution. This is acceptable — the cap is a design lever, not a security boundary.

### Rate Limiting

Prevent rapid-fire mutation events:

- Track the timestamp of the last processed mutation per user
- Reject mutations that arrive less than 1 second after the previous one
- Storage: `fallstack:ratelimit:{userId}:last_mutation` → timestamp
- This catches automated spam, not normal gameplay — a real player can't fall more than once per second anyway
- If a mutation is rate-limited, return `{ counted: false, reason: 'rate_limited' }` — the client can silently absorb this

### Capped-Feedback Experience

When a player hits a cap, the game doesn't break. It adjusts:

- The player still sees their local fall animation, their local feedback
- The result card still shows their attempt, their personal stats
- But the mutation banner shifts tone: instead of "Your fall awakened something in the Ruins," it says something like:
  - *"Your fall was noticed, but the Ruins have heard enough from you today."*
  - *"The Bell Tower remembers your earlier falls. Rest now."*
  - *"You've left your mark. Others will shape what comes next."*
- The game remains fully playable — climbing, falling, the core loop continues
- Only the shared mutation impact stops counting

This is critical for feel. Being capped should feel like completion, not punishment.

### Global Safety

Content injection prevention:

- **No user-generated text in shared state.** Artifact names, zone names, mutation messages — all system-defined. A player cannot write text that other players see (except their username for achievements, which comes from Devvit auth).
- **Contributor identity comes from Devvit Web server context / Reddit API helpers**, never from a client-supplied field. The client doesn't send a username — the server reads identity from authenticated context.
- **Mutation events are structured data**, not freeform. The event payload is a fixed schema: `{ zoneId, outcome, failureType, chargePercent }`. No string fields that get displayed to others.
- **Redis keys are server-constructed.** The client never specifies which Redis key to write to — the server builds the key from validated fields.

---

## Key Technical Considerations

- **Redis operations are server-side.** Use `redis` from `@devvit/web/server`. All Redis reads and writes happen in server endpoints, not the client. The client has no direct Redis access. This is the security model — the client is untrusted, the server is the authority.

- **Devvit server context is the source of truth for identity.** It comes from Devvit's authentication layer, not from anything the client sends. Use it for cap tracking, rate limiting, and leaderboard attribution.

- **`HINCRBY` is atomic.** Two concurrent calls to `HINCRBY` on the same field will both apply correctly — no read-modify-write races. Use it for all counter increments.

- **Caps shape community dynamics, not individual experience.** The design intent is that a tower's mutation state reflects the community, not one prolific player. A 10-contribution-per-day global cap means that even the most active player contributes roughly the same as 10 casual players combined — significant but not dominant.

- **Grace periods matter at boundaries.** Around midnight UTC when the daily seed rotates, a player might have a stale seed. Allow a brief grace window (e.g., 60 seconds) where events referencing the previous seed are still accepted but attributed to the new day's counters.

- **Don't over-engineer rate limiting.** The 1-second-per-mutation limit is a spam guard, not a precise throttle. If it occasionally lets through two events in quick succession due to clock skew, that's fine. The caps are the real protection.

---

## How to Know It's Working

- A player falls in the same zone 5 times with `short_jump` failures. The first 3 increment the zone counter. Falls 4 and 5 return `{ counted: false }` and the client shows a capped message. The zone counter stays at 3.

- Two different players each contribute to the same zone. Both see their contributions counted independently. Neither is affected by the other's cap state.

- A player opens two browser tabs. Falls rapidly in both. The total counted contributions across both tabs don't exceed the per-user cap. Redis counters are consistent.

- A mutation event with `zoneId: "nonexistent_zone"` is rejected by the server.

- A mutation event with `failureType: "custom_exploit"` is rejected by the server.

- After hitting the global 10-contribution cap, the player continues climbing. The game feels normal. They just stop seeing "your fall reshaped this zone" messages.

- No Redis key contains user-supplied text. All stored values are counters, system-defined strings, or Devvit-authenticated usernames.

- Shared state remains consistent after 50+ rapid mutations from multiple simulated users.
