# Fallstack Devvit Route and Persistence Experiment

Date: 2026-07-12

## Purpose

Exercise Fallstack's real Hono `/api` routes, `@devvit/web/server` context, validation, and Redis capability behavior below the blocked Reddit host surface. This is stronger than pure mutation/event tests but remains a local first-party harness, not proof of hosted Redis or iframe behavior.

## Harness

- Published `@devvit/test@0.13.7` and Vitest 4.1.10 installed ephemerally with no committed dependency change.
- Verified `redis-memory-server@0.17.0` override and `/usr/bin/redis-server` system binary used to avoid the published harness dependency vulnerabilities/download stall.
- The harness's missing post-context fixture was worked around explicitly by constructing `Context({...headers, [Header.Post]: postId})` and nesting each real `api.request()` call in `runWithContext()`.
- Production route source was imported directly; no copy or service-layer substitute was tested.
- Redis state was isolated and cleared by `createDevvitTest()` between cases.

## Scenarios

Seven tests issued 101 route requests:

1. `GET /init-game`, a structurally valid stale-seed fall, sequential duplicate fall, and per-user/per-bucket cap.
2. Twenty concurrent submissions with the same fall attempt ID.
3. Twenty concurrent unique fall IDs in one bucket.
4. Two authenticated identities contributing four falls each in the same bucket.
5. Twelve concurrent unique falls spread across all four buckets to cross the daily cap.
6. Ten concurrent unique clears plus ten concurrent submissions of one summit ID.
7. Injected Redis failure immediately after the NX event claim, followed by an identical retry.

Every concurrency case checked both response `counted` values and a fresh `/init-game` snapshot so a plausible response could not hide a lost or duplicated aggregate write.

## Results

Normal flows passed:

- stale seed returned HTTP 409;
- sequential duplicate counted once;
- 20-way duplicate race counted exactly once and persisted exactly +1 fall;
- 20 unique same-bucket races counted/persisted exactly 3;
- two identities each received their own three-count bucket allowance, persisting exactly 6;
- 12 mixed-bucket races respected the daily maximum, persisting exactly 10;
- 10 clear races persisted exactly 3;
- 10 identical summit races persisted exactly 1.

Final run after the HTTP-status fix: 7/7 tests passed in 2.09 seconds.

## App-owned findings

### Fixed — caught server exceptions were HTTP 400

All four route catch blocks used the shared error helper without a status, whose default is 400. A simulated Redis exception therefore looked like a client error. Fallstack now explicitly returns 500 for caught initialization, fall, clear, and summit failures; validation remains 400 and stale seed remains 409.

Impact: clients, monitoring, and platform traces can distinguish retryable/internal failures from rejected payloads.

### Open — NX claim can poison retry after a partial failure

`seenEvent()` writes the attempt marker with `NX` before cap/counter/achievement work. When the next Redis increment was forced to reject:

1. the route returned its internal-error response;
2. the aggregate fall total remained unchanged;
3. retrying the identical event returned `counted: false` / “already heard” because the marker survived;
4. a sibling increment launched through `Promise.all` may already have consumed part of the user's cap.

This is at-most-once claiming, not recoverable idempotency. Simply moving the marker to the end would reintroduce double-counting under concurrency—the 20-way tests demonstrate why the atomic claim exists.

Required design work: make claim, cap decisions, aggregate increments, and durable result transition one recoverable transaction/state machine, or store enough per-event state to resume/reconcile an interrupted attempt. Test failures after each write boundary. Hosted Redis semantics and duplicate tabs must still be verified in real playtest.

## Platform feedback learned from the experiment

The first-party harness delivered real value once request context was manually supplied: isolated Redis state, real capability calls, concurrency, and fault injection found an application bug and proved multiple caps/idempotency paths. This should be stated positively in the feedback.

The same experiment sharpens the missing-context complaint: post-scoped route integration required manual nesting with experimental `@devvit/server` context APIs that the testing guide does not show. First-class post/comment/logged-out fixtures would turn this from specialist plumbing into the advertised production-like path.

## Limitations

- No Reddit iframe, client fetch boundary, network latency, hosted Redis service, duplicate browser tabs, or real authenticated/logged-out request was involved.
- The in-memory Redis server supports atomic primitives used here, but passing locally does not prove Devvit production race, retry, expiration, or outage behavior.
- The fault was injected at one boundary only. A complete persistence design needs a failure matrix across claim, both cap increments, aggregate increments, achievement merge/write, and response loss.

## Cleanup requirement

The experiment-only test file, temporary `redis-memory-server` package override, and no-save harness packages must be removed. Run `npm ci` afterward and confirm the committed application returns to its lockfile-defined 0-vulnerability dependency state.
