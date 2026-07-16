# Mobile release-hardening ExecPlan

## Objective

Make the current Fallstack build safe for public mobile play. Reproduce and eliminate the reported fresh-session infinite-fall/immobility loop, quantify and correct the slow opening movement if it is application-owned, repeatedly complete the generated tower across fresh and resumed sessions, fix other material blockers found by those runs, and make Lower Ruins, Bell Shaft, and Moon Roof visibly distinct without abandoning the selected Cutaway Reliquary grammar.

## Known state at start

- Local `master` began at `cc28ac3` and was clean after checkpointing the pre-existing pitch/submission work in `dae7310`.
- `npx devvit list installs fallstack_dev` reports installed app `fallstack v0.0.21` on 2026-07-16.
- The repository only documents installs through playtest `v0.0.20.2`; the CLI result does not identify the source commit behind `v0.0.21`.
- Local commits after the documented `0.0.20.2` install include movement/runtime, route, checkpoint, resume, and QA fixes. Runtime equivalence between the iPhone report and local `master` is therefore unproven.
- The selected Cutaway Reliquary direction, art bible, and three visual-zone mapping are frozen. This pass may strengthen per-zone color/value treatment, but may not replace that direction or change collision semantics.
- The reported primary failure is: in a new Reddit iPhone session, one fall led to continuous falling with no usable movement or jump input.
- The reported secondary failure is: movement and jumping initially feel slow, then reach normal pace after two or three jumps.

## Architecture and ownership

- Pure/shared logic continues to own movement constants, tower generation, progress thresholds, and testable lifecycle decisions.
- Phaser continues to own physics bodies, input sampling, collision, camera, fall detection, and respawn execution.
- React/Devvit continues to own API state, persistence, overlays, and touch controls. It may not become physics authority.
- The server is unchanged unless a browser repro proves that an authoritative response corrupts the local lifecycle. Any server change requires targeted tests.

## Feedback loops

1. Fresh-session fall/respawn loop at a 375x812 mobile context:
   - clear local state;
   - wait for scene readiness;
   - deliberately fall through normal keyboard and real touch paths;
   - assert exactly one fall event for the attempt;
   - assert the next attempt settles on its checkpoint, accepts horizontal input, charges, launches, and does not emit another fall without leaving the platform;
   - repeat several cycles.
2. Opening-speed measurement:
   - record readiness timing, frame intervals, ground displacement per fixed hold, charge duration, launch velocity, airtime, and the same measurements after several jumps;
   - compare cold and warm loads and separate host/network latency from post-ready simulation speed.
3. Full-run replay:
   - use the production build and real Phaser scene at mobile and desktop viewports;
   - run fresh, fresh-with-intro-fall, resumed-checkpoint, repeated-fall, reduced-motion, and full-summit paths;
   - fail on console/page errors, blocked route, missing summit, input not releasing, or respawn not settling.

## Milestones

### M0 — Preserve prior work and establish versions

- Inspect all dirty files, ignore generated dependencies/output, scan candidate text for credentials, and validate the prior video/QA work.
- Commit it separately so hardening begins from a clean baseline.
- Record local head, origin head, CLI version/login, and installed subreddit version.

Exit: prior work is preserved in an intentional commit and no unattributed dirt overlaps production code.

### M1 — Reproduce reported lifecycle and performance symptoms

- Build production assets and serve `dist/client` locally.
- Capture 375x812 opening, first fall, respawn, and post-respawn input state.
- Exercise keyboard and real touch events.
- Run the loop repeatedly against a fresh browser context, local fallback, and mocked successful `/api/init-game` where available.
- Measure first-input and later-input motion with frame timing.
- If the exact user symptom cannot be reproduced locally, inspect the installed Reddit runtime through an authenticated browser before forming code hypotheses.

Exit: a deterministic or materially elevated reproduction rate exists for each application-owned symptom, or local non-reproduction plus hosted evidence narrows the problem to version/host state.

### M2 — Diagnose and fix the infinite-fall loop

- Publish three to five falsifiable hypotheses after M1 evidence.
- Probe one variable at a time: physics/display body reset, active platform-body availability, checkpoint geometry, stale held input, scene lifecycle, snapshot refresh/reconciliation, and resume state.
- Add regression coverage at the narrowest seam that exercises the real chain. Prefer browser lifecycle coverage when pure tests cannot represent Arcade Physics synchronization.
- Apply the minimum root-cause fix and remove temporary instrumentation.

Exit: the original loop passes repeatedly after real falls on keyboard and touch, and the regression test fails without the fix where a correct seam exists.

### M3 — Correct verified opening-speed problems

- Use measurements, not subjective tuning alone.
- Separate pre-ready load latency from post-ready physics cadence.
- Fix only confirmed application causes such as simulation startup state, input gating, frame-dependent interpolation, audio unlock blocking, or touch-event delay.
- Preserve the one global analog charge model and existing reachability budgets unless measurement proves the constants themselves wrong.

Exit: fixed-duration input produces stable movement/launch results at opening and after several jumps, within explicit tolerances and without breaking tower reachability.

### M4 — Repeated play and blocker cleanup

- Complete multiple production-build climbs, including at least one with an intentional opening fall and one from a restored checkpoint.
- Exercise consecutive falls, checkpoint transitions, helper/cursed artifacts, shared-board reconciliation at safe points, summit/result/return, reload, reduced motion, and 320x568/375x812 controls.
- Fix only material gameplay, lifecycle, input, visibility, or route defects encountered and reproduced.

Exit: all required paths complete or recover without an input/fall loop, and exact evidence is archived under `docs/qa/release-hardening/`.

### M5 — Strengthen biome differentiation

- Keep the reliquary frame, washi/indigo/persimmon anchor roles, typography, artifact shapes, and global movement model.
- Add a typed per-zone color/value treatment to the existing architectural/material contracts.
- Lower Ruins should read warm, earthen, repaired, and ember-lit; Bell Shaft should read darker brass/verdigris and vertical; Moon Roof should read cool lunar indigo/ghost-mint and open.
- Ensure route surfaces and artifacts remain readable by silhouette and contrast, not color alone.
- Capture comparable mobile/desktop frames for all three zones and score the result against the repository scorecard.

Exit: each zone is identifiable from a cropped gameplay frame without its text label, while the whole tower still reads as one Cutaway Reliquary.

### M6 — Deployment/version closeout and final gate

- Re-run `npm run type-check`, `npm run lint`, `npm test`, `npm run build`, `git diff --check`, screenshot/browser replay checks, and relevant QA scripts.
- Compare installed version and hosted behavior again after local fixes.
- Do not upload, publish, or install a new remote version without separately surfacing the exact mutation and resulting version; deployment is a release action, not implicit validation.
- Update `docs/design-redesign/status.md` with baseline, palette extension, commands, evidence, and residual hosted uncertainty.
- Commit verified gameplay, visual, and evidence checkpoints intentionally and leave the worktree clean.

Exit: local public-play gate passes, commits are reviewable, the installed/local relationship is explicit, and no required implementation step remains.

## Required validation matrix

| Area | Narrow signal | Broad signal |
| --- | --- | --- |
| Fall/respawn | repeated mobile lifecycle loop | intro-fall full playthrough |
| Opening speed | fixed-duration cold/warm input measurements | runtime smoke at mobile sizes |
| Movement/tower | movement/progression/tower tests | `npm test` plus summit replay |
| Touch | real pointer/touch hold and release | 320x568 and 375x812 smoke |
| Resume/checkpoint | resumed spawn plus post-fall recovery | resumed full playthrough |
| Visual zones | typed treatment tests and same-state captures | scorecard at mobile/desktop |
| Shared state | safe reconciliation after landing/respawn | shared-session QA where relevant |
| Project | targeted type/lint/test | type-check, lint, tests, build, diff check |

## Stop conditions and residual risks

- Stop before a remote upload/install/publish unless the user has explicitly authorized that release action in the current task context and the local gate is green. The current request authorizes investigation and local repository changes; it does not make an unreviewed production release safe by default.
- If authenticated Reddit runtime access is unavailable, report installed version evidence separately from behavioral equivalence.
- If the exact iPhone-only failure remains unreproducible after local mobile loops and authenticated hosted checks, request a screen recording/runtime timestamp only after all safe in-scope probes are exhausted.
- Do not hide a flaky repro by replacing it with a nearby failure. Record reproduction rate and exact symptom.

## Progress

- [x] M0 prior work checkpointed in `dae7310`; local CLI and installed `v0.0.21` recorded.
- [x] M1 unintended post-respawn fall reproduced in 9/10 fresh contexts; opening touch/frame behavior measured in repeated Chromium and WebKit contexts.
- [x] M2 Arcade body reset fixed the fresh-session loop; active-body rebuild fixed restored-checkpoint fall-through; browser regressions cover both chains.
- [x] M3 warm and post-respawn movement are identical across five Chromium runs with stable 16.7 ms cadence; no multi-jump physics ramp was found, so global movement constants were preserved.
- [x] M4 six production-build climbs reached the summit across fresh, opening-fall, restored, reduced-motion, compact, desktop, Chromium, and WebKit paths.
- [x] M5 typed warm/verdigris/lunar palettes passed tests and mobile/desktop/WebKit capture review without changing collision semantics.
- [x] M6 full project/deployment closeout complete; type-check, lint, 136 tests, build, Chromium/WebKit runtime gates, upload, install, and independent install listing passed.

Detailed evidence is archived in [`../qa/release-hardening/report.md`](../qa/release-hardening/report.md). The urgent body-reset fix was installed as `v0.0.22`; the complete build containing the body reset, checkpoint-body rebuild, and palette commits was independently confirmed installed as `v0.0.23`.
