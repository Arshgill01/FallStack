# Submission Closeout Architecture

## Invariants

- Preserve the first eight route platforms exactly; this pass does not tune movement or opening difficulty.
- Redis remains authoritative for shared state. Realtime carries revision hints only.
- The client never supplies a user ID, Redis key, display name, or resume destination to persistence.
- Every daily key is derived from the installation subreddit, UTC date, and tower version.
- No action posts, comments, subscribes, deploys, or publishes without an explicit user gesture or separate authorization.

## Daily player resume

Authenticated players resume at the latest checkpoint accepted by the server for the current board. The server derives the next checkpoint from a validated clear event and stores it under the authenticated `context.userId`. The record expires with the daily board.

Shared anonymous sessions are session-only because a LOID is experimental and a common anonymous key would let one visitor affect another visitor's resume. Disclosed local practice may retain a device-only checkpoint keyed by UTC day and tower version; it cannot write shared state or achievements.

The initialization response returns the authoritative resume zone and mode. Phaser restores only after both the scene and initialization are ready. A new UTC board naturally returns every player to spawn.

## Daily Reddit post lifecycle

A `00:05 UTC` scheduled task and the existing moderator menu call the same idempotent post creator. Redis `SET NX` reserves one post per installation, date, and tower version. A failed submission releases its short lease; a completed record retains the post ID long enough for support and duplicate navigation.

The post includes:

- the default lightweight entrypoint;
- a dated, community-scoped title;
- a plain Markdown text fallback;
- matching light/dark loading colors and tall height;
- bounded post data identifying the board date/version;
- a compact memory line derived from yesterday's retained board when available.

Yesterday's state is flavor and context, not a required platform or a new progression system. If yesterday had no organic activity, the copy says so instead of crediting generated scars to people.

## Summit and Reddit handoff

Tower Memory keeps the tower story as the visual hero and exposes three separate actions:

1. Return to the climb.
2. Discuss today's tower by navigating to the current Reddit post.
3. Copy a fixed, bounded result summary for a user-controlled comment.

The app does not auto-submit comments and does not combine discussion, copying, subscribing, or gameplay into one action.

## Honest activity language

Generated starting state is called `opening scars`. Human accepted events are called `community falls`, `community clears`, and `community summits`. Headlines must not describe the 37 generated failures as 37 people or 37 organic climbs.

The compact default is:

> 37 opening scars · N community falls

When `N` is zero, the interface says that the community has not added a fall yet.

## Shared update transport

Every accepted fall, clear, or summit persists to Redis first. The server then best-effort publishes `{ type, boardId, revision }` on the board ID Realtime channel. Clients receiving a newer revision fetch the authoritative snapshot and use the existing safe-point reconciliation rule. A missed or disconnected Realtime message is recovered by the revision poll and by visibility refresh.

Realtime delivery failure never rolls back an accepted mutation. The submission pitch remains `one shared daily tower`; it does not claim simultaneous physics.

## Evidence gates

Each implementation checkpoint receives targeted unit/integration checks and a focused commit. Final validation includes the complete project gate, mobile/desktop browser states, resume/reload, daily-post idempotency and rollover, two-client propagation, reduced motion, and a real-input spawn-to-summit run.

Five independent first-time participant results remain an external evidence gate. The repository will contain the exact protocol and blank evidence sheet; no synthetic answer will be represented as a human result.
