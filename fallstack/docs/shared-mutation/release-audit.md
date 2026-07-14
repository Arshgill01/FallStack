# Shared Mutation Release Audit

Status: technical candidate verified; human comprehension gate open, 2026-07-14.

## Candidate

- Product-code commit: `6b0b7d0`.
- Uploaded app: `0.0.20`.
- Installed playtest: `v0.0.20.2` in `r/fallstack_dev`.
- Scope: one community-wide daily board per Devvit installation. Cross-Reddit state is not claimed.
- Local gate: type-check, lint, 108 tests, build, and diff check passed. The existing expanded Phaser chunk-size warning remains.

This audit applies the requirements in [`scorecard.md`](scorecard.md), the milestone exits in [`EXECPLAN.md`](EXECPLAN.md), and settled decision §39 in [`../../../fallstack_concept_log.md`](../../../fallstack_concept_log.md). Historical progress is not evidence unless a current file, test, capture, installed version, or runtime result still supports it.

## Release decision

**Do not release yet.** Seven core criteria pass at 4/4. Shared-scope comprehension remains 3/4 because [`comprehension-test.md`](comprehension-test.md) has no five-participant result. The scorecard forbids averaging this away and requires the first five criteria to reach 4/4.

No production-code change is justified from the remaining evidence gap. The next valid action is the non-leading five-person test. Automated assertions, Figma inspection, or agent interpretation cannot substitute for it.

## Core proof gates

| Criterion | Verdict | Evidence |
| --- | --- | --- |
| Shared scope comprehension | **OPEN · 3/4** | Opening and Tower Memory name `r/fallstack_dev`, one community, one daily tower, seeded cause, and the same named site. Figma frame `21:2` and the 375×812 runtime capture support the presentation, but no first-time participant record exists. |
| Spatial cause and effect | **PASS · 4/4** | `impact-sites.test.ts` proves deterministic platform-backed sites and route-safe slots; `mutation-events.test.ts` proves server resolution from bounded observations; `.playwright-cli/m4-receipt-top.png` shows the exact First Gap foothold highlighted. |
| Personal consequence | **PASS · 4/4** | `mutation-receipts.test.ts`, `receipt.test.ts`, and the M4 accepted/threshold/capped/unavailable captures prove accepted state, board revision, exact site, counter before/after, immediate effect, and next threshold. |
| Community consequence | **PASS · 4/4** | `reconciliation.test.ts` proves defer/apply rules; `.playwright-cli/m6-deferred-airborne.png` and `m6-applied-on-land.png` prove safe application. Hosted client B independently moved `R37 → R39` without reload and exposed the six-fall First Gap Mercy Nail after client A's writes. |
| Mechanical significance | **PASS · 4/4** | `artifact-mechanics.test.ts`, `mutation.test.ts`, `impact-sites.test.ts`, and `tower.test.ts` prove solid helpers, one-way Ghost timing, Cursed crumble timing, stabilization, caps, and baseline finishability. M5 captures prove the runtime states and respawn reset. |
| Persistence authority | **PASS · 4/4** | `board-store.test.ts` executes the production store through watched conflicts, ordered distinct-user revisions, 100 duplicate tabs, caps, stale dates, monotonic achievements, bounded history, retry exhaustion, and TTL. Installed Devvit accepted hosted writes `R37 → R39`. |
| Trust and failure honesty | **PASS · 4/4** | `mutation.test.ts` proves seeded/organic accounting; structured stale/capped/unavailable receipt tests prove unchanged state; the local `/api` failure capture discloses that shared marks are not written. |
| Whole-board story | **PASS · 4/4** | `tower-memory.test.ts`, Figma frame `25:10`, and mobile/desktop M7 captures prove one compact summit-to-spawn route with real sites, scars, bounded beats, achievements, summit state, and only the implemented UTC rollover promise. |

## System gates

| Gate | Verdict | Direct evidence and residual risk |
| --- | --- | --- |
| Determinism | PASS | `board.test.ts`, `impact-sites.test.ts`, and `tower.test.ts` cover board identity, sites, platforms, and representative seeds. |
| Idempotency | PASS | Production-store test submits one event from 100 duplicate tabs and persists one mutation/receipt. |
| Concurrency | PASS | Production-store harness proves ordered same-site distinct-user writes, final-cap races, achievement winners, conflict retry, and no partial write after exhausted retries. Hosted sequential writes prove the Devvit adapter; a deliberately forced simultaneous hosted watch conflict remains a documented P2 diagnostic risk, not a contradicted product behavior. |
| Stale board | PASS | Validation and route tests return a structured 409 stale receipt and write to neither old nor current board. |
| Bounds | PASS | Event, observation, impact-site, and tower tests reject malformed numbers, foreign platform/helper IDs, cross-zone claims, and invalid geometry. |
| Artifact caps | PASS | High-traffic derivation remains within per-zone visual caps; bounded history retains only the newest 20 visible beats. |
| Baseline route | PASS | Representative seeds remain finishable without helpers and with all hazards active; cursed slots do not cover the only route. |
| Safe reconcile | PASS | Pure rules defer airborne changes; local browser applies on landing; hosted grounded client applies without reload. |
| Mobile first viewport | PASS visually | 375×812 opening exposes shared scope, First Gap cause/effect, opening route, and three ≥50 px controls. Semantic comprehension remains isolated to the open human gate above. |
| Accessibility | PASS | Shape-specific collision grammar, reduced-motion substitutions, focus return, Escape close, fixed touch targets, contrast review, and live-region receipt states are recorded in `docs/design-redesign/status.md`. |
| Performance | PASS | Splash loads no Phaser bundle; reload leaves one canvas; sync writes remain event-based; `/api/board-revision` reads one metadata field and unchanged clients do not fetch the full board. The known expanded Phaser chunk warning is unchanged. |
| Devvit hosted proof | PASS | Two independently loaded authenticated Safari webviews read `R37`; client A's normal game path persisted two events; client B polled and rendered `R39`/Mercy Nail without reload; playtest logs showed no runtime error. |

## Required scenario matrix

| Scenario | Verdict | Evidence |
| --- | --- | --- |
| No organic activity | PASS | Seeded snapshot totals agree with 37 and expose First Gap before input; splash/mobile captures show the same truthful opening. |
| One player | PASS | Hosted client A produced exact ordered fall mutations and Tower Memory state. |
| Ten players | PASS in controlled store | High-traffic production-store test uses ten distinct contributors at each of seven site/bucket pairs and preserves exact ordered history. |
| High traffic | PASS | 500-count pure derivation respects artifact caps; 70 production-store writes retain only the newest 20 visible beats. |
| Duplicate tab and retry storm | PASS | 100 identical submissions persist once; forced conflicts either retry atomically or leave no event/partial mutation. |
| Same user spamming one site | PASS | Per-site third-contribution and daily tenth-contribution limits are transactionally enforced; missing identity fails closed. |
| Different users cross one threshold concurrently | PASS | Alice/Bob production-store race preserves both increments, one threshold transition, and unique ordered revisions. |
| Clean clears after a curse | PASS | Clear resolution selects the failed site; six clears stabilize it while all failure history remains intact. |
| API unavailable | PASS | Local play remains usable and explicitly says shared marks are not written; unavailable receipts prove board/revision unchanged. |
| UTC rollover/version change | PASS | Old-board events are rejected without writes; reconcile rules accept a lower-revision new board; rollover browser state names the UTC boundary. |
| Desktop/touch/keyboard/focus/reduced motion/reload/checkpoint/summit/Tower Memory | PASS | Production screenshot matrix, pointer-hold and keyboard checks, focus/Escape checks, reduced-motion capture, two-reload one-canvas assertion, progression/summit tests, and M7 mobile/desktop dialog captures cover the representative flows. |

## Remaining gate procedure

1. Record the installed version and UTC date in [`comprehension-test.md`](comprehension-test.md).
2. Run the exact neutral script with five fresh first-time participants, at least three on phone-sized viewports.
3. Preserve verbatim answers before scoring shared scope, earlier cause, and personal next consequence.
4. If any one point fails, keep M4 and M8 open, classify the failure, change the smallest relevant Figma/runtime element, rerun browser checks, and repeat with five fresh participants.
5. Only after all five pass, update this audit, M4/M8 progress, and the current score to shared-scope 4/4.
