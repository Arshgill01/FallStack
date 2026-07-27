# Quality reconstruction status

## Objective

Execute [`../../../goal.md`](../../../goal.md) from the pulled `7c4e06f`
baseline. Preserve the selected Cutaway Reliquary grammar and the pure
logic/Phaser/Devvit ownership split while rebuilding the parts that fail
evidence-based quality gates.

## Current gate

Gate 1 — baseline census and verified issue resolution in progress.

Gate 0 is complete on the current Mac. The project checks,
Chromium/WebKit runtime lifecycle, mocked two-client reconciliation, signed-in
Safari host access, independent hosted Music/SFX controls, and a deterministic
final-master audio recorder are available. The production-build mobile replay
now proves the complete local-practice route from its opening mutation through
all eleven zone clears to the summit.

## Checkpoints

| Checkpoint | State | Evidence |
| --- | --- | --- |
| Pull current `master` | Complete | Fast-forwarded `7875568 → 7c4e06f` |
| Define root goal | Complete | Commit `0aaf5b8` |
| Mac toolchain | Complete | Node 22.21.0, npm 10.9.4, Playwright 1.61.1, Devvit 0.13.7 |
| Project checks | Complete | Type-check, lint, 152 tests, build passed |
| Chromium runtime | Complete | Touch, fall/respawn, post-respawn input, jump, reduced motion passed |
| WebKit runtime | Complete with flake note | Parallel run timed out; isolated retry passed |
| Shared session | Complete | Revision `37 → 39`, deferred reconcile, Mercy Nail, zero errors |
| Authenticated Safari | Complete | Current daily post opened and expanded; Guide, Memory, Music/SFX exposed |
| Audible-output path | Complete | 5.82 s final-master WebM; stereo Opus at 48 kHz; non-silent peak/RMS |
| Gameplay SFX palette | Listening gate open | Semantic events, deterministic 15-cue A/B reel, real-event capture, lifecycle and two-browser proof complete |
| Music directions | Awaiting selection | Three original, deterministic, level-matched, three-biome previews with provenance, spectra, and signal hashes |
| Mobile UI readability | Complete | 320×568 and 375×812 functional text, header layout, touch targets, Guide, and Tower Memory pass |
| Dialog input/accessibility | Complete | Chromium and WebKit pass 48 checks each at 375×812 and 1280×800; scene pause, zoom, focus, semantics, and contrast verified |
| Temporary HUD overlays | Complete | Five notice states clear the player and next required landing at every 320×568 and 375×812 recovery point |
| Mobile orientation | Complete | Chromium and WebKit pass grounded, charging, airborne, modal, and desktop-control continuity checks |
| Full playthrough | Complete | 375×812 production build: opening fall, all 155 route platforms, 11 clears, and `summitSent`; 158 controlled jumps in 170 s |
| Character redesign | Complete | Washi Pilgrim integrated across ten states; 320/375, reduced motion, Chromium/WebKit, and unchanged 20×28 body verified |

## Initial issue ledger

These are investigation records, not all approved fixes.

| ID | Severity | Workstream | State | Summary |
| --- | --- | --- | --- | --- |
| QR-001 | High | Gameplay/world | Fixed and browser-regressed | Mobile inherited an off-frame playable gutter before its readable side boundary; desktop/fullscreen outer edges were already correct |
| QR-002 | High | Audio/events | Fixed and browser-regressed | Initial grounded frame and post-respawn teleport emitted false landing events |
| QR-003 | High | Audio/design | Implemented; listening gate open | Material/impact landing, wall, collapse, mutation, checkpoint, and summit cues are semantically distinct; A/B human review remains |
| QR-004 | High | Music | Direction gate ready; production unchanged | Three original three-biome previews are technically verified; user listening selection and production integration remain |
| QR-005 | Medium | Audio/lifecycle | Fixed and browser-regressed | Rapid Music Off/On reopened untracked bell tails and overlapped a new pair |
| QR-006 | Medium | Audio/preferences | Fixed and browser-regressed | Legacy combined mute key forced SFX off again after reload |
| QR-007 | Medium | Audio/lifecycle | Fixed and browser-regressed | Queued SFX continued after SFX Off; gameplay bus itself was never muted |
| QR-008 | Medium | Audio/lifecycle | Fixed and browser-regressed | Closed-context recovery retained stale charge/timer state |
| QR-009 | Medium | Audio/ownership | Fixed and browser-regressed | Phaser created a redundant AudioContext despite owning no Fallstack sound |
| QR-010 | Medium | Camera | Fixed and regression-tested | Player-centred camera hid the next landing on maximum lateral jumps at narrow widths |
| QR-011 | Medium | UI | Fixed and browser-regressed | Mobile functional text now meets its role minimum without header or sheet overflow |
| QR-012 | Product blocker | Character | Fixed and browser-regressed | Washi Pilgrim replaces the rejected block across ten standard/reduced-motion states without changing physics |
| QR-013 | High | QA/playthrough | Fixed and production-replayed | Physical support authority and descending landing prediction replaced stale labels, speculative wall bounces, and ascent-only steering; uninterrupted summit now passes |
| QR-014 | High | UI/input | Fixed and browser-regressed | Guide and Tower Memory now pause Phaser, so hidden keyboard input cannot launch, fall, or mutate the tower |
| QR-015 | Medium | UI/accessibility | Fixed and browser-regressed | Browser zoom, two-way focus containment, visible dialog naming, theme metadata, and primary action contrast now pass |
| QR-016 | Medium | UI/feedback | Fixed and browser-regressed | Short-screen receipts and simultaneous remote notices no longer cover the player or next recovery landing |
| QR-017 | High | UI/input/camera | Fixed and browser-regressed | Coarse-pointer landscape retains touch controls and short-screen camera framing without changing desktop/fullscreen edges |

## Decisions

- 2026-07-27: Work continues on the current Mac only; remote-environment
  handoffs were removed from the goal.
- 2026-07-27: Latest pulled fixes are treated as baseline evidence, not assumed
  resolution of the user's current reports.
- 2026-07-27: Automated oscillator counts and analyser values may approve
  signal flow but cannot approve sound quality.
- 2026-07-27: The current Cutaway Reliquary grammar remains frozen. Character
  directions must fit it and preserve physics/origins.
- 2026-07-27: Do not change the fixed opening route until visibility/fairness
  evidence shows a geometry defect. Resolve physical/visual bounds separately.
- 2026-07-27: Gate 0 captures branch from the post-analyser final master only
  when `?qa=audio` is present. Normal production URLs expose no recorder.
- 2026-07-27: Respawn settlement is an administrative reset, not a landing.
  Suppress exactly that transition; preserve the next real airborne landing.
- 2026-07-27: `ProceduralSound` is the sole audio owner. Phaser audio is
  disabled because the game loads and plays no Phaser audio assets.
- 2026-07-27: The reliquary's inner wall edge is the mobile physical route
  boundary. Keep the full 480 px logical route for generation and preserve the
  existing desktop/fullscreen outer edge.
- 2026-07-27: A committed charge/flight may use 64 px horizontal camera
  lookahead. Grounded idle remains velocity-based and capped at 40 px.
- 2026-07-27: Character implementation pauses at the direction gate. Bell
  Warden is recommended from three generated state-complete concept boards, but
  the user owns the final selection.
- 2026-07-27: The user selected A — Washi Pilgrim. Production keeps its angular
  folded-washi hood, faceless indigo core, single gold seal-eye, asymmetric
  persimmon prayer strip, ragged cloak, and bound archive pack while rejecting
  the concept board's rounded-mascot risk. Physics, origin, movement, and event
  authority remain frozen.
- 2026-07-27: Washi Pilgrim is implemented procedurally with grounded, low/full
  charge, rising, apex, falling, hard landing, respawn, checkpoint, and summit
  states. Actual-scale 320/375 evidence and Chromium/WebKit runtime checks pass;
  reduced motion preserves state while removing tilt and fade.
- 2026-07-27: The SFX palette may use deterministic procedural noise and short
  resonances, but collision meaning comes from Phaser's event payload rather
  than biome inference inside the sound layer.
- 2026-07-27: QR-003 can reach a verified implementation checkpoint on
  automated and browser evidence, but it cannot close without a current-Mac
  listening decision.
- 2026-07-27: At 320–374 px, the visual tally contracts to `Falls` so `13 px`
  status and action text fit without collision. The full community wording
  remains in the tally's accessible label and returns visually at 375 px.
- 2026-07-27: QR-013 is a replay-controller defect, not evidence of a tower
  geometry defect. Route progress follows physical support, and air correction
  targets the descending intersection with a safe landing segment.
- 2026-07-27: QR-004 pauses before production integration. Three original
  directions may be compared at matched loudness, but automated metrics and an
  authoring scorecard do not choose music or approve fatigue.
- 2026-07-27: Guide and Tower Memory pause the complete Phaser scene. This
  freezes committed motion and scene timers, cancels planted charge without a
  launch, and prevents hidden persistent events until the dialog closes.
- 2026-07-27: Browser zoom remains available on the document and tower.
  `touch-action: none` is retained only by the fixed hold controls.
- 2026-07-27: Touch-control visibility follows pointer capability rather than
  viewport width. Wide layout styling remains width-based, and horizontal
  desktop/fullscreen physics bounds remain unchanged.
- 2026-07-27: Camera bottom padding keeps its established 150/260 px targets
  but may occupy at most 60% of a short live viewport so rotation cannot place
  the player above the canvas.
- 2026-07-27: At 320×568-class layouts, a local receipt takes priority over a
  simultaneous remote beat. The full receipt remains in the live region while
  the visible proof is compact enough to preserve the recovery jump.

## Commands run

From `fallstack/` unless noted:

```text
npm ci
npm run type-check
npm run lint
npm test
npm run build
npm exec -- devvit whoami
npm exec -- devvit list installs fallstack_dev
node --input-type=module -e '<initial ready/land event probe>'
node --input-type=module -e '<fall/respawn event probe>'
npm run qa:audio -- /tmp/fallstack-quality/audio-capture-red
npm run type-check
npm run lint
npm run build
npm run qa:audio -- docs/quality-reconstruction/evidence/baseline-audio
ffmpeg -i docs/quality-reconstruction/evidence/baseline-audio/final-master.webm -af ebur128=peak=true -f null -
npm run qa:runtime -- /tmp/fallstack-quality/audio-events-green --browser=chromium
npm run qa:audio -- /tmp/fallstack-quality/audio-capture-after-event-fix
npm run qa:audio-lifecycle -- /tmp/fallstack-quality/audio-lifecycle-red
npm run type-check
npm run lint
npm run build
npm run qa:audio-lifecycle -- docs/quality-reconstruction/evidence/audio-lifecycle-fix
npm run qa:audio -- /tmp/fallstack-quality/audio-after-lifecycle
npm run qa:world-bounds -- /tmp/fallstack-quality/world-bounds-red
npm run type-check
npm run lint
npm run build
npm run qa:world-bounds -- docs/quality-reconstruction/evidence/world-bounds-fix
npm test
npm run qa:playthrough -- --output docs/quality-reconstruction/evidence/full-playthrough --browser=chromium --intro-fall --retries=40 --max-jumps=1500
npm run qa:playthrough -- --output /tmp/fallstack-quality/playthrough-comet-probe --browser=chromium --resume-zone=comet_reef --retries=12 --max-jumps=320
npm run qa:playthrough -- --output /tmp/fallstack-quality/playthrough-nebula-probe --browser=chromium --resume-zone=nebula_vault --retries=12 --max-jumps=320
npm run qa:playthrough -- --output /tmp/fallstack-quality/playthrough-black-hole-probe --browser=chromium --resume-zone=black_hole_chapel --retries=40 --max-jumps=800
npm test
npm run build
npm run qa:world-bounds -- docs/quality-reconstruction/evidence/world-bounds-fix
npm run qa:runtime -- /tmp/fallstack-quality/world-runtime-chromium --browser=chromium
npm run qa:runtime -- /tmp/fallstack-quality/world-runtime-webkit --browser=webkit
npm run qa:audio-palette -- docs/quality-reconstruction/evidence/sfx-palette-comparison tactile
FALLSTACK_QA_BASE_URL=http://127.0.0.1:8081 npm run qa:audio-palette -- docs/quality-reconstruction/evidence/sfx-palette-comparison baseline
npm run qa:audio-events -- docs/quality-reconstruction/evidence/sfx-event-contract
npm run qa:audio-lifecycle -- docs/quality-reconstruction/evidence/sfx-lifecycle
npm run qa:audio -- docs/quality-reconstruction/evidence/sfx-gameplay-capture
npm run qa:runtime -- /tmp/fallstack-quality/sfx-runtime-chromium --browser=chromium
npm run qa:runtime -- /tmp/fallstack-quality/sfx-runtime-webkit --browser=webkit
ffmpeg -i docs/quality-reconstruction/evidence/sfx-palette-comparison/{baseline,tactile}.webm -af ebur128=peak=true -f null -
ffmpeg -i docs/quality-reconstruction/evidence/sfx-gameplay-capture/final-master.webm -af ebur128=peak=true -f null -
npm run qa:ui-readability -- /tmp/fallstack-quality/ui-readability-red
npm run build
npm run qa:ui-readability -- docs/quality-reconstruction/evidence/ui-readability-fix
npm run qa:runtime -- /tmp/fallstack-quality/ui-runtime-chromium --browser=chromium
npm run qa:runtime -- /tmp/fallstack-quality/ui-runtime-webkit --browser=webkit
npm test
npm run lint
node --check scripts/qa/ui-readability.mjs
git diff --check
node --check scripts/qa/full-playthrough.mjs
npm run qa:playthrough -- --output /tmp/fallstack-quality/playthrough-galaxy-landing-time --browser=chromium --resume-zone=galaxy_reef --retries=40 --max-jumps=100 --require-summit=false
npm run qa:playthrough -- --output /tmp/fallstack-quality/playthrough-dying-star-landing-time --browser=chromium --resume-zone=dying_star_garden --retries=40 --max-jumps=60 --require-summit=false
npm run qa:playthrough -- --output /tmp/fallstack-quality/playthrough-event-horizon-landing-time --browser=chromium --resume-zone=event_horizon_crown --retries=40 --max-jumps=40 --require-summit=false
npm run qa:playthrough -- --output docs/quality-reconstruction/evidence/full-playthrough-fixed --browser=chromium --intro-fall --retries=40 --max-jumps=1500
npm run qa:music-directions -- docs/quality-reconstruction/evidence/music-directions
npm run qa:music-directions -- /tmp/fallstack-quality/music-directions-repeat
npm run qa:ui-accessibility -- /tmp/fallstack-quality/ui-accessibility-red --browser=chromium
npm run type-check
npm run lint
npm run build
npm run qa:ui-accessibility -- docs/quality-reconstruction/evidence/ui-accessibility-fix/chromium --browser=chromium
npm run qa:ui-accessibility -- docs/quality-reconstruction/evidence/ui-accessibility-fix/webkit --browser=webkit
npm test
npm run qa:ui-readability -- /tmp/fallstack-quality/ui-readability-after-accessibility
npm run qa:world-bounds -- /tmp/fallstack-quality/world-bounds-after-accessibility
npm run qa:runtime -- /tmp/fallstack-quality/accessibility-runtime-chromium --browser=chromium
npm run qa:runtime -- /tmp/fallstack-quality/accessibility-runtime-webkit --browser=webkit
npm run qa:runtime -- /tmp/fallstack-quality/accessibility-runtime-webkit-retry --browser=webkit
npm run qa:runtime -- /tmp/fallstack-quality/accessibility-runtime-webkit-green --browser=webkit
node --check scripts/qa/ui-accessibility.mjs
git diff --check
npm run qa:ui-overlays -- /tmp/fallstack-quality/ui-overlays-red
npm run qa:ui-overlays -- /tmp/fallstack-quality/ui-overlays-contrast-red
npm run type-check
npm run lint
npm run build
npm run qa:ui-overlays -- docs/quality-reconstruction/evidence/ui-overlays-fix
npm run qa:ui-readability -- /tmp/fallstack-quality/ui-readability-after-overlays
npm run qa:ui-accessibility -- /tmp/fallstack-quality/ui-accessibility-after-overlays --browser=chromium
npm test
npm run qa:runtime -- /tmp/fallstack-quality/overlay-runtime-chromium --browser=chromium
npm run qa:runtime -- /tmp/fallstack-quality/overlay-runtime-webkit --browser=webkit
node --check scripts/qa/ui-overlays.mjs
git diff --check
node --check scripts/qa/character-states.mjs
npm run qa:character-states -- docs/quality-reconstruction/evidence/character-washi-pilgrim
npm run qa:runtime -- /tmp/fallstack-quality/character-runtime-chromium --browser=chromium
npm run qa:runtime -- /tmp/fallstack-quality/character-runtime-webkit --browser=webkit
npm run qa:world-bounds -- /tmp/fallstack-quality/character-world-bounds
npm run type-check
npm run lint
npm test
npm run build
```

Results:

- `npm ci`: passed; reported 42 audit findings (24 moderate, 18 high).
- Type-check and lint: passed.
- Tests: 146/146 passed.
- Build: passed with the known expanded Phaser chunk warning.
- Chromium runtime: passed.
- WebKit runtime: first parallel run timed out at 30 seconds; isolated retry
  passed.
- Shared session: passed with no errors.
- Devvit read-back: authenticated CLI; installed app is `fallstack v0.0.25`.
- Audio event probes: reproduced one phantom `land` after initial `ready` and a
  second phantom `land` after fall/reset.
- Audio capture: failed first because the final-master recorder was absent,
  then passed after the QA-only seam was added. The artifact is 5.82 seconds,
  93,698 bytes, stereo Opus at 48 kHz, with peak `0.0938`, RMS `0.057`, and an
  FFmpeg true peak of `-14.3 dBFS`.
- Landing regression: Chromium reports zero opening-settle landings and zero
  post-respawn-reset landings. A second master capture contains no land before
  launch and retains the real landing after flight.
- Audio lifecycle red run reproduced six failures: legacy mute precedence and
  persistence, two AudioContexts, one leaked delayed launch oscillator, seven
  active oscillators after rapid toggles, and three contexts after recovery.
- Audio lifecycle green run reports SFX On with the legacy key removed, one
  initial context, one launch oscillator after immediate mute, five active
  oscillators after twenty toggle cycles, and exactly one replacement context
  after closure with no page errors.
- World-bound red run failed mobile wall-contact containment. The revised green
  contract contains 320, 375, and 480 px mobile views while preserving the
  original 758 px desktop outer edge.
- Camera regression samples 160 seeds at 320 and 375 px. Before lookahead one
  summit connector exposed 0 px at takeoff; committed 64 px lookahead exposes
  at least 40 px of every next landing in the sample.
- The baseline full playthrough started before the landing/world fixes. It
  exhausted 1,200 jumps after 26 minutes: 627 advancing landings, 400 falls,
  and repeated inability to clear opening ledge 7. The report also exposed a
  harness retry counter that resets after falls and therefore never fails fast.
- A 100-jump post-fix probe cleared the previously blocking ledge and reached
  `crater_foundry`. The first full rerun was intentionally stopped after the
  user clarified that desktop/fullscreen bounds must remain unchanged.
- The mobile-only canonical rerun then crossed the opening blocker and reached
  `comet_reef`, where it exposed a controller approach-counter defect at ledge
  36. A source-target approach counter cleared it.
- The checkpointed replay exposed and fixed two more false-control states: it
  now waits for a real airborne frame and validates the physical support under
  the player instead of trusting a stale label.
- The improved checkpointed probe crossed six later zones and reached
  `black_hole_chapel`, but expired its 320-jump budget while cycling between the
  previous checkpoint and early chapel ledges. It exposed two remaining
  controller errors: speculative reverse wall bounces on unobstructed route
  jumps, and air correction aimed outside the ledge until the ascending
  intersection instead of braking for the descending landing.
- With physical support as route authority, direct launch selection, cached
  source-target approaches, and descending-time landing correction, the Galaxy,
  Dying Star, and Event Horizon checkpoint probes reached the summit in 36, 23,
  and 10 jumps respectively, each with zero non-advancing falls.
- The final uninterrupted 375×812 production-build replay completed all 155
  route platforms in 158 controlled jumps over 170 seconds. It recorded the
  intentional opening fall, 11 clean clears, screenshots for every zone, one
  summit event, and `summitSent: true`. Five non-advancing fall outcomes were
  recovered; four additional route falls advanced to a newly earned checkpoint.
  Page exceptions were empty. The static local-practice `/api` 404 and fallback
  warning are expected and are not hosted-state evidence.
- Final mobile-boundary checkpoint checks passed: 150/150 tests, production
  build, world-contact regression, Chromium runtime smoke, and isolated WebKit
  runtime smoke.
- The matched baseline/tactile SFX reels contain 15 cues over 14.34 seconds.
  The tactile pass replaces identical soft/hard and generic-fallback cues with
  material/impact profiles and dedicated wall, collapse, mutation, checkpoint,
  and summit vocabulary. It measures `-30.8 LUFS` and `-18.8 dBFS` true peak.
- The real gameplay audio capture contains charge, launch, and a material-aware
  landing, measures `-29.2 LUFS` and `-16.8 dBFS` true peak, and contains no
  opening-settle landing.
- The real-event probe records a `740`-impact stone landing and a separate
  `353`-impact wall bonk with zero simultaneous landing aliases.
- The revised lifecycle probe tracks oscillator and buffer sources. Immediate
  SFX Off starts zero delayed sources; Chromium and WebKit runtime smokes pass
  after the palette change.
- The mobile readability red run measured functional text at `7.5–12 px`.
  The green report passes at 320×568 and 375×812 with `13 px` body/status,
  `14 px` result body, 66–67 px non-overlapping headers, and no horizontal
  sheet overflow. Chromium and WebKit runtime smokes pass afterward.
- Current repository checks pass: 152/152 tests, type-check, lint, build, and
  `git diff --check`. The known Phaser chunk warning remains.
- The three QR-004 direction previews are each 48.008-second stereo Opus at
  48 kHz. They measure `-22.1…-22.0 LUFS`, `5.6…6.5 LU` LRA, and
  `-9.7…-9.5 dBFS` true peak. A second render reproduced all three PCM signal
  hashes exactly; maximum adjacent-sample deltas are `0.035…0.089`.
- Spectrum inspection distinguishes sparse episodic gaps in Mended Lantern,
  continuous five-beat transients in Crooked Procession, and longer breath
  chambers in Breathing Reliquary. This proves compositional contrast, not
  taste or long-session approval.
- The UI accessibility red run reproduced hidden dialog input, launch/fall
  events, reverse-Tab escape, disabled zoom, missing Tower Memory title
  association, missing theme metadata, and 2.51:1 primary-action contrast.
- Chromium and WebKit now pass 48/48 accessibility checks each at 375×812 and
  1280×800. Both dialogs hold position, attempt, charge, launch, and fall counts
  at zero delta; input resumes after close; primary-action contrast is 6.93:1.
- The post-fix mobile wall regression still contains 320, 375, and 480 px
  players at the reliquary wall planes while 1280×800 preserves the existing
  758 px desktop outer edge.
- Chromium runtime passed immediately. WebKit's 90 ms synthetic post-reload
  jump missed two consecutive frame windows; matching the harness's existing
  browser-specific timing policy at 220 ms produced a clean runtime pass.
- The overlay red run measured a 166.1 px receipt at 320×568, 9 px explanation
  text, one covered required landing, and a combined receipt/remote notice over
  the player at every sampled recovery. The highlighted counter then failed a
  dedicated contrast check at 2.96:1.
- The green overlay report passes 266/266 checks. Receipt, checkpoint, remote,
  combined, and long-message states have zero overlap with the player, next
  landing, one another, or the tower viewport at every start/checkpoint
  recovery. The compact receipt is 91.5 px with 13 px explanation text and a
  10.63:1 counter.
- The orientation red run reproduced five coarse-pointer landscape failures:
  touch controls were hidden, the keyboard hint appeared, all touch targets
  collapsed to 0×0, touch movement was unavailable, and the Guide exposed no
  visible disabled controls. Restoring pointer-aware controls then exposed the
  fixed 260 px camera padding exceeding a 254 px landscape game viewport.
- Chromium and WebKit now pass 16/16 resize checks each. Grounded position,
  charging, airborne attempt identity, fall count, player visibility, dialog
  isolation, and focus restore survive rotation. The fine-pointer 812×375
  presentation still uses desktop controls.
- The post-orientation regression preserves mobile wall planes at 320, 375, and
  480 px and the original 758 px desktop outer edge. Both runtime smokes,
  48/48 Chromium and WebKit accessibility checks, 266/266 overlay checks, and
  mobile readability pass.

## Worktree safety

- Root `goal.md` is committed separately at `0aaf5b8`.
- `fallstack/docs/fixplan.md` is pre-existing, untracked, and user-owned. Do not
  stage or modify it.
