# Feedback Reward Work Log

This is the durable handoff record for the Devvit feedback-reward research. Read this file and `feedback-evidence-matrix.md` after any context compaction before continuing experiments.

## Workspace

- Current canonical repository: `/Users/arshdeepsingh/Developer/FallStack`
- Current branch: `master`
- Remote feedback-research history was merged at `bf03ee0` before the 2026-07-14 Mac pass.
- The earlier `/home/arshdeepsingh/work/github/FallStack-feedback-reward` VM worktree and `feedback-reward-research` branch remain provenance for the 2026-07-12 experiments, not the active path.
- Disposable current-release projects live under `/tmp/fallstack-devvit-feedback-macos-20260714` and must not be committed.

All further feedback research should update the current repository above while preserving unrelated user changes.

## Authenticated-host setup and completed pass

On 2026-07-12, a temporary login desktop ran on the `skywalker` VM for real Reddit host QA:

- Xvfb display `:99`, 1440×1000;
- headed `/usr/bin/google-chrome` 150.0.7871.100 with persistent QA profile `/home/arshdeepsingh/.config/google-chrome-fallstack-qa`;
- Chrome DevTools bound to `127.0.0.1:9222`;
- x11vnc bound to `127.0.0.1:5900` with no VNC password because it was localhost-only;
- noVNC/websockify bound to `127.0.0.1:6080` and proxied to localhost VNC;
- all three TCP listeners were verified with `ss`; no public listener or firewall rule was added.

The user completed login through the temporary tunnel. Chrome authentication persisted in the dedicated QA profile; no cookie or session-store values were extracted or transferred.

User tunnel used during login:

```sh
gcloud compute ssh skywalker --zone=asia-south2-b -- -N -L 6080:127.0.0.1:6080
```

Then open `http://127.0.0.1:6080/vnc.html?autoconnect=1&resize=scale`, log into Reddit, and tell the agent only that login completed. Never paste credentials or cookies into chat.

The authenticated pass is recorded in `docs/playtest-evidence/2026-07-12-authenticated-host/report.md`. It covered the real inline post, expanded Mobile/Desktop layouts, warm-load timings, encoded resource sizes, console state, a no-input stability probe, and non-polluting hosted fall/clear/summit validation. The pass found and locally fixed an application-owned stale-inline-counter bug. Chrome, Xvfb, x11vnc, and websockify were stopped after capture; `ss` and process inspection confirmed no listener remained on 5900, 6080, or 9222. The persistent QA profile contains authentication state and must not be committed, printed, copied to third parties, or inspected for cookie values.

## Objective

Build an award-worthy, evidence-driven feedback submission about Devvit, Devvit Web, Reddit host behavior, developer tools, and Phaser-game development. Do not optimize only for the form prompts. Run real experiments, distinguish Devvit-owned issues from application/environment problems, preserve reproductions and artifacts, recommend concrete fixes, and continuously improve the form answers as evidence accumulates.

The exact form prompts are in the repository-root `feedbackquestions.md`.

## Canonical artifacts

- `fallstack/docs/devvit-feedback-log.md`: reproduced platform/tooling findings with environment, commands, expected/actual behavior, severity, workaround, and recommendation.
- `fallstack/docs/feedback-evidence-matrix.md`: claim-quality gate, ownership classification, and remaining evidence gaps.
- `fallstack/docs/feedback-form-draft.md`: evolving answers to the exact form questions; provisional claims must remain labeled.
- `fallstack/docs/cli-diagnostics-pass.md`: controlled CLI/config/logging experiments.
- `fallstack/docs/template-audit-pass.md`: pinned first-party React/Phaser install, audit, build, and contract evidence.
- `fallstack/docs/phaser-packaging-observability-pass.md`: exact Vite defaults, CLI-selected upload manifest, size split, and packaging recommendations.
- `fallstack/docs/maintainer-patch-map.md`: upstream source root causes, verified dependency bumps, exact files, and minimal patch recommendations.
- `fallstack/docs/maintainer-triage-brief.md`: prioritized engineering handoff with fast reproductions, acceptance criteria, exclusions, and ownership routing.
- `fallstack/docs/server-persistence-experiment.md`: real route + Redis concurrency/fault-injection evidence and application-owned persistence findings.
- `fallstack/docs/submission-evidence-audit.md`: requirement coverage, primary claims, exclusions, and completion blockers.
- `fallstack/docs/feedback-form-submission.md`: current paste-ready Google Form answers plus a non-form appendix index.
- `fallstack/docs/current-release-macos-pass.md`: current 0.13.8 package/CLI/harness recheck, Safari bridge reproduction, and narrowed host limits.
- `fallstack/docs/feedback-award-execplan.md`: execution and stop-condition record for the 2026-07-14 follow-up pass.
- `fallstack/docs/playtest-evidence/`: real upload/read-back and browser-host evidence.

## Completed evidence passes

### Devvit test harness

- `@devvit/test@0.13.7` attempted an undocumented/silent Redis source download and remained at 0% for more than three minutes.
- Installing with a system Redis workaround introduced 2 high and 2 moderate npm audit findings through `redis-memory-server@0.14.1`, with no published fix.
- The public harness configuration could not hydrate `context.postId` for the real Fallstack Hono route, including attempts through the documented headers fixture.
- Experimental dependencies were removed; the application returned to 0 audit findings.

### Real playtest upload

- `devvit playtest` built and installed v0.0.14.4 on `r/fallstack_dev`.
- `devvit list installs fallstack_dev` and `devvit view fallstack@0.0.14.4 --json` independently confirmed the installed version and successful remote build.
- Fresh and existing-profile automated Chrome sessions were blocked by Reddit network security before the subreddit/iframe loaded. This is host/access evidence, not currently framed as a Devvit application bug.

### CLI and documentation diagnostics

- Structural config errors are generally good: unknown fields and malformed internal endpoints fail before upload with exact schema paths.
- A missing server entry under custom `--config` triggers a hard-coded 10-second artifact poll and then tells the user to edit `devvit.json` rather than the named custom config; the observed full command took about 22.6 seconds including startup/build.
- JSON log mode emits no connection, historical-completion, empty-result, or heartbeat record.
- Current configuration docs recommend nonexistent `devvit build`; CLI 0.13.7 returns `Command build not found`.
- Current configuration docs say app names are limited to 16 characters; the live schema and current changelog say 20.

### Current first-party template audit

- Audited clean clones of `reddit/devvit-template-react` at `bee528c76b388978cd3c24ca9e6af3402c6116e6` and `reddit/devvit-template-phaser` at `23e3eeeae3141216fb211ea64b34f4884167438f`.
- Both installed, type-checked, linted, and built successfully after substituting a local diagnostic app name.
- Both fresh installs reported 1 high and 4 low vulnerabilities through `devvit@0.13.7 > @devvit/cli > inquirer > external-editor > tmp@0.0.33`.
- Adding `overrides.tmp = 0.2.7` to the Phaser template and reinstalling produced 0 vulnerabilities.
- Recorded current golden-path drift: quickstart Express versus template Hono; deprecated/no-op `inline` still in both templates and the Vite guide; template READMEs overstate what `npm run type-check` executes.
- Recorded the first-party Phaser build baseline: 1,380,869-byte `game.js`, 10,960,672-byte source map, about 21 MB total `dist`; build passed without a size warning.

### Public-source root-cause and patch audit

- Pinned `reddit/devvit` public source at `075019a41285ddf266bedf52bc7878763f59aecc` and `reddit/devvit-docs` at `c8bb880f5af14e8dde58e9a010b01cbdb28ad179`.
- Keyword searches of the public `reddit/devvit` issue tracker found no direct open/closed duplicate for the primary test-harness dependency/context, nonexistent `devvit build`, app-name limit, or JSON log lifecycle findings. This is a duplicate-screening result, not proof of uniqueness.
- Confirmed the CLI audit path originates at `packages/cli/package.json` pinning `inquirer@9.1.4`; forcing 9.3.8 installed at 0 vulnerabilities and ran the CLI version command.
- Confirmed `packages/test/package.json` pins `redis-memory-server@0.14.1`; forcing 0.17.0 installed at 0 vulnerabilities and passed a real harness Redis test.
- Confirmed the post-context gap is structural: `DevvitTestConfig` lacks request-context fields and `reqCtx = Context(headers)` runs before test code can mutate the headers fixture.
- Confirmed missing-entry polling constants and hard-coded `devvit.json` error text in `packages/build-pack/src/esbuild/ESBuildPack.ts`.
- Confirmed JSON logs intentionally suppress the human connected/complete banners and only serialize log/error/event messages; keepalives are hidden by default.
- Mapped every docs inconsistency to current public docs source files for a minimal maintainer patch set.

### Local real-route and Redis integration pass

- Ephemerally installed the patched first-party harness path and issued 101 requests through Fallstack's actual Hono routes in 7 tests.
- Verified stale-seed rejection, sequential and 20-way duplicate idempotency, bucket/daily caps under concurrency, authenticated identity isolation, clear caps, summit uniqueness, and final persisted totals.
- Positive platform evidence: once post context was supplied manually, isolated Redis and fault injection were effective and found real application problems.
- Fixed Fallstack catch blocks incorrectly returning HTTP 400 for internal server/Redis exceptions; they now return 500.
- Verified an open Fallstack persistence risk: the NX event marker survives a later write failure, so retry is treated as duplicate while the aggregate contribution is missing and a cap increment may be partial. Do not claim persistence hardening complete until this has a recoverable transaction/state-machine design and hosted playtest coverage.

### Submission synthesis pass

- Audited all exact form questions against current evidence and created `submission-evidence-audit.md`.
- Selected evidence-backed 3/5 ratings for developer experience and documentation.
- Selected a neutral 3/5 support rating with an explicit low-confidence/no-first-hand-interaction disclosure; do not strengthen this without a real support exchange.
- Created `feedback-form-submission.md` as the paste-ready candidate, keeping the long-form draft and technical reports as the evidence appendix.
- Excluded/muted environment-owned, browser-owned, intentional-tooling, and Fallstack-owned observations from Devvit criticism.

### Hosted retry and Phaser packaging pass

- Retried the playtest URL with the VM's existing Chrome profile through agent-browser. The profile was logged out; both modern and old Reddit returned server-side 403 responses before any Devvit iframe request. Preserved screenshots and kept this excluded from Devvit criticism.
- Reconfirmed CLI authentication and the installed Fallstack v0.0.14.4 build. The CLI exposes no browser-session handoff, post ID, request replay, or upload dry-run command.
- Audited the exact `@devvit/start@0.13.7` build defaults and `@devvit/cli@0.13.7` asset-enumeration path.
- Invoked the uploader's own `queryAssets()` function against Fallstack's successful build: it selected all 12 client files, including all three linked source maps.
- Measured 1,826,262 raw runtime bytes and 12,571,300 raw map bytes; maps were 87.3% of selected raw client bytes. Kept this framed as upload/build observability, not evidence maps delay normal runtime loading.
- Added `phaser-packaging-observability-pass.md` and strengthened the form's game-tooling recommendation with exact evidence.

### Headed system Chrome host pass

- Confirmed both Chrome for Testing 150.0.7871.115 and installed system Google Chrome 150.0.7871.100 are available.
- Installed Xvfb to provide the missing display server, then launched `/usr/bin/google-chrome` in headed mode with the VM's existing Chrome profile.
- Captured a normal `Chrome/150.0.0.0` user agent without `HeadlessChrome`; Reddit still returned HTTP 403 before any Devvit iframe or Fallstack request.
- Confirmed the reused Chrome profile is not authenticated to Reddit. Devvit CLI authentication remains separate and exposes no browser-session handoff.
- Preserved the screenshot and concise network facts in `docs/playtest-evidence/2026-07-12-headed-system-chrome/`.
- At that point, actual host QA required interactive login; installing a different Chrome binary was no longer a plausible fix. The later authenticated pass below closed this blocker without extracting credentials.

### Authenticated host and cold/warm performance passes

- The user logged into Reddit through the temporary SSH-tunneled noVNC desktop; authentication persisted only in the dedicated local QA Chrome profile.
- Real Reddit rendered Fallstack's inline post and expanded Mobile/Desktop game. The v0.0.14.4 pass captured screenshots, transition video, console state, warm timings, resource sizes, and safe hosted API probes.
- Hosted baseline/final state remained 46 falls, 0 clears, 0 summits. The account was already contribution-capped; an exact retry was recognized as duplicate; stale fall/clear/summit requests returned 409; impossible summit geometry returned 400.
- The live v0.0.14.4 snapshot exposed an application-owned integrity bug: inline copy hard-coded 37/14 while expanded state showed 46. The research branch now loads `/api/init-game` in the inline entrypoint and has two focused copy tests.
- During a later cache pass, independent CLI read-back showed a separate concurrent v0.0.15 upload at `2026-07-12T20:26:23.656Z`. The research worktree remained clean and did not upload; cross-version UI differences were excluded from cache conclusions.
- Across three runs on the same installed v0.0.15 and VM, expanded FCP ranged from 392 to 4,164 ms cold (3,292 ms median) and 400 to 412 ms warm (412 ms median). The identical `game.js` transfer ranged from 90.5 to 2,222.6 ms cold versus a 46.1 ms warm median; initial API state completed at a 4,267.5 ms cold median versus 1,003.3 ms warm.
- Source maps did not appear in execution Resource Timing, preserving the distinction between upload volume and normal runtime cost.
- Evidence: `docs/playtest-evidence/2026-07-12-authenticated-host/report.md` and `docs/host-performance-pass.md`.
- Chrome and Xvfb were stopped after both passes. No VNC, noVNC, or CDP listener remains; the persistent profile must never be committed or inspected for credential values.

### Logged-out host boundary

- Launched the same system Chrome in incognito mode with the dedicated QA profile, without reading or copying authentication state.
- Reddit rendered its network-security block before the subreddit or any Devvit iframe loaded. This reproduces the logged-out boundary while the same VM/browser family succeeds authenticated.
- Real `loid` host QA remains unavailable from this VM. Classify this as Reddit access/anti-abuse behavior, not a Devvit or Fallstack defect.
- Evidence: `docs/logged-out-host-pass.md` and `docs/playtest-evidence/2026-07-12-authenticated-host/screenshots/v15-incognito-host.png`.
- Chrome and Xvfb were stopped; no listener remained on ports 5900, 6080, or 9222.

### Real duplicate-tab hosted race

- Opened two authenticated subreddit tabs and two independent expanded `game.html` targets on installed v0.0.15.
- Both `/api/init-game` calls returned the same authenticated username, seed, and 46/0/0 snapshot.
- Submitted the same new valid fall attempt concurrently through both Devvit client bridges. One response reached the existing per-zone cap; the other recognized the attempt as duplicate.
- Both frames still read 46/0/0 afterward. This verifies cross-tab identity and shared Redis marker behavior without a synthetic public increment.
- Evidence: `docs/hosted-duplicate-tab-pass.md`.
- Chrome and Xvfb were stopped; no listener remained on ports 5900, 6080, or 9222.

### Hosted request/log correlation pass

- Inspected `devvit logs --help`; there is no request ID, trace filter, route filter, or client/server correlation option.
- `--since=30m --json --show-timestamps --log-runtime` emitted no automatic record for recent successful hosted calls during a ten-second observation window. Fallstack did not log each request, so do not claim dropped logs.
- A fresh authenticated `/api/init-game` response exposed ordinary content/security and Reddit infrastructure header names but no request, trace, correlation, ray, server-timing, or opaque request-ID header.
- Internal infrastructure header values were deliberately not recorded.
- Recommendation: an opaque response ID propagated into server context, structured runtime/error logs, installed-version metadata, and a CLI filter.
- Evidence: `docs/host-log-correlation-pass.md`.
- Chrome, Xvfb, and orphaned diagnostic log processes were stopped; no listener remained on 5678, 5900, 6080, or 9222.

### Maintainer usability pass

- Created `maintainer-triage-brief.md` as the short entrypoint to the evidence package.
- Ranked seven verified findings by developer impact and candidate patch scope.
- Added fast reproductions, upstream file locations, explicit acceptance criteria, evidence limitations, exclusions, and likely owning teams.
- Preserved targeted-versus-full-upstream validation language and kept unmeasured host behavior out of claims.
- Kept the deeper patch map and experiment reports authoritative; the brief links rather than duplicating unsupported detail.

### Current-release macOS and Safari pass

- Rechecked the package registry and official docs on 2026-07-14. Stable 0.13.7 and 0.13.8 are published while the official changelog still ends at 0.13.6.
- Reproduced the starter/CLI audit path on both pinned current templates under macOS arm64 and in a separate clean `devvit@0.13.8` project. The Inquirer 9.3.8 candidate audited at zero and ran CLI 0.13.8.
- Reproduced the current `@devvit/test@0.13.8` 2-high/2-moderate dependency path and request-context gap. A clean Mac install downloaded source and compiled Redis during `npm install`, refining the Ubuntu-only silent-stall claim into an undocumented native-setup finding.
- Forced `redis-memory-server@0.17.0` under the current test package; audit returned zero and focused Redis/context tests passed.
- Reconfirmed on CLI 0.13.8 that `devvit build` is absent, JSON logs expose no readiness/empty-history record, and upload has no validate/dry-run/analyze mode.
- Loaded the installed v0.0.20.2 app in authenticated Safari without extracting session values. Inline, expanded, responsive mobile-host controls, and board `R40` rendered. No hosted state was written.
- Reproduced a Safari-only playtest bridge failure: the HTTPS Reddit page blocked Devvit's `ws://localhost:5678` request. The CLI listener was verified open, but no client connected. App execution itself remained healthy.
- Mac Private Browsing reached Reddit, narrowing the VM network failure, but the private subreddit prevented logged-out app/`loid` testing. No access control was changed.
- Skipped upload, response-loss, uncapped-write, clear/summit, and public-support actions because they would change remote/public state or require explicit user confirmation without materially improving the current general claims.
- Evidence: `docs/current-release-macos-pass.md`.

## Last full validation

Run from `fallstack/` after the 2026-07-12 CLI pass:

- `npm audit --audit-level=high` — passed, 0 vulnerabilities.
- `npm run type-check` — passed.
- `npm run lint` — passed.
- `npm test` — passed, 44/44 tests.
- `npm run build` — passed; existing Phaser chunk-over-500-kB warning remains.
- `git diff --check` — passed.

Never report a later validation as passing without rerunning it in this worktree.

After the authenticated-host pass and live-snapshot splash fix, the full validation passed again on 2026-07-12: audit 0; type-check; lint; 46/46 tests; build; and `git diff --check`. The build retained the existing Devvit plugin-timing and generic chunk-size advisories.

After the performance, logged-out, duplicate-tab, request-correlation, and package-consistency passes, the same full validation passed again: audit 0; type-check; lint; 46/46 tests; build; and `git diff --check`. A direct form audit found all 10 non-empty lines from `feedbackquestions.md` in the paste-ready submission, and a local-reference audit found every backticked Markdown evidence file referenced by the canonical submission/audit/triage documents. The build retained only the existing generic chunk-size advisory in this run.

The dedicated worktree was initialized with `npm ci` on 2026-07-12 (568 packages, 0 vulnerabilities). After the hosted-retry and Phaser-packaging pass, the full validation above was rerun in this worktree and passed again: audit 0, type-check, lint, 44/44 tests, build, and `git diff --check`. The build retained its existing chunk-size advisory; the separate measured packaging run also captured the Devvit plugin-timing advisory.

After the 2026-07-14 current-release Mac pass, current `master` passed `npm audit --audit-level=high`, `npm run type-check`, `npm run lint`, `npm test` (110/110), and `npm run build`. The build retained only the existing generic chunk-size advisory. The documentation gate also passed `git diff --check`, exact form-heading comparison, and local evidence-reference resolution.

## Highest-value next work

1. Before any upload, reconcile current `master` with installed product-code commit `6b0b7d0`; do not silently replace v0.0.20.2 merely to run a diagnostic.
2. Compare the Safari playtest bridge in an authenticated supported Chromium/Firefox profile or obtain an official browser-support statement. Do not generalize the current Safari-only result.
3. Exercise response-loss and genuinely earned clear/summit flows only with ethically clean state. Logged-out `loid` needs a public/otherwise accessible test installation; do not change subreddit visibility or bypass access controls implicitly.
4. Repeat performance evidence on physical mobile hardware and broader networks; desktop responsive mode and the current three-run VM sample are not platform percentiles.
5. Trigger a controlled non-destructive server exception only after the installed/source relationship is resolved, then evaluate request correlation.
6. Prepare a concise first-hand support question if the user wants it, but obtain confirmation immediately before public submission and keep the support score neutral until a real exchange exists.

## Award-readiness audit

- Current public Feedback Award signals were rechecked on 2026-07-14: detailed, candid, actionable, constructive, specific, and thoughtful feedback; concrete feature/resource/bug/process commentary.
- `docs/award-criteria-audit.md` maps each signal to direct package evidence and records exclusions, security hygiene, and residual uncertainty.
- The paste-ready form is now judged award-ready at its stated evidence scope. Remaining physical-mobile, uncapped-identity, `loid`, response-loss, and firsthand-support gaps are disclosed and do not support stronger current claims.
- Do not continue experimenting merely for volume. Resume only if new evidence can materially change a form claim or maintainer recommendation without misleading public state, credential risk, access-control bypass, or overwriting installed v0.0.20.2 from a different local source state.

## Operating rules

- Preserve unrelated user changes and do not merge worktrees implicitly.
- Keep Devvit-owned, Reddit-host-owned, Phaser/Vite-owned, environment-owned, and Fallstack-owned issues explicitly separated.
- Routine successes belong in pass reports; only reproducible failures/gaps belong in `devvit-feedback-log.md`.
- Each primary submission claim needs authoritative evidence, developer impact, workaround status, and a concrete recommendation.
- Treat the award-readiness audit as the completion gate. Residual external-only gaps remain visible, but do not keep the goal artificially active when every submitted claim is directly supported and the public award signals are covered.

## Worktree transfer record

On 2026-07-12, the feedback files were selectively stashed from `master`, a new `feedback-reward-research` worktree was created at the canonical path, and the stash was applied there. The transfer included seven pre-existing feedback artifacts (288 added lines plus one 80,227-byte PNG and the modified platform log). It excluded `.agents/` and `fallstack/docs/design-redesign/`. The temporary transfer stash should be dropped only after source/destination verification.
