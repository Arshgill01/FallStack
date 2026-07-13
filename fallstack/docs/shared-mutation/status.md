# Shared Mutation Board Status

## Current gate

The local vertical slice is complete through M7. M3 and M6 still require authenticated hosted transaction/two-client proof, M4 still requires the five-person comprehension check, and M8 release audit is in progress.

## Product read

Fallstack now resolves bounded fall evidence to a real impact site on the server, stores exact site counters in a watched transaction, renders exact accepted/rejected receipts, gives Ghost/Cursed artifacts deterministic route-safe mechanics, reconciles newer boards only at safe collision points, and presents the day as a three-zone Tower Memory. The decisive remaining gap is hosted multi-client evidence; human comprehension testing is also unrun.

## Completed evidence

- Read `PRODUCT.md`, the canonical Settled Grill Decisions, root/local `AGENTS.md`, the current redesign status/ExecPlan/art bible, source, tests, package manifest, and current git state.
- Verified the working tree was clean at the start of this pass.
- Mapped the current pure/client/server/Redis flow in [`architecture.md`](architecture.md).
- Documented strict release gates and the recurring verification loop in [`scorecard.md`](scorecard.md).
- Created the implementation plan in [`EXECPLAN.md`](EXECPLAN.md).
- Inspected the existing Figma file `h24S9x4pxMjPaVyj5LqrSk`: seven pages, selected Reliquary directions, ten Art Bible frames, local color/metric variables, five text styles, two depth styles, and the reusable Touch Control/Stamped Label components.
- Verified exact Figma fonts: Shippori Mincho Bold; Zen Maru Gothic Regular/Bold.
- Verified current official Devvit Redis constraints: state is isolated per app installation/subreddit; transactions exist for related conditional writes; cross-community state requires an explicitly designed shared service.
- Verified installed Devvit 0.13.7 typings expose `watch`, `multi`, `exec`, and transactional `hIncrBy`.
- Added the Figma page `20:2` (`Shared Mutation Board`) and validated the three-state proof wrapper `20:3`:
  - opening contract `21:2` names one shared community tower, shows that the day opened scarred, ties four falls to First Gap, and states the next threshold;
  - mutation receipt `23:6` shows revision `37 → 38`, the affected First Gap stack, counter `4 → 5`, and the next mechanical consequence;
  - Tower Memory `25:10` maps Lower Ruins, Bell Shaft, and Moon Roof as one vertical daily board with scope, revision, latest mutation, and summit state.
- Reused the selected Reliquary variables, fonts, Touch Control, and Stamped Label component; no parallel component system or dashboard rail was introduced.
- Added `src/shared/game/impact-sites.ts`: three stable candidate sites per zone, each attached to adjacent route platforms with helper, hazard, and ghost slots plus baseline path IDs.
- Extracted shared zone constants into `src/shared/game/zones.ts`, removing the mutation/tower dependency cycle needed for geometry-backed mutation derivation.
- Removed the hard-coded artifact coordinate table. Every derived artifact now includes `siteId`, `siteName`, and `anchorPlatformId` and renders at a generated site slot.
- Corrected seeded-state honesty: the displayed 37 opening falls now equal the failure-bucket sum (previously 138). Snapshots expose `seededFalls`/`organicFalls`; artifacts expose `seededCount`/`organicCount`.
- Made `First Gap` a four-fall Corpse Stack on the actual opening jump. Splash and expanded-game opening copy now name one-community scope, site, seeded origin, and delayed local fallback honestly.
- Verified a controlled browser attempt changes local fallback exactly `37 → 38`; the fall touched the helper and produced the expected helper-overuse consequence.
- Added bounded `FallObservation` validation and pure server-side site/bucket resolution. The client no longer supplies persistent zone or failure-bucket authority.
- Added explicit community `BoardIdentity`, monotonic board revision, per-site seeded/organic counters, bounded mutation beats, and structured accepted/duplicate/capped/stale/invalid receipts.
- Replaced scattered event reservation/cap/counter writes with one watched Redis transaction covering idempotency, contributor caps, exact site counters, totals, revision, receipt, achievements, history, and TTL. Pure planning tests submit one event 100 times and apply one mutation.
- Added the accepted-fall runtime receipt: `MUTATION COUNTED`, `BOARD r37 → r38`, `First Gap`, `SHORT JUMPS`, and `4 → 5`; Phaser outlines the exact receipt site for 5.2 seconds.
- Added accepted, threshold, capped, stale, and unavailable receipt states at 375×812 plus accepted/desktop coverage at 1280×800. Transaction failure now returns a structured unchanged-board receipt when a snapshot is available.
- Implemented a one-way 900 ms Ghost Platform and a solid 650 ms Cursed Brick crumble. Both reset per attempt; reduced motion preserves shape/state without oscillation; the baseline route remains valid across representative seeds.
- Added 15-second revision polling, safe-point defer/apply, rollover-aware reconciliation, and sparse remote community beats. A deterministic browser proof held revision 41 while airborne and applied it on landing.
- Replaced `Result` with a three-zone Tower Memory using Lower Ruins, Bell Shaft, and Moon Roof. It shows the active real site, status, artifact, latest beats, summit, positive achievements, local session, and an honest UTC rollover; the unimplemented relic promise and stale celestial display names are removed.
- Uploaded app `0.0.17` and installed playtest `v0.0.17.2` in `r/fallstack_dev`.
- Uploaded the complete local M5–M7 build as app `0.0.18` and installed playtest `v0.0.18.2` in `r/fallstack_dev`.

## Baseline score

Provisional from code/design evidence. Scores requiring user testing, two-client runtime, or hosted concurrency cannot exceed 2 yet.

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Shared scope comprehension | 2/4 | “failed climbs today” and seeded artifact read, but installation/community scope is not named |
| Spatial cause and effect | 1/4 | fixed artifact slots per large zone rather than actual failed ledges |
| Personal consequence | 2/4 | count/threshold prose exists, but no structured receipt or exact before/after site |
| Community consequence | 1/4 | 45-second snapshot polling silently replaces state; no remote beat or revision |
| Mechanical significance | 2/4 | helpers are solid, but Ghost/Cursed documented semantics are not mechanically implemented |
| Persistence authority | 1/4 | client selects bucket; event reservation and related writes are not atomic |
| Trust and failure honesty | 2/4 | local fallback is disclosed, but seeded and organic totals are merged |
| Whole-board story | 2/4 | current result summarizes aggregate state but has no board map/history/finalization |

No production release gate passes this baseline.

## Figma proof score

This scores the product communication in the proof states only. It does not raise the runtime baseline or waive persistence/mechanics evidence.

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Shared scope comprehension | 4/4 | opening and Tower Memory both say one community shares one daily tower |
| Spatial cause and effect | 4/4 | First Gap is named in-world, outlined on receipt, and repeated in the board route |
| Personal consequence | 4/4 | accepted receipt shows revision and exact counter before/after plus next threshold |
| Community consequence | 3/4 | the shared revision and board history are clear; a remote live-change state is still required in M6 |
| Mechanical significance | 3/4 | helpful/wobble/solid consequences are named and shaped; real Ghost/Cursed mechanics remain M5 |
| Whole-board story | 4/4 | the vertical memory reads as a route history rather than a statistics dashboard |

M0 visual exit criteria pass. Runtime criteria remain capped by the source baseline above.

## M1 runtime score

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Shared scope comprehension | 3/4 | splash and opening live-region copy now say one community shares one tower; authenticated community label remains M2/M4 |
| Spatial cause and effect | 2/4 | artifacts are anchored to real named route sites; the event still does not resolve the player's nearest failed site |
| Mechanical significance | 3/4 | First Gap is a real solid optional foothold and all hazard slots preserve the baseline route; full Ghost/Cursed rules remain M5 |
| Trust and failure honesty | 3/4 | seeded totals are internally consistent and separated from community additions; authoritative receipts/revisions remain M2/M3 |

Production release gates still do not pass: authenticated transaction concurrency, full artifact semantics, remote community consequence, unavailable-write receipts, comprehension testing, and whole-board history remain unresolved.

## M2–M4 implementation score

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Shared scope comprehension | 3/4 | opening names one community; the server snapshot carries authenticated scope label, but five-person comprehension is unrun |
| Spatial cause and effect | 4/4 | bounded evidence resolves to a generated route site; the accepted receipt names and outlines that exact slot |
| Personal consequence | 4/4 | accepted runtime receipt exposes board revision, site, bucket, exact before/after count, and next consequence |
| Persistence authority | 3/4 | watched transaction and pure retry/idempotency decisions exist; hosted concurrent execution is not yet proven |
| Trust and failure honesty | 4/4 | seeded/organic provenance and accepted/capped/stale/invalid/unavailable unchanged-board receipts are explicit |
| Mechanical significance | 4/4 | all five artifacts now match their documented collision/timing semantics and preserve the baseline route |

## M5–M7 local implementation score

| Criterion | Score | Evidence |
| --- | ---: | --- |
| Shared scope comprehension | 3/4 | opening, receipts, remote beat, and Tower Memory name one community board; five-person comprehension is unrun |
| Community consequence | 3/4 | a deterministic newer snapshot is deferred in flight and announced/applied on landing; hosted two-client proof is unrun |
| Mechanical significance | 4/4 | Ghost is one-way/temporary, Cursed is solid/crumbling, both reset per attempt, and route tests pass |
| Trust and failure honesty | 4/4 | local practice, capped/stale/unavailable writes, seeded history, and UTC rollover are disclosed without false persistence claims |
| Whole-board story | 4/4 | Tower Memory maps three authored spaces, real sites, artifacts, bounded beats, summit, and positive achievements |

## Active next work

1. Prove watched Redis retries, duplicate idempotency, caps, threshold races, and safe remote receipt application in two authenticated hosted sessions as soon as a connected signed-in browser is available.
2. Run the five-person first-view comprehension check; do not infer it from screenshots.
3. If retrospective prior-day stories become a requirement, design an archive contract separately; do not reintroduce an unsupported relic/carryover promise.

## Open decision

“Global” can mean:

- **Community-global (recommended native v1):** every Fallstack entry point in one subreddit shares one daily tower through Devvit Redis.
- **Cross-Reddit global:** every installation shares one tower through an external authoritative service.

The second option is not an incremental Redis key change. It introduces infrastructure, security, abuse, privacy, availability, and operational costs and requires explicit approval before implementation.

## Validation log

- `git status --short` — passed; clean at baseline.
- `rg --files fallstack | rg '\\.figma\\.(ts|tsx|js)$'` — passed; no Code Connect files exist, so existing Figma screens/components were the authoritative design-system source.
- Figma metadata/use inspection — passed; OAuth/file access works and current pages/components/tokens/fonts were read successfully.
- Figma proof creation — passed; created page `20:2`, wrapper `20:3`, and states `21:2`, `23:6`, `25:10` in the existing file `h24S9x4pxMjPaVyj5LqrSk`.
- Figma individual and 1285×900 sequence screenshots — passed after fixing the opening title/status collision and shortening the receipt stamp; all three states remain 375×812 with no overlap.
- Figma font integrity assertion — passed; 49 text nodes use only Shippori Mincho or Zen Maru Gothic. Wrapper auto-layout is horizontal, contains the three expected state frames, and is no longer marked placeholder.
- Official Devvit Redis documentation lookup — passed; confirmed per-installation isolation, transaction support, stable-key guidance, and external-service requirement for cross-community data.
- `rg` over installed Devvit `.d.ts` files — passed; confirmed transaction and hash increment APIs in the installed toolchain.
- Impact-site red/green loop — passed; tests cover determinism, three real route pairs per zone, 120-seed bounds, baseline overlap, and no-helper/all-hazards reachability.
- `npm run type-check` — passed.
- `npm test` — passed; 60 tests.
- `npm run lint` — passed.
- `npm run build` — passed; the existing Phaser chunk-size warning remains.
- Playwright CLI mobile splash at 375×812 — passed; accessibility and screenshot show `One community · one daily tower` and `4 opening falls raised First Gap.`
- Playwright CLI mobile expanded game at 375×812 — passed; one canvas, Lower Ruins remains Restless, opening live-region copy names scope/site/origin, and expected local `/api/init-game` 404 uses the disclosed delayed-shared-marks fallback.
- Playwright CLI controlled input smoke — passed; 450 ms leftward charge/release produced one fall, total `37 → 38`, respawned safely, and reported the helper-overuse threshold consequence.
- M2/M3 red-green loop — passed; bounded observation, exact site counters, receipt transitions, caps, stale boards, clear/summit decisions, and 100 duplicate submissions are covered in pure tests.
- Devvit API mismatch investigation — installed Devvit `0.13.7` transaction reads return the transaction client rather than the value documented in the current Redis example. The implementation watches first, reads through the base install-scoped client, queues writes through the transaction, and retries conflicts; the precise finding is recorded in `docs/devvit-feedback-log.md`.
- `npm run deploy` — passed after type-check and lint; uploaded app `0.0.17`.
- `npx devvit playtest fallstack_dev --show-timestamps --since 0m` — passed; installed playtest `v0.0.17.2` at `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`.
- Hosted signed-in browser gate — blocked by environment access, not app output: the connected Chrome runtime reported no available browsers; isolated Playwright reached Reddit's JavaScript challenge and received HTTP 403. Transaction behavior therefore remains unclaimed.
- M4 receipt tests — passed; accepted and capped receipts produce distinct, exact board/site/counter presentations.
- M4 Playwright accepted-fall proof at 375×812 — passed against the production bundle with deterministic mocked API responses; the accessible receipt reads `BOARD r37 → r38`, `First Gap`, and `4 → 5`; screenshot `.playwright-cli/m4-receipt-top.png` shows the exact foothold outline and no active-jump/control obstruction.
- M4 browser matrix — passed at 375×812 for accepted, threshold `5 → 6`, capped, stale, and unavailable states and at 1280×800 for opening/accepted layouts. Every state keeps the changed site and fixed controls readable.
- M5 mechanics proof — pure tests pass for one-way Ghost, solid helpers/hazards, and deterministic 900/650 ms windows. Browser captures show Ghost expiry, Cursed warning/collapse, and Cursed return after a real fall/respawn.
- M6 safe-reconciliation proof — deterministic revision `40 → 41` remained unapplied while airborne, then changed the site/count and showed `REMOTE · BOARD r41` on landing; captures are `.playwright-cli/m6-deferred-airborne.png` and `.playwright-cli/m6-applied-on-land.png`.
- M7 Tower Memory browser proof — 375×812 and 1280×800 captures are `.playwright-cli/m7-tower-memory-mobile.png`, `.playwright-cli/m7-tower-memory-mobile-rollover.png`, and `.playwright-cli/m7-tower-memory-desktop.png`. Mobile opens at scroll position 0, exposes a fixed 317×49 action, Tab reaches it, Escape closes the dialog, and focus returns to `Memory`.
- `npm run deploy` — passed after type-check and lint; uploaded app `0.0.18` with five current WebView assets.
- `npx devvit playtest fallstack_dev --show-timestamps --since 0m` — built and installed `v0.0.18.2`; `npx devvit list installs fallstack_dev` independently confirmed that installed version. No runtime log errors appeared while the session was open.
- Hosted mutation proof remains blocked: the CLI has no authenticated endpoint invocation command, the connected Chrome runtime exposed no browser, and isolated browser access receives Reddit's challenge/HTTP 403. No test-only production endpoint or credential extraction was introduced to bypass this gate.
- Final post-upload local gate — `npm run type-check`, `npm run lint`, `npm test`, `npm run build`, and `git diff --check` passed; 93 tests pass. The existing expanded Phaser chunk warning remains.
- `node take_screenshots.js` — passed against the production bundle after the final gate; refreshed splash, 375×812 mobile, 1280×800 desktop, and 1920×1080 fullscreen captures and passed the header overflow assertions.
