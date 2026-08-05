# Fallstack Quality Reconstruction Goal

## Active cross-device gameplay-feel mission — 2026-08-05

### Objective

Make the installed Fallstack build feel consistently smooth, responsive, and
legible throughout a complete run on iPhone, Android-class touch layouts, and
desktop Reddit layouts. Diagnose the current desktop jank with real gameplay
timing rather than browser identity or video appearance, fix every reproduced
gameplay/UI defect, strengthen the E2E suite so those defects cannot pass
silently, then commit, push, publish, install, and verify the exact tested
artifact.

### New evidence that reopens the previous signoff

- The user reports the same janky feel in desktop Safari and Firefox. The
  Safari-only render-scale mitigation therefore cannot be treated as the root
  fix for the current desktop problem.
- The user's iPhone remains much smoother than desktop, but feels slightly
  worse than the build before the Safari patch. Mobile is a protected baseline,
  not evidence that the current release is complete.
- The supplied Mac recording renders regular delivered frames, but recording
  output cannot measure input-to-motion latency, compositor presentation
  cadence, or the feel of camera acceleration on the physical display.
- The old full-playthrough camera gate excludes frames at or above 80 ms and
  permits large per-frame camera movement. It can therefore discard the worst
  evidence and pass movement that still looks or feels janky.
- The previous mission explicitly left physical Mac feel as an external smoke
  test. That omission is incompatible with the current objective and its
  completed checklist is historical evidence only.

### Strict 95% confidence contract

Confidence is earned per risk, not inferred from a single green suite. The
mission may close only when all high-risk gates have direct repeatable evidence,
all medium-risk gates pass in at least two representative layouts/engines, no
known reproducible defect remains, and the only residual uncertainty is the
named difference between VM automation and physical display/input hardware.

| Evidence dimension              | Weight | Required proof                                                                                                                                                |
| ------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Input and physics response      |    20% | Real hold/release input; bounded input-to-launch and launch-to-motion latency; no duplicate, stalled, or divergent updates.                                   |
| Frame delivery and camera feel  |    25% | Browser and Phaser timing including all slow frames; bounded long-frame rate, camera step, acceleration, and landing/launch discontinuity during real climbs. |
| Gameplay correctness            |    20% | Bounds, collision, falls, respawns, checkpoints, route completion, and summit with the production movement path.                                              |
| UI/UX legibility and state      |    15% | Notices avoid the active route/player, zone and run state are current, controls remain usable, and overlays do not obstruct play.                             |
| Responsive and host behavior    |    10% | Mobile portrait, desktop compact/fullscreen, resize/orientation, DPR, reduced motion, and a Reddit-host-shaped containment check.                             |
| Regression and release identity |    10% | Regressions fail against reproduced faults; broad validation passes; installed Devvit version and source/build identity are read back.                        |

The numerical total must exceed 95%, but no arithmetic total can compensate for
a failed high-risk gate, an unexplained user-visible regression, or an
unverified installed artifact.

### Iteration loop

1. Establish a clean supported toolchain and run the existing suite unchanged.
2. Reproduce each reported or newly observed issue with instrumented real input.
3. Prove where the existing workflow missed it, then add a regression that
   fails for the reproduced condition.
4. Patch the smallest evidenced root cause without weakening mobile feel,
   movement physics, visual identity, or tower fairness.
5. Re-run the focused regression in Chromium and WebKit plus representative
   mobile and desktop layouts; collect timing traces, screenshots, and video
   where each is actually probative.
6. Repeat diagnosis and patching until all acceptance gates pass twice without
   test-only intervention.
7. Run the full repository gates, inspect the final diff, commit intentionally,
   push, build from the clean pushed SHA, publish/install, and read back the
   immutable version before closing the goal.

### Acceptance checklist

- [x] Existing QA is baselined and every false-negative gap used by the current
      defect is documented and replaced by a stricter durable gate.
- [x] Desktop gameplay timing captures browser frames, Phaser updates, real
      input events, player motion, and camera motion without filtering slow
      frames; repeated compact and fullscreen runs satisfy the measured budget.
- [x] Mobile real-touch emulation preserves or improves the pre-patch response,
      framing, readability, and full-route behavior at representative DPRs.
- [x] Left/right world bounds and all generated ledges keep the climber both
      physically valid and visibly recoverable in every supported layout.
- [x] Launch, ascent, apex, landing, fall, respawn, checkpoint, and summit camera
      transitions are continuous and never shift the whole layout.
- [x] Fall, mutation, power-up, checkpoint, and system notices never obscure the
      climber or the intended landing route, including queued messages.
- [x] Restored checkpoints and resumed runs publish the correct zone/HUD state
      on the first visible frame; no event-listener startup race remains.
- [x] Resize/orientation, reduced motion, tab visibility, focus loss, startup,
      and Reddit-host-shaped containment have direct passing evidence.
- [x] Independent visual/runtime review finds no additional unresolved
      gameplay, UI, accessibility, or performance defect of medium severity or
      higher.
- [x] Type-check, lint, unit/integration tests, production build, all relevant
      browser E2E suites, and `git diff --check` pass from the final source.
- [ ] The confidence audit exceeds 95% with no failed high-risk gate and names
      every remaining hardware-only uncertainty.
- [ ] Focused commits are pushed; the clean pushed SHA is published and installed
      to the target subreddit; installed version and source identity are read
      back successfully.

### Working evidence

- Clean remote baseline: `master` and `origin/master` at `078a0aa`.
- Node 24/npm 11 produced an incomplete dependency extraction while returning a
  misleading successful install. Reinstalling with the system Node 22.22.1
  toolchain restored a complete dependency tree and passing TypeScript build.
- The old frame-pacing workflow did not wait for a launch to resolve before
  sending the next input, the baseline summit probe fired before the restored
  player was grounded, and full-playthrough discarded camera samples on frames
  at or above 80 ms while tolerating a 72 px minimum camera jump. Those gaps are
  now replaced by outcome-driven waits and gates that retain slow frames.
- Instrumented compact/fullscreen Chromium, Firefox, Linux WebKit, and mobile
  touch runs found no jump-time DOM relayout. The reproduced discontinuity was
  charge anticipation beginning from the previous jump's stored charge instead
  of the live hold; its fixed 24 px starting offset also made the first charge
  frame discontinuous.
- The candidate uses continuous live-charge anticipation and a bounded desktop
  Canvas pixel budget. Mobile keeps its DPR-2 surface; desktop compact and
  fullscreen use the same centered 760 x 800 maximum shell rather than scaling
  rendering work with an arbitrarily tall host viewport.
- Complete production-path traversal reaches the summit in Chromium desktop,
  Chromium mobile real-touch, and WebKit desktop. Desktop Chromium completes
  153 progress jumps without a fall; mobile and WebKit each recover one
  checkpoint-advancing fall. All three have zero non-progressing attempts,
  framing failures, player-visibility failures, notice overlaps, or unexpected
  camera discontinuities.
- Two final repetitions of the unfiltered gameplay-feel matrix pass all five
  environments: Chromium compact and fullscreen, Firefox compact, comparative
  software WebKit, and 390x844 DPR-3 Chromium touch. Chromium/Firefox/mobile
  browser and Phaser p95 frame times remain about 16.7-17.3 ms; visible player
  response remains below 46 ms; continuous desktop camera p99 steps remain near
  5 px, and mobile near 11.2 px. The deliberate charge motion has zero DOM
  relayout and zero layout-shift score.
- World-bound coverage passes at 286, 320, 375, 480, and 1280 px. The 365-seed
  corpus validates 55,551 route transitions and 13,140 impact sites with no
  invalid route, hidden landing, or hazard blockage.
- The overlay suite passes 2,774 geometric checks. State and accessibility
  matrices pass in Chromium and WebKit; a newly reproduced one-frame restored
  checkpoint mismatch was fixed by applying checkpoint and HUD state before
  paint, then passed all 198 state checks in both engines.
- Two real persisted falls in the shared-session E2E advance revision 37 to 39,
  defer the remote board safely while airborne, reconcile after respawn, show
  the resulting Mercy Nail and remote beat, and survive a cold page reopen at
  revision 39 with no errors.
- Playwright Chromium's software GPU crashes when the endurance runner combines
  the large Canvas surface with repeated full-page screenshots, including a
  deterministic post-summit capture crash. The harness now separates optional
  endurance screenshots from its in-page frame/input/camera evidence; targeted
  visual suites retain screenshot coverage.

### Pre-release confidence audit

| Dimension                       | Earned | Evidence status                                                                                                    |
| ------------------------------- | -----: | ------------------------------------------------------------------------------------------------------------------ |
| Input and physics response      |  20/20 | Repeated real keyboard and CDP touch hold/release, fall, respawn, and full traversal pass.                         |
| Frame delivery and camera feel  |  24/25 | Strict unfiltered timing and camera gates pass; one point remains reserved for physical Mac presentation hardware. |
| Gameplay correctness            |  20/20 | Three full summit traversals plus bounds, corpus, collision, and persistence evidence pass.                        |
| UI/UX legibility and state      |  15/15 | Overlay geometry, first-paint resume state, screenshots, accessibility, and responsive controls pass.              |
| Responsive and host behavior    |   9/10 | Mobile/desktop/fullscreen/resize/reduced-motion pass locally; one point awaits the installed Reddit-host audit.    |
| Regression and release identity |   5/10 | All source gates pass; five points await immutable publish, install, and readback.                                 |

Pre-release confidence is **93/100**. The goal intentionally remains active
until the hosted audit and immutable release identity earn the remaining five
release points and at least one host point, taking the final score above 95.

## Active Safari frame-pacing mission — 2026-08-02

### Objective

Remove the desktop Safari/WebKit rendering regression without weakening the
intentional launch impulse, camera heave, landing response, mobile clarity, or
Fallstack's Cutaway Reliquary presentation. Promote desktop Safari from an
untested assumption to a measured, browser-specific release gate.

### Confirmed baseline

- The release client forces Phaser Canvas 2D.
- At a 1280×800 browser viewport with DPR 2, the visible 758×742 board becomes
  a 1516×1484 backing canvas (2,249,744 pixels).
- Isolated Chromium holds 59.4 FPS during real jumps (16.7 ms median,
  16.8 ms p95).
- Isolated WebKit reaches only 12.5 FPS during the same jumps (80 ms median,
  92 ms p95), and is already slow while idle.
- WebKit at DPR 1 improves to 35.8 FPS but does not reach the smoothness gate.
- Linux Playwright WebKit software-composites the final DPR-2 browser surface:
  even a DPR-1 game canvas remains near 23 FPS there. It is a valid same-engine
  A/B regression runner, but not an absolute performance oracle for a
  hardware-accelerated Mac Safari compositor.
- The previous WebKit runtime smoke used a small DPR-1 mobile canvas, so it
  could pass while desktop Retina rendering remained broken.
- `b299716..2296613` changes only QA and this goal record; the production
  client source is identical to installed `fallstack@0.0.33`.

### Protected behavior

- Keep the current movement constants, charge curve, camera lookahead/easing,
  collision geometry, artifacts, visual hierarchy, and sound timing unless a
  failing regression proves a change is required.
- A browser-specific resolution fallback is acceptable only if it materially
  improves the affected Safari path, retains the same CSS dimensions and
  logical projection, passes side-by-side readability review, and does not
  alter mobile or other desktop browsers.
- A synthetic frame counter alone cannot sign off the fix. Real input,
  landing/camera invariants, resize behavior, and full traversal must pass.

### Execution loop

1. Measure one candidate at a time against identical viewport, DPR, input, and
   scene state.
2. Reject candidates that lower fidelity without a measured frame-time win or
   that disable the tactile jump response.
3. Lock the smallest successful renderer/workload change with a high-DPR
   desktop WebKit regression.
4. Re-run focused frame pacing and visual comparisons in Chromium and WebKit.
5. Re-run mobile, resize, overlay, camera, fall/respawn, checkpoint, and summit
   flows with production code and real input.
6. Run type-check, lint, all tests, production build, and diff review.
7. Commit only the verified fix and its durable evidence. Mark the goal
   complete only after every acceptance item passes.

### Acceptance checklist

- [x] At 1280×800 DPR 2, the desktop Safari profile uses one quarter of the
      original backing pixels and, in paired WebKit runs, lowers active median
      frame time by at least 28% while raising effective FPS by at least 35%.
- [x] The software-WebKit safety ceiling remains at or below 52 ms median and
      95 ms p95 with no frame above 120 ms; this relative VM gate is not
      mislabeled as physical Mac performance proof.
- [x] Desktop Chromium at the same viewport/DPR remains within 10% of its
      60 FPS baseline.
- [x] Side-by-side DPR-2 screenshots retain geometry, silhouettes, labels, and
      correctly projected output; mobile WebKit/Chromium retain their existing
      high-DPR profile.
- [x] Real jumps preserve launch velocity, camera continuity, landing framing,
      notices, collision, and player visibility.
- [x] Resize/orientation, reduced motion, fall/respawn, checkpoint restore, and
      full tower traversals pass in both browser engines where supported.
- [x] A permanent regression fails on the original Canvas/Retina condition and
      passes on the fix.
- [x] `npm run type-check`, `npm run lint`, `npm test`, `npm run build`, and
      `git diff --check` pass.
- [x] The focused fix is committed with no unrelated or generated artifacts.

### Verified result

- Product and regression commit: `7b4b58b`.
- Two final paired WebKit runs used 562,436 backing pixels instead of
  2,249,744. Across the release-candidate and clean-SHA repetitions, the Safari
  profile measured 43–44 ms active median and 20.9–22.1 effective FPS versus
  76–80 ms and 10.9–12.8 FPS for the unchanged Retina control. Candidate p95
  was 63–75 ms with no active frame above 120 ms.
- Two Chromium DPR-2 runs held 60 FPS with 16.7 ms median/p95 and no frame over
  34 ms.
- Desktop production climbs reached all 151 route platforms and the summit in
  Chromium and WebKit. WebKit recovered one route fall without a framing,
  visibility, notice, camera-continuity, or page failure.
- A 390×844 DPR-3 Chromium touch climb performed an opening fall/respawn,
  recovered four later falls, and reached the summit after 178 real
  hold/release jumps with zero framing, visibility, notice, or camera failures.
  DPR-3 WebKit retained the default high-resolution mobile profile and passed
  focused runtime, resize, accessibility, and restored-checkpoint checks.
- The full repository gate passed 163 tests. The production build retains only
  the pre-existing Phaser chunk-size advisory.
- Linux Playwright WebKit remains a software-rendered comparative runner.
  Physical Mac Safari feel is intentionally left for the user's hardware smoke
  after release; it is not claimed by these VM measurements.

### Release closeout requirement

Push the verified commits, build from the resulting clean Git SHA, upload and
publish immutable Devvit version `0.0.36`, install it in `r/fallstack_dev`, and
read the installed version back before marking this goal complete.

## Active stabilization mission — 2026-07-30

This section supersedes the historical environment and release assumptions
below for the current pass. The broader reconstruction record remains useful
design history.

### Objective

Starting from the latest remote `master` (`9856a71`, fast-forwarded on the
Linux VM), make the version installed in `r/fallstack_dev` match the behavior
that is verified locally and remove the defects still visible to the user:

- on mobile, the climber can travel or land off the visible left side while the
  right side behaves like a solid readable boundary;
- resize, camera, or render work visibly shifts the scene and produces a
  skipped-frame/wobble impression;
- fall, mutation, power-up, checkpoint, and related notices occupy the same
  upper-center route area and obscure the climber or intended landing;
- commits and local QA report fixes that are not perceptible in the installed
  Reddit build, creating a stale-version or wrong-artifact failure;
- avoidable layout/render work makes startup and play less smooth than the
  current implementation should be.

### Anti-false-positive rules

- A scene probe, teleport, paused simulation, mocked overlay, or direct mutation
  of Phaser internals is diagnostic evidence only. It cannot sign off a player
  flow by itself.
- A scripted summit route does not prove mobile controls, camera continuity,
  real-time visibility, host sizing, or notice readability unless it uses the
  same input and timing path a player uses.
- Browser emulation is run both as a bare game page and through the actual
  Reddit/Devvit host. Passing the bare page does not imply the hosted iframe or
  expanded modal passes.
- CSS/geometry assertions support screenshots and recorded interaction; they do
  not overrule a visible defect.
- The installed Devvit version, hosted WebView version, local Git SHA, and a
  visible build marker must be matched before claiming the tested code is live.
- A release is not ready for the user's iPhone until the exact installed
  revision is refreshed and re-tested after installation.

### Target matrix

| Surface                  | Viewport or mode                     | Required input                      |
| ------------------------ | ------------------------------------ | ----------------------------------- |
| Local production build   | 320×568 touch                        | real pointer/touch hold and release |
| Local production build   | 375×812 touch                        | real pointer/touch hold and release |
| Local production build   | 390×844 iPhone-like touch            | real pointer/touch hold and release |
| Local production build   | 1280×800 desktop                     | keyboard                            |
| Local production build   | 1920×1080 fullscreen                 | keyboard                            |
| Reddit playtest host     | desktop browser in Mobile mode       | actual expanded Devvit WebView      |
| Reddit playtest host     | desktop and fullscreen               | actual expanded Devvit WebView      |
| Installed Reddit version | narrowest observed hosted game frame | actual controls and live camera     |

Chromium is required for fast iteration. WebKit is required for the final
mobile regression because it is the closest browser engine available on this
VM to iPhone Safari. The user's physical iPhone remains the final hardware
confirmation.

### Execution loop

1. **Identify the exact artifact.** Record Git SHA, built asset hashes, Devvit
   upload/install version, hosted WebView version, viewport, browser, and cache
   state.
2. **Observe with real input.** Reproduce each report at normal gameplay timing
   without pausing or teleporting the scene. Capture trace/video, screenshots,
   console/page errors, frame timing, player/camera coordinates, and visible
   bounds.
3. **Challenge the existing QA.** Run the prior regression, list every mocked or
   bypassed production seam, and demonstrate whether it can pass while the
   reported symptom remains.
4. **Minimize and lock.** Add the narrowest failing regression at the actual
   seam. Keep diagnostic scene access separate from release-signoff paths.
5. **Patch the root cause.** Preserve desktop behavior and Fallstack's compact
   reliquary grammar. Avoid unrelated redesign or speculative abstraction.
6. **Re-run real play.** Exercise left/right extremes, multiple real jumps and
   falls, respawn, notice states, checkpoint, resize/orientation, background
   return, and at least one extended climb at every affected viewport.
7. **Measure smoothness.** Compare layout/resize counts, Phaser scale/camera
   changes, long frames, remounts, timers/listeners, and asset/bundle cost.
8. **Validate broadly.** Run targeted QA, type-check, lint, tests, production
   build, Chromium/WebKit runtime checks, and a complete production climb.
9. **Commit a verified checkpoint.** Record evidence and exact commands. Never
   mix generated throwaway evidence or unrelated user work.
10. **Install and prove freshness.** Upload a new immutable Devvit version,
    install it in `r/fallstack_dev`, read the installed version back, open the
    authenticated Reddit surface, verify the hosted asset/version marker, and
    repeat the affected real-input tests.
11. **Notify.** Send the user a phone alert only after the installed build is
    ready for a physical iPhone test.

If a pass produces new evidence, repeat from step 2. Stop only for a genuine
credential/platform blocker or after every release criterion below is met.

### Checklist

- [x] Fast-forward the clean VM worktree to current `origin/master`.
- [x] Preserve the historical reconstruction evidence and create this current
      VM-specific execution contract.
- [x] Audit commits `4e11711` through `9856a71` and the existing bounds,
      overlay, resize, playthrough, and host QA for bypassed production seams.
- [x] Match the baseline local SHA against the currently installed Devvit
      version (`9856a71` locally; app `0.0.31` in `r/fallstack_dev`) and add a
      runtime build marker so the next installation is exact rather than
      inferred.
- [x] Reproduce the left-side offscreen behavior with normal touch input in the
      hosted-equivalent mobile frame.
- [x] Reproduce and characterize the render/camera wobble with frame and resize
      evidence.
- [x] Reproduce obstructive fall feedback from a real fall and retain the
      injected state matrix only as secondary geometry coverage.
- [x] Add regressions that fail on the confirmed root causes, including DPR
      projection, redundant resize work, live notice overlap, and solid helper
      corridor clearance.
- [x] Fix the mobile boundary/camera/layout behavior without regressing desktop
      or fullscreen.
- [x] Fix notice placement/lifetime/stacking so the current jump remains
      readable.
- [x] Remove only measured avoidable render/layout work and verify smoother
      frame behavior.
- [x] Pass targeted Chromium and WebKit real-input checks at 320×568, 375×812,
      390×844, 1280×800, and 1920×1080.
- [x] Pass fall → respawn → post-respawn input → checkpoint → summit on the
      production build.
- [x] Pass `npm run type-check`, `npm run lint`, `npm test`, `npm run build`,
      and `git diff --check`.
- [x] Commit and push focused verified changes.
- [x] Upload/install a new immutable Devvit version, read the installation
      back, match the hosted asset to the release SHA, and complete hosted
      mobile and fullscreen traversals.
- [x] Send the ready-for-iPhone notification with the installed version.
- [ ] Confirm signed-in Reddit-shell behavior on the user's physical iPhone;
      Reddit's network-security block prevents this VM from opening the shell.

### Closeout

- Release code commit: `b299716ea95dd477f4227070803dbb0e7e4947e9`.
- Installed Devvit version: `fallstack@0.0.33` in `r/fallstack_dev`.
- Hosted build marker: `b299716ea95d`.
- Hosted mobile trusted-touch and fullscreen routes reached the summit.
- The requested phone notification was sent after install readback and hosted
  traversal.
- Remaining external check: the user's signed-in iPhone inside Reddit's host.

### Verified local evidence

- Chromium genuine-touch summit passes at 320×568, 375×812, and 390×844 with
  DPR 3. The driver records trusted `pointerType: touch` events and never writes
  movement state directly.
- Chromium keyboard summit passes at 1280×800 and 1920×1080. WebKit completes
  the same DPR-3 mobile route with real keyboard events; isolated WebKit
  trusted-touch, fall/respawn, resize, and reduced-motion probes also pass.
- Across those runs, the complete climber never leaves the real camera
  `worldView`; required landings remain framed; live fall/checkpoint notices do
  not overlap the climber, next landing, or touch buttons; and no unexplained
  camera jump occurs.
- The overlay matrix passes 2,792 checks, state/receipt matrices pass 192 checks
  per engine, resize/orientation passes 18 checks per engine, accessibility
  passes 48 checks per engine, and all tested world-bound widths pass.
- Chromium frame timing is median/p95 16.7/16.7 ms with zero frames over 34 ms.
  Software WebKit is median/p95 17/21 ms, with no normal-motion frame over
  34 ms.
- The current helper placement survives a 5,000-seed/180,000-site corpus. The
  route contract additionally passes 5,000 seeds and 760,958 transitions with
  no baseline, hazard, or minimum-jump invalidity. All 161 project tests pass.
- Exact release traversals at 375×812 DPR 3 trusted touch, 1280×800 desktop,
  and 1920×1080 fullscreen landed every route jump and reached the summit with
  no route fall or visibility, notice, framing, or camera failure. WebKit at
  375×812 DPR 3 also reached the summit with no invariant failure.
- `fallstack@0.0.33` is installed in `r/fallstack_dev`; its hosted `game.js`
  contains exact release marker `b299716ea95d`. The hosted trusted-touch mobile
  route completed 153/153 landings with no non-intro fall, and the hosted
  fullscreen route reached the summit.
- Authenticated Reddit interaction in a desktop browser remains environment
  blocked: both an isolated browser and the VM's saved Chrome profile return
  Reddit's network-security page. Devvit CLI authentication, immutable
  upload/install/readback, and direct hosted-asset identity and traversal all
  pass. The user's signed-in physical iPhone is the final hosted interaction
  check.

### Release criteria

The installed build is ready only when all of the following are true:

- the full rendered climber stays visibly inside two intentional readable
  boundaries throughout real left/right movement, charge, flight, landing,
  fall, respawn, resize, and every biome on mobile;
- no reachable landing can carry the player into invisible playable space;
- normal gameplay and host resize do not remount the scene, reset the camera,
  or create a visible one-frame layout jump;
- temporary feedback never obscures the climber, the next required landing, or
  fixed touch controls, and repeated events do not form a blocking stack;
- local and hosted tests identify the same Git/build marker and installed
  Devvit version;
- the broad project checks and real-input browser matrix pass with reviewed
  visual evidence;
- remaining hardware-only uncertainty is limited to the user's final physical
  iPhone confirmation and is stated explicitly.

## Goal

Turn the current Fallstack build into a visibly, audibly, and mechanically
polished shared climbing game by establishing a repeatable evidence loop,
finding and ranking defects across the complete player experience, rebuilding
the soundscape and player presentation where evidence supports it, and closing
each verified issue with tests, browser proof, documentation, and a focused
commit.

The primary and only execution environment is the current Mac. Remote
provisioning, probing, and handoff are out of scope. Gate 0 proves that the
Mac's local browsers, authenticated Safari session, audio output/capture, and
project toolchain form a complete feedback loop before product behavior changes.

## Starting point

- Baseline commit: `7c4e06f` on `master`, pulled on 2026-07-27.
- The pull contains a recent moderator-feedback pass:
  - native-size/DPR-aware rendering and a horizontally following camera;
  - committed jump direction, planted charge, correction-only air input, and an
    arc preview;
  - a quieter HUD, replayable Guide, and mechanic-first Tower Memory;
  - reliable music start/restart, independent persisted Music/SFX controls,
    mobile output changes, and audio diagnostics;
  - touch release after a fall;
  - Chromium/WebKit runtime smoke, two-client reconciliation, and a complete
    automated production-build climb.
- These fixes are evidence, not a declaration that the user's current reports
  are resolved. Recapture and reassess them from this exact commit.
- Current portable checks on 2026-07-27:
  - `npm ci`, type-check, lint, all 146 tests, and the production build passed;
  - the build retains the known expanded Phaser chunk warning;
  - install reported 42 transitive audit findings (24 moderate, 18 high), which
    must be triaged separately rather than changed speculatively;
  - Chromium runtime touch/fall/respawn/reduced-motion checks passed;
  - WebKit timed out once while three QA jobs competed in parallel, then passed
    when rerun alone; treat concurrency as the current flake hypothesis;
  - the two-client shared-session reconciliation passed from revision 37 to 39.
- Preserve the user's untracked `fallstack/docs/fixplan.md`. Do not stage,
  rewrite, delete, or absorb it into a checkpoint commit.
- Preserve the selected Cutaway Reliquary grammar: washi, indigo, persimmon,
  tactile damaged architecture, sparse overlays, and a tower-dominant
  composition. A character rebuild may evolve the player but must not replace
  the product with a generic fantasy or pixel-art direction.

## Non-negotiable product rules

- The first viewport shows that community failures physically changed today's
  tower.
- The tower remains the visual hero.
- One global analog charge movement model applies across every biome.
- Every generated route is finite and has an artifact-free solution.
- Helpful artifacts are optional; cursed artifacts cannot block the only path.
- Fall data remains aggregate or anonymous; positive achievements may use
  authenticated identity.
- Pure game logic, Phaser simulation/rendering, and Devvit persistence remain
  separate.
- Client input never becomes persistent authority.
- No paid service, heavy production dependency, authentication change, or
  production publish is introduced without explicit approval.
- Jump King is a mood and control reference only. Do not copy music, melodies,
  sound assets, character art, or other protected material.

## The execution loop

Every workstream and every issue uses the same loop:

1. **Observe:** play the exact current production build and capture the symptom,
   viewport, input sequence, audio state, seed/zone, browser, and environment.
2. **Reproduce:** create the fastest agent-runnable signal at the correct seam:
   pure test, browser assertion, audio render/probe, deterministic playthrough,
   or a structured human-listening clip.
3. **Classify:** assign an issue ID, severity, workstream, ownership layer,
   reproducibility rate, and player impact.
4. **Hypothesise:** record three to five ranked, falsifiable explanations and
   their distinguishing probes. Surface the ranking before testing it.
5. **Minimise:** reduce the failing route, seed, input sequence, audio event
   sequence, or viewport without changing the observed defect.
6. **Lock the regression:** add a failing test at the real seam when one exists.
   If no trustworthy seam exists, record that gap instead of adding a weak test.
7. **Fix minimally:** change only the code and assets needed for the reproduced
   issue. Do not bundle speculative cleanup or unrelated redesign.
8. **Verify narrowly:** rerun the regression and the original unminimised repro.
9. **Verify broadly:** run the affected browser matrix, gameplay path, and
   project-native checks.
10. **Assess quality:** listen, play, and compare before/after evidence at actual
    mobile and desktop presentation sizes. Automated metrics cannot approve
    taste or feel.
11. **Log and commit:** update the workstream record, remove temporary probes,
    review the diff, and make one intentional verified checkpoint commit.

An issue is not fixed because the code looks plausible. The original symptom
must stop reproducing, the relevant regression must pass, and the result must
survive the broader player path.

## Evidence and work logs

Create `fallstack/docs/quality-reconstruction/` during Gate 0 and keep these
records separate:

| File                  | Owns                                                                         |
| --------------------- | ---------------------------------------------------------------------------- |
| `status.md`           | Gate state, issue index, decisions, commits, commands, blockers              |
| `environment.md`      | Mac/tool versions, auth/browser/audio probes, local constraints              |
| `baseline.md`         | Current mobile/desktop/host captures and systemic findings                   |
| `audio.md`            | SFX/music inventory, signal metrics, listening notes, source/licence records |
| `gameplay-world.md`   | Input, physics, camera, horizontal bounds, collisions, respawn               |
| `tower-quality.md`    | Seed corpus, platform margins, visibility, reachability, difficulty          |
| `character.md`        | Player silhouette directions, selected grammar, state matrix, runtime proof  |
| `ui-ux.md`            | Hierarchy, guidance, overlays, controls, copy, accessibility                 |
| `host.md`             | Local versus Reddit-hosted behavior, shared state, browser-specific evidence |
| `issues/ISSUE-NNN.md` | One reproducible issue, hypotheses, probes, fix, regression, result          |

Store generated proof under
`fallstack/docs/quality-reconstruction/evidence/<gate-or-issue>/`. Do not mix
throwaway captures with shipped assets. Evidence files must state whether they
came from local practice, a mocked shared session, or an authenticated Reddit
playtest.

## Gate 0 — Prove the Mac feedback loop

Do not begin reconstruction until this gate passes.

### Required workstation prerequisites

- Git access to the repository and the intended branch.
- Node.js `>=22.2`, npm with `npx`, and a clean `npm ci`.
- Playwright `1.61.1` with Chromium and WebKit browser binaries.
- Python 3 or another non-mutating static server for `dist/client`.
- Enough disk for the Phaser build, browser video, screenshots, full-playthrough
  JSON, and audio review files.
- The signed-in Safari profile that can open
  `r/fallstack_dev/?playtest=fallstack`.
- Working Mac audio output plus a deterministic way to capture the game's final
  master bus into a reviewable audio file. Browser analyser values and oscillator
  counts are supplemental, not substitutes for listening.

### Required probes

From `fallstack/`:

```sh
node --version
npm --version
npx playwright --version
npx devvit --version
npm ci
npm run type-check
npm run lint
npm test
npm run build
```

Serve the production client at `http://127.0.0.1:8080`, then run:

```sh
npm run qa:runtime -- docs/quality-reconstruction/evidence/gate-0/chromium --browser=chromium
npm run qa:runtime -- docs/quality-reconstruction/evidence/gate-0/webkit --browser=webkit
npm run qa:shared -- docs/quality-reconstruction/evidence/gate-0/shared-session
npm run qa:playthrough -- --output docs/quality-reconstruction/evidence/gate-0/playthrough --browser=chromium --retries=40 --max-jumps=1200
```

Additionally prove:

- a 320×568 and 375×812 touch path;
- a 1280×800 desktop keyboard path;
- one fall, grounded respawn, post-respawn input, checkpoint, and summit;
- reduced-motion behavior;
- Music/SFX on/off independence and audible-signal diagnostics;
- no unexpected page errors or stuck input;
- the player remains visible throughout deliberate movement to both horizontal
  extremes;
- the authenticated Reddit page can be opened without a network-security block,
  if hosted work is claimed;
- game audio is actually audible on the Mac and a reviewable capture path is
  demonstrated;
- Safari inline/expanded behavior is exercised through the existing signed-in
  profile without copying or exposing session data.

### Gate 0 exit

The gate passes only when local automation, headed visual inspection,
authenticated Safari access, audible playback, and a trustworthy captured-audio
review path all work. Record exact results in `environment.md` before editing
product behavior.

## Gate 1 — Fresh baseline and issue census

Build from the Gate 0 commit and capture the same deterministic states at:

- splash: mobile and desktop;
- expanded pre-input: 320×568, 375×812, and 1280×800;
- charge, launch, land, fall, mutation receipt, respawn, checkpoint, each biome,
  summit, Guide, and Tower Memory;
- normal and reduced motion;
- local practice, mocked two-client session, and authenticated Reddit where
  available.

Run deliberate exploratory play, not only the summit bot:

- walk and jump into both horizontal extremes;
- charge at the extreme left and right;
- fall while holding each touch control;
- land on the narrowest, nearest-edge, ghost, corpse, Mercy, cursed, checkpoint,
  and summit surfaces;
- resize/orient while grounded, charging, airborne, in a dialog, and after
  respawn;
- toggle Music and SFX independently before unlock, during charge, after a fall,
  after background/foreground, and after reload;
- remain in each biome long enough to assess repetition, fatigue, and
  sound-to-theme fit.

Score the visual baseline with the existing Fallstack scorecard. Add separate
audio and character evidence rather than hiding those judgments in the visual
score.

Gate exit: every observed defect is reproducible or explicitly marked
unconfirmed; fixed work from the latest pull is separated from remaining work;
severity and execution order are agreed in `status.md`.

## Workstream A — Audio correctness and instrumentation

First make the audio system observable and reliable before judging composition.

Inventory every sound event and lifecycle transition:

- audio unlock, suspend, interrupt, resume, page show/hide, and context close;
- charge start/cancel, launch, land by biome, fall, mutation, checkpoint, and
  summit/result;
- Music and SFX toggles, persisted preferences, previews, reload, and repeated
  mount/unmount.

Build deterministic checks for:

- truthful Music/SFX state before and after browser unlock;
- one-time migration of the legacy `fallstack:muted` preference so all four
  Music/SFX combinations survive reload independently;
- complete isolation between gameplay and music buses;
- no phantom landing cue on the initial grounded frame;
- exactly one intentional fall/respawn sequence, without a synthetic landing
  caused by checkpoint teleportation;
- no stuck charge tone after cancel, fall, dialog, blur, or respawn;
- no duplicate music graph, leaked timer/source, or rising level after repeated
  toggles and reloads;
- immediate bus silence when disabled, including queued secondary tones and
  still-decaying sources;
- stable state after at least twenty normal and rapid Off/On cycles;
- suspend, interrupted, closed, background, and foreground recovery without
  stale charge nodes or duplicate music intervals;
- one intentional AudioContext owner, or an explicit tested reason for more;
- diagnostics that attribute context, bus, cue, active source, and timer state;
- output present when enabled and silent when disabled;
- peaks below clipping and a documented relative-loudness hierarchy;
- Chromium, WebKit, and hosted behavior where available.

Automated source counts and RMS/peak values prove signal flow only. They do not
approve timbre, mix, pacing, or coziness.

Gate exit: a fast audio correctness harness catches the known silent-start class
of bug, stuck/duplicate sources, bus cross-talk, and lifecycle regressions.

## Workstream B — Rebuild gameplay sound design

Reconstruct the SFX palette from a blank brief while preserving the event
contract. The target is tactile, restrained, responsive, and coherent with a
damaged reliquary—not generic arcade beeps.

For each cue define:

- player action/state it confirms;
- material and emotional role;
- onset, duration, pitch/noise balance, dynamics, and variation limits;
- relationship to music and other simultaneous cues;
- reduced-sensory alternative if required;
- biome influence, if any, without creating different movement rules.

Extend the event contract where required so floor landing, wall bonk, artifact
collapse/curse, checkpoint, and summit are semantically distinct. Landing sound
may use bounded impact velocity and material/platform type; it must not infer
those meanings from biome alone.

Create an A/B review reel containing charge, cancel, three charge strengths,
launch, representative landings, wall bonk, artifact collapse, fall/respawn,
mutation, checkpoint, and summit in context. Review on current Mac output and
export a lossless or high-quality capture for repeatable comparison. Reject cues
that mask input timing, become tiring over repetition, imply the wrong
collision, or disappear under music.

Gate exit: every gameplay event is distinct in context, charge/launch timing is
legible, no cue glitches under rapid/repeated play, and a recorded listening
decision supports the selected palette.

## Workstream C — Rebuild background music

Compose or produce an original, copyright-safe background score that is cozy,
slightly cursed, patient under repetition, and matched to the Cutaway Reliquary
and its three visual zones.

The design must decide explicitly:

- one continuous adaptive piece versus related biome layers;
- harmonic palette, tempo/rubato, instrument/material palette, density, and
  silence;
- transitions between Lower Ruins, Bell Shaft, and Moon Roof;
- fall, checkpoint, and summit ducking or response;
- loop length and variation sufficient for a long climb;
- behavior during Guide, Tower Memory, backgrounding, and reduced motion;
- asset provenance, licence, source files, encoding, and bundle cost.

Prototype at least three compositionally distinct short directions. They must
vary in musical structure or instrumentation, not only EQ or volume. Score them
for product fit, coziness, cursed/tactile identity, long-session fatigue,
gameplay clarity, biome coherence, technical reliability, and bundle/runtime
cost. Stop for user selection if the choice materially defines the product.

Gate exit: the selected original direction plays, loops, transitions, mutes,
resumes, and coexists with SFX without clicks, obvious seams, masking, or source
leaks; at least a ten-minute in-context capture, clipping/loudness/spectral
checks, and a human listening scorecard approve it. The scorecard covers tactile
fit, gameplay clarity, repetition, fatigue, coziness, cursed-reliquary identity,
and biome coherence.

## Workstream D — Horizontal bounds, camera, and offscreen play

Reproduce the report that the player can travel past the visible left/right
border or stand on a ledge outside the frame. Test both possibilities rather
than assuming the fix is a clamp:

- the physics player escapes the declared world;
- the 480 px route is wider than a narrow viewport and camera tracking lags,
  clamps incorrectly, or frames the player without a safe margin;
- a platform/artifact/collision body is generated outside legal bounds;
- render and collision coordinates diverge after route offset, DPR, resize, or
  checkpoint restore;
- charge, air correction, or knockback crosses a camera/world edge unexpectedly.

Acceptance:

- the player silhouette remains visible with a documented horizontal safe
  margin at every reachable position;
- the camera or physical boundary behavior is intentional and consistent at
  320, 375, 480, and desktop widths;
- no collidable surface is reachable while its important landing edge is
  unknowable offscreen;
- render, body, event, and server-validated coordinates agree;
- edge behavior survives resize, respawn, and every biome.

Gate exit: a deterministic two-edge browser regression and relevant pure layout
tests fail before the fix and pass after it.

## Workstream E — Tower generation and ledge quality

Audit representative daily seeds and every chunk/connector for:

- side margins and camera-readable landing space;
- minimum visible ledge width;
- artifact/body overlap;
- default route reachability using the actual movement constants;
- jump difficulty progression and first-checkpoint timing;
- cursed artifacts preserving the only route;
- checkpoint/summit transitions;
- visual clutter and labels hiding collision edges.

Do not equate coordinate-bounds validity with playability. Use the automated
summit path, seed/property tests, route metrics, and sampled real play. Prefer a
small generator constraint over per-seed patches.

Gate exit: the seed corpus satisfies bounds/reachability invariants, sampled
routes keep the player and intended landing readable, and a complete climb still
passes without relying on helpful artifacts.

## Workstream F — Player character reconstruction

Treat the player as an art-direction problem, not a cosmetic tweak. Preserve the
small mobile silhouette, physics body, origins, and movement authority while
rebuilding presentation.

Create three genuinely distinct character directions inside the selected
Fallstack grammar. Each direction must show:

- idle/facing left and right;
- planted charge at low/full strength;
- airborne rise/fall;
- land, hard fall, respawn, checkpoint, and summit;
- readability over all three biome palettes at 320×568 and 375×812;
- clear separation between decorative silhouette and collision body;
- reduced-motion-safe state communication.

Score silhouette recognition, direction/charge legibility, emotional fit,
tactile material identity, animation coherence, mobile readability, originality,
and Phaser/runtime cost. Require user selection before the visual grammar is
frozen. Then prove transparency, scale, filtering, origin, mirroring, collision
alignment, reload/disposal, and fallback behavior in Phaser before full
integration.

Gate exit: the selected character materially beats the current baseline at
gameplay scale, every movement state reads without changing physics, and browser
proof covers all biomes and target viewports.

## Workstream G — UI, guidance, and feedback

Audit the complete interaction hierarchy:

- splash promise and expand action;
- first viewport, HUD, Guide, audio controls, charge/arc feedback, mutation
  receipt, checkpoint message, remote mutation beat, Tower Memory, and result;
- loading, shared-board unavailable, capped/stale mutation, focus, scroll,
  resize/orientation, and long/edge copy.

Acceptance:

- the tower and current jump dominate the first viewport;
- community cause and physical consequence are understandable before input;
- controls are replayably explained without a tutorial wall;
- temporary messages never hide the player, target ledge, or controls;
- fixed controls meet touch targets and safe-area requirements;
- dialogs trap/restore focus, scroll on short screens, and disable play input;
- meaning never depends on color alone;
- representative text and focus states meet contrast targets;
- no generic card-stack or dashboard drift.

Gate exit: targeted UI tests, accessibility inspection, and before/after mobile
and desktop captures pass the scorecard with evidence.

## Workstream H — Broader gameplay bug sweep

Explore the full player lifecycle for defects not named in the request:

- keyboard, touch, multi-touch, held-input cleanup, blur/focus, and dialogs;
- charge cancellation, landing classification, wall bonks, minor falls, death
  line, respawn, checkpoint restore, and summit;
- artifact collision/state transitions and safe board reconciliation;
- practice versus shared state, duplicate tabs, stale daily board, API failure,
  contribution caps, and rollover;
- frame pacing, scene remount, memory/timer leaks, and bundle regressions.

New findings enter the same issue loop and are fixed only when severity and
evidence justify them. Do not turn the sweep into unrelated feature work.

## Gate 2 — Integrated vertical slice

Integrate the selected audio, music, character, world-boundary, tower, and UI
changes into the opening zone plus first fall only.

Prove:

- community mutation is visible before input;
- the opening jump, direction, charge, SFX, and music all read together;
- both horizontal extremes remain safe and visible;
- the first fall produces correct sound, visual feedback, mutation, respawn, and
  clean input state;
- mobile controls and feedback do not hide the route;
- the new player and soundscape materially beat the baseline.

Do not migrate the entire tower until this slice passes.

## Gate 3 — Full-tower and hosted integration

After the vertical slice passes:

- extend the approved system through all three biomes and player states;
- run Chromium and WebKit runtime smoke at mobile/desktop sizes;
- complete at least one production-build summit path;
- run shared two-client reconciliation;
- test independent Music/SFX state across reload and visibility changes;
- inspect authenticated Reddit inline and expanded surfaces;
- verify no persistence, trust-boundary, or daily-board regression.

Uploading or installing a playtest is allowed only when the execution checkpoint
explicitly authorizes that external change. Publishing a production version
requires separate explicit approval.

## Gate 4 — Final validation and closeout

Required project checks from `fallstack/`:

```sh
npm run type-check
npm run lint
npm test
npm run build
git diff --check
```

Required evidence:

- fresh splash/mobile/desktop/fullscreen matrix;
- normal/reduced-motion and Chromium/WebKit runtime results;
- edge-boundary regression;
- representative seed/reachability results;
- complete fall-to-summit production-build playthrough;
- two-client shared-state proof;
- extended music/SFX correctness metrics and listening notes;
- selected-character state sheet and in-browser captures;
- accessibility/focus/touch/contrast results;
- authenticated Reddit result or exact blocker;
- real signed-in Safari and Mac audio-output results.

Close all temporary instrumentation, generated debug files, and tagged logs.
Review the final diff for secrets, unlicensed assets, unrelated changes, and
unexplained bundle/frame-time growth.

## Commit checkpoints

Use focused commits after verified exits; never stage the user's unrelated
files.

Suggested checkpoints:

1. `docs(quality): define reconstruction goal`
2. `test(qa): establish workstation quality baseline`
3. `test(audio): add deterministic sound feedback loop`
4. `feat(audio): rebuild gameplay sound palette`
5. `feat(music): add selected Fallstack score`
6. `fix(game): keep horizontal play readable`
7. `fix(tower): enforce readable generated ledges`
8. `feat(player): implement selected climber`
9. `fix(ui): close verified interaction defects`
10. `test(qa): certify reconstructed experience`

Split or skip a checkpoint when the actual evidence supports a smaller diff.
Commit messages must name the verified cause or selected direction, not merely
“polish.”

## Definition of done

This goal is complete only when:

- the workstation feedback-loop gate has honest recorded evidence;
- all confirmed high/medium issues are fixed or explicitly deferred with owner,
  reason, and risk;
- the original offscreen-player report no longer reproduces;
- tower generation keeps all required landings fair, readable, and finishable;
- SFX and music are independently controllable, reliable, original/licensed,
  audibly reviewed, and coherent with the game;
- the selected rebuilt character is legible in every required state and biome;
- the first viewport and first fall unmistakably prove shared mutation;
- local, browser, shared-session, full-playthrough, and project checks pass;
- authenticated Reddit, Safari, physical-device, or audio-hardware gaps are
  either verified or handed off explicitly rather than implied;
- evidence and decisions are reproducible from the repository;
- checkpoint commits are focused and the user's unrelated work is untouched.
