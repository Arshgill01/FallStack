# Shared Mutation Board ExecPlan

## Outcome

Make the community-authored tower—not the platforming shell—the unmistakable product. The shipped flow must prove shared scope before input, spatial cause-and-effect after an action, mechanical significance on the route, and a coherent whole-board story over the day.

The target architecture is defined in [`architecture.md`](architecture.md). Release gates are defined in [`scorecard.md`](scorecard.md), with the human M4 protocol in [`comprehension-test.md`](comprehension-test.md). Evidence and handoffs live in [`status.md`](status.md).

## Working scope decision

V1 is community-global inside one Devvit installation: all Fallstack posts in that subreddit resolve to the same daily board. Cross-subreddit global state is not available through native Redis and is out of implementation scope until the user explicitly approves an external shared service and its operational cost.

This is a working contract, not permission to hide the choice. Before public positioning is finalized, confirm whether “global” means community-global or cross-Reddit.

## Architecture boundaries

| Layer | Owns | Must not own |
| --- | --- | --- |
| Pure shared game logic | Board identity inputs, impact-site generation, observation validation/classification, threshold transitions, mutation receipts, snapshot/result derivation, fairness validation | Rendering, authenticated context, Redis |
| Phaser client | Movement observation, collision, safe reconcile points, site/artifact rendering, local structured events | Persistent bucket/site authority, Redis, usernames |
| React shell | `/api` lifecycle, revision reconciliation, banners/chronicle, loading and local fallback disclosure | Physics classification, persistent truth |
| Devvit server | Board scope from context, validation, transactional caps/idempotency/revision, persistence, identity, bounded history | Physics/rendering |

## Milestones

### M0 — Baseline and product contract

- Map the current data/event/render flow against repository evidence.
- Record the community-global vs cross-community platform boundary.
- Capture the current opening, first-fall, result, and API-failure states.
- Create Figma states for shared scope, exact mutation receipt, and whole-board memory using the selected Cutaway Reliquary grammar.
- Score the baseline with `scorecard.md`.

Exit:

- The sell, current reality, gaps, target schematic, scope constraint, and strict gates are reviewable.
- Figma states answer the three product questions without introducing a dashboard rail or tutorial wall.
- No production behavior has been changed under an unresolved scope assumption.

### M1 — Deterministic impact sites

- Add a pure impact-site derivation module based on adjacent generated route platforms.
- Generate stable site IDs, names, helper/hazard/ghost slots, and baseline path metadata.
- Replace mutation’s zone-global hard-coded slots with site-anchored derivation.
- Seed opening state at real sites, separating seeded and organic counters.
- Keep compatibility adapters only if needed for a staged migration; do not maintain two long-term models.

Tests first:

- Same seed/version yields identical sites and slots.
- Every site references real route platforms in its zone.
- Opening site affects the first jump and is inside the first viewport.
- Artifact slots remain within world/zone bounds and do not overlap the only route.
- Representative seeds remain reachable with no helpers and with every cursed site active.

Exit:

- A fall can resolve to a real route location, and the derived artifact is spatially credible.
- Existing tower/movement behavior remains unchanged outside mutation anchors.

### M2 — Observation and receipt contracts

- Replace client-supplied `failureBucket`/zone authority with a bounded `FallObservation`.
- Add pure server-side observation validation, impact-site resolution, and bucket classification.
- Add `BoardIdentity`, `BoardSnapshot.revision`, seeded/organic totals, and `MutationReceipt` types.
- Return structured receipts for falls, clears, summits, duplicates, caps, invalid evidence, and stale boards.
- Keep the current client response adapter only until M4 consumes receipts.

Tests first:

- Short jump, overjump, wall bonk, and helper overuse resolve deterministically from observation fixtures.
- Invalid platform/helper IDs and cross-zone coordinates are rejected.
- Every threshold transition produces the expected receipt and copy.
- Duplicate/capped/stale receipts never imply persistent change.

Exit:

- Persistent mutation choice is derived by shared pure logic on the server.
- UI has enough structured data to prove exact before/after consequence.

### M3 — Transactional board persistence

- Group board state under a small stable key set.
- Apply event idempotency, authenticated contributor cap, site counter, totals, revision, receipt, and visible mutation beat in one Devvit Redis transaction.
- Bound event receipts and recent mutation beats with the daily TTL and history cap.
- Make highest-climber, first-summit, and best-stabilizer updates concurrency-safe.
- Reduce snapshot reads with hashes/batched reads rather than one key per field.
- Preserve read-only play when writes fail and expose an honest rejected receipt.

Verification:

- Redis adapter/unit tests for transaction decisions where practical.
- Hosted or controlled concurrency harness: duplicates, same-site distinct users, one-user cap race, threshold race, stale date.
- Exact before/after counters and unique monotonically increasing revisions.

Exit:

- Accepted receipts correspond one-to-one with persistent mutations under retry and concurrency.
- No event is marked seen before its mutation transaction commits.

### M4 — First-viewport shared consequence slice

- Render community scope and board identity compactly before input.
- Render the opening impact site with cause, mechanical effect, organic/seeded context, and next threshold.
- On first fall, highlight the exact site and show the mutation receipt’s before/after and next consequence.
- Apply changed collision bodies at respawn/land/checkpoint, never mid-flight.
- Show capped, stale, and unavailable states honestly.
- Preserve fixed touch controls, keyboard input, reduced motion, and the selected Reliquary visual grammar.

Browser gates:

- 375×812 and 1280×800 opening, accepted fall, threshold-crossing fall, capped fall, and API failure.
- First-time comprehension test with at least five people: all can explain shared scope, earlier cause, and their next consequence.
- First five scorecard criteria reach 4/4.

Exit:

- The first 10 seconds cannot reasonably be described as only a Jump King clone.

### M5 — Mechanical artifact completion

- Make the five settled artifacts true to their documented semantics:
  - Corpse Stack: solid helpful foothold.
  - Mercy Nail: narrow solid ledge.
  - Ghost Platform: clearly semi-solid with a deterministic limited/temporary rule.
  - Cursed Brick: deterministic wobble/crumble timing hazard.
  - Lantern Trail: visual-only clear route memory.
- Tie helper overuse and clear stabilization to the same impact site.
- Preserve the site’s history through curse downgrade and stabilization.
- Validate that no mutation blocks the baseline route.

Exit:

- Mutation is mechanically significant, readable by shape, and fair across representative seeds.
- Mechanical-significance score is 4/4.

### M6 — Live community reconciliation

- Use board revision to fetch/reconcile only when needed.
- Surface bounded remote mutation beats without interrupting an active jump.
- Defer collision-body replacement until a safe reconcile point.
- Handle background/foreground, duplicate tabs, reload, and rollover.
- Keep network writes attempt/event based; no per-frame writes.

Exit:

- A two-client proof shows one player crossing a threshold and another client visibly/safely receiving the changed site.

### M7 — Tower Memory and daily story

- Replace the generic live `Result` affordance with a compact `Tower Memory` view.
- Show the vertical board, active sites, stabilizations, recent visible beats, summit state, and positive achievements.
- Finalize an end-of-day summary model separately from the live board view.
- Implement the settled next-day relic or remove the promise until it is real.
- Keep failures aggregate/anonymous and positive achievements attributable.

Exit:

- The whole-board view reads as a community-authored story, not a stats dashboard.
- Tomorrow’s hook is backed by stored/derived state.

### M8 — Hosted validation and release audit

- Run full project checks and production screenshot matrix.
- Run the complete scorecard and required test matrix.
- Hosted Devvit playtest with two authenticated sessions in the same installation.
- Verify UTC rollover, old app version/stale board, local fallback, quota/write failure behavior where feasible.
- Record command output, captures, versions, platform findings, and residual risk.
- Do not claim cross-subreddit scope without a separate approved service proof.

Required commands from `fallstack/`:

```text
npm run type-check
npm run lint
npm test
npm run build
```

Exit:

- Every core score is at least 3; shared scope, spatial cause, personal consequence, community consequence, and mechanical significance are 4.
- All system gates have direct evidence or an explicit blocker.
- Hosted behavior matches the product claim and architecture.

## Order and dependency rules

- M1 precedes API or rendering migration: the game needs real mutation locations before it can report them.
- M2 precedes M3: persistence stores validated domain decisions and receipts, not raw client claims.
- M3 precedes live UI claims: the UI cannot promise authoritative shared change until writes are atomic/idempotent.
- M4 is the first production vertical slice; do not migrate the whole climb before it passes comprehension and mechanical gates.
- M5 may reuse the current collision renderer but may not move physics or persistence into presentation modules.
- M6 must reconcile collision only at safe points.
- M7 may not turn the opening viewport into a dashboard.

## Risks and stop conditions

- **Meaning of global:** current working scope is community-global. Stop before adding external infrastructure or claiming cross-Reddit global state; ask for explicit approval.
- **Transaction behavior:** if hosted Devvit transactions behave differently from current official docs/types, record the exact failure and use the smallest recoverable design rather than silent best-effort writes.
- **Cheat resistance:** the server cannot replay full Phaser physics without a different architecture. Validate bounded observations and enforce caps; do not claim perfect anti-cheat.
- **Route fairness:** cursed mechanics must fail closed to the baseline route. If reachability proof is insufficient, do not ship mechanical hazards globally.
- **Visual density:** more impact sites do not permit more simultaneous labels. Cull by camera/priority and keep caps.
- **User-owned work:** preserve unrelated changes and update this plan if the working tree stops being clean.

## Progress

- [x] M0 current architecture/product audit.
- [x] M0 target architecture and strict scorecard documented.
- [x] M0 Figma shared-board states and baseline score.
- [x] M1 deterministic impact sites.
- [x] M2 observation and receipt contracts.
- [x] M3 transactional persistence — the production store now runs through an injectable Redis/context boundary, and a controlled watched-Redis harness proves conflicts, duplicate tabs, threshold ordering, caps, stale-day rejection, monotonic achievements, bounded history, and TTL. Hosted Devvit 0.13.7 semantics remain an M8 platform gate.
- [ ] M4 first-viewport slice — the complete mobile/desktop receipt matrix passes locally; the five-person comprehension gate remains open.
- [x] M5 mechanical artifacts.
- [ ] M6 live reconciliation — safe defer/apply, remote beat, rollover, and local two-snapshot browser proof pass; hosted two-client proof remains open.
- [x] M7 Tower Memory and honest daily story; the unsupported relic promise was removed instead of simulated.
- [ ] M8 hosted validation and release audit.
