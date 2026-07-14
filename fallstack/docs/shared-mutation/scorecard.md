# Shared Mutation Product Scorecard

This scorecard is a release gate, not a taste survey. Score each item from 0 to 4 and attach evidence. A milestone cannot pass by averaging away a failed core criterion.

The current candidate's requirement-by-requirement verdict is recorded in [`release-audit.md`](release-audit.md).

## Core proof gates

All eight core criteria must score at least 3. The first five must score 4 before a production release.

| Criterion | 0 | 2 | 4 | Required evidence |
| --- | --- | --- | --- | --- |
| Shared scope comprehension | No shared scope | “Today/community” copy is present but ambiguous | A first-time player correctly identifies who shares the board and that everyone is changing the same tower | [`comprehension-test.md`](comprehension-test.md) plus first-viewport capture |
| Spatial cause and effect | Counters only | Artifact changes somewhere in the zone | The exact failed approach maps to a named impact site and visible route object | Deterministic pure test plus recorded first-fall run |
| Personal consequence | Generic “counted” banner | Count changes | Receipt shows before/after, exact site, immediate effect, next threshold, and accepted/capped state | API contract test plus browser capture |
| Community consequence | Polling silently replaces state | Totals update | Another client crosses a threshold and the first client safely reconciles and highlights the changed site | Two-client browser or integration proof |
| Mechanical significance | Visual-only mutation | Helper collision changes | Helpful, cursed, and stabilized states materially change an optional route while baseline finishability remains | Gameplay smoke plus reachability tests |
| Persistence authority | Client chooses mutation | Server validates shape | Server derives site/bucket and atomically applies idempotency, cap, counters, revision, and receipt | server tests or hosted concurrency harness |
| Trust and failure honesty | Seed/offline state looks live | Fallback text exists | Seeded vs organic totals and local vs shared state are truthful and readable | API-failure capture plus snapshot assertions |
| Whole-board story | Generic live stats | Result summary | Compact tower memory shows scars, stabilizations, latest beats, summit, and only a truthful implemented rollover/carryover promise | Figma/runtime capture plus data tests |

## System gates

| Gate | Pass condition |
| --- | --- |
| Determinism | Same board identity and seed produce identical platforms, site IDs, anchors, thresholds, and snapshot derivation |
| Idempotency | 100 duplicate submissions for one event ID apply exactly one mutation and return the same stored receipt |
| Concurrency | Concurrent distinct events do not lose increments, exceed contributor caps, reuse a revision, or corrupt achievement winners |
| Stale board | A previous date/version event returns a structured stale receipt and never writes to the current board |
| Bounds | Invalid platform/site IDs, coordinates, timestamps, and impossible zone associations are rejected |
| Artifact caps | High-traffic counters never exceed visual density limits |
| Baseline route | Every representative seed remains finishable without helpful artifacts and with every cursed site active |
| Safe reconcile | Remote collision updates never teleport/trap an airborne player; application occurs only at an allowed sync point |
| Mobile first viewport | 375×812 shows shared scope, one contextual artifact, its origin/effect, the opening jump, and usable controls |
| Accessibility | Shape communicates collision semantics, copy has sufficient contrast, focus and touch targets pass, and reduced-motion substitutes remain informative |
| Performance | No Phaser bundle in splash; expanded bundle growth is recorded; board sync does not issue per-frame or per-artifact network writes |
| Devvit hosted proof | Playtest demonstrates two authenticated sessions reading the same community board and applying a visible threshold change |

## Verification loop

Every milestone follows the same loop:

1. Write the behavior as a falsifiable acceptance statement.
2. Add the narrowest deterministic test or reproduction that currently fails.
3. Implement only enough to make that behavior true.
4. Run targeted tests and inspect the resulting snapshot/receipt.
5. Exercise the real browser flow at 375×812 and 1280×800 where user-visible.
6. Re-score the affected criteria with concrete evidence.
7. Run `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` before a milestone is marked complete.
8. Record commands, captures, failures, workarounds, and residual risks in `status.md`.

“Tests pass” is insufficient if the test does not cover the acceptance statement. A screenshot is insufficient for persistence or mechanical significance. A unit test is insufficient for first-viewport comprehension.

## Required test matrix

- No organic activity: seeded opening is clear and truthful.
- One player: first fall receives an exact receipt; visible threshold is reachable quickly.
- Ten players: several sites progress without clutter.
- High traffic: site/zone caps hold and history stays bounded.
- Duplicate tab and retry storm: one mutation per event.
- Same user spamming one site: cap is enforced transactionally.
- Different users crossing the same threshold concurrently: one ordered revision stream, no lost increments.
- Clean clears after a curse: history remains visible while mechanics downgrade and then stabilize.
- API unavailable: local play works and never claims shared persistence.
- UTC rollover or tower-version change mid-session: stale event is rejected and a new board is loaded.
- Representative desktop, touch, keyboard, focus, reduced-motion, reload, checkpoint, summit, and Tower Memory flows.
