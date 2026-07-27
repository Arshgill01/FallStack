# Quality reconstruction status

## Objective

Execute [`../../../goal.md`](../../../goal.md) from the pulled `7c4e06f`
baseline. Preserve the selected Cutaway Reliquary grammar and the pure
logic/Phaser/Devvit ownership split while rebuilding the parts that fail
evidence-based quality gates.

## Current gate

Gate 1 — baseline census and reproduction.

Gate 0 is complete on the current Mac. The project checks,
Chromium/WebKit runtime lifecycle, mocked two-client reconciliation, signed-in
Safari host access, independent hosted Music/SFX controls, and a deterministic
final-master audio recorder are available. The full production-build summit is
still running.

## Checkpoints

| Checkpoint | State | Evidence |
| --- | --- | --- |
| Pull current `master` | Complete | Fast-forwarded `7875568 → 7c4e06f` |
| Define root goal | Complete | Commit `0aaf5b8` |
| Mac toolchain | Complete | Node 22.21.0, npm 10.9.4, Playwright 1.61.1, Devvit 0.13.7 |
| Project checks | Complete | Type-check, lint, 146 tests, build passed |
| Chromium runtime | Complete | Touch, fall/respawn, post-respawn input, jump, reduced motion passed |
| WebKit runtime | Complete with flake note | Parallel run timed out; isolated retry passed |
| Shared session | Complete | Revision `37 → 39`, deferred reconcile, Mercy Nail, zero errors |
| Authenticated Safari | Complete | Current daily post opened and expanded; Guide, Memory, Music/SFX exposed |
| Audible-output path | Complete | 5.82 s final-master WebM; stereo Opus at 48 kHz; non-silent peak/RMS |
| Full playthrough | Running | Chromium production build with intentional opening fall |

## Initial issue ledger

These are investigation records, not all approved fixes.

| ID | Severity | Workstream | State | Summary |
| --- | --- | --- | --- | --- |
| QR-001 | High | Gameplay/world | Reproduced by source/runtime geometry | Painted reliquary walls and physical world bounds disagree, so the player can move behind architecture |
| QR-002 | High | Audio/events | Fixed and browser-regressed | Initial grounded frame and post-respawn teleport emitted false landing events |
| QR-003 | High | Audio/design | Baseline confirmed | Current oscillator cues do not provide the requested tactile event vocabulary |
| QR-004 | High | Music | Baseline confirmed | Two drones plus an eight-note bell phrase repeat every 17.6 seconds with no biome response |
| QR-005 | Medium | Audio/lifecycle | Fixed and browser-regressed | Rapid Music Off/On reopened untracked bell tails and overlapped a new pair |
| QR-006 | Medium | Audio/preferences | Fixed and browser-regressed | Legacy combined mute key forced SFX off again after reload |
| QR-007 | Medium | Audio/lifecycle | Fixed and browser-regressed | Queued SFX continued after SFX Off; gameplay bus itself was never muted |
| QR-008 | Medium | Audio/lifecycle | Fixed and browser-regressed | Closed-context recovery retained stale charge/timer state |
| QR-009 | Medium | Audio/ownership | Fixed and browser-regressed | Phaser created a redundant AudioContext despite owning no Fallstack sound |
| QR-010 | Medium | Camera | Test gap | Player-centred camera does not prove the next landing remains readable at narrow widths |
| QR-011 | Medium | UI | Source repro established | Several mobile UI labels remain below the art-bible 13 px body/status target |
| QR-012 | Product blocker | Character | Baseline rejected | Procedural hooded block lacks the requested silhouette/state quality |
| QR-013 | Medium | QA/playthrough | Investigating | Current Chromium summit harness is still active after 13 minutes and has emitted only the opening artifact |

## Decisions

- 2026-07-27: Work continues on the current Mac only; all VM-specific handoffs
  were removed from the goal.
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

## Commands run

From `fallstack/` unless noted:

```text
npm ci
npm run type-check
npm run lint
npm test
npm run build
npm run qa:runtime -- /tmp/fallstack-vm-readiness/chromium --browser=chromium
npm run qa:runtime -- /tmp/fallstack-vm-readiness/webkit --browser=webkit
npm run qa:runtime -- /tmp/fallstack-vm-readiness/webkit-retry --browser=webkit
npm run qa:shared -- /tmp/fallstack-vm-readiness/shared
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

## Worktree safety

- Root `goal.md` is committed separately at `0aaf5b8`.
- `fallstack/docs/fixplan.md` is pre-existing, untracked, and user-owned. Do not
  stage or modify it.
