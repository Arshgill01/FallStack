# Feedback Reward Work Log

This is the durable handoff record for the Devvit feedback-reward research. Read this file and `feedback-evidence-matrix.md` after any context compaction before continuing experiments.

## Workspace

- Canonical worktree: `/home/arshdeepsingh/work/github/FallStack-feedback-reward`
- Branch: `feedback-reward-research`
- Branch point: `27fd62692aa1bd46a98a814674e60d9134a89ac3`
- Created: 2026-07-12 UTC
- Original worktree: `/home/arshdeepsingh/work/github/FallStack`
- The original worktree's `.agents/` and `fallstack/docs/design-redesign/` changes are unrelated and were deliberately not transferred.

All further feedback-reward research, logs, drafts, and evidence should be created in the canonical worktree above. Do not continue this work in the original worktree.

## Objective

Build an award-worthy, evidence-driven feedback submission about Devvit, Devvit Web, Reddit host behavior, developer tools, and Phaser-game development. Do not optimize only for the form prompts. Run real experiments, distinguish Devvit-owned issues from application/environment problems, preserve reproductions and artifacts, recommend concrete fixes, and continuously improve the form answers as evidence accumulates.

The exact form prompts are in the repository-root `feedbackquestions.md`.

## Canonical artifacts

- `fallstack/docs/devvit-feedback-log.md`: reproduced platform/tooling findings with environment, commands, expected/actual behavior, severity, workaround, and recommendation.
- `fallstack/docs/feedback-evidence-matrix.md`: claim-quality gate, ownership classification, and remaining evidence gaps.
- `fallstack/docs/feedback-form-draft.md`: evolving answers to the exact form questions; provisional claims must remain labeled.
- `fallstack/docs/cli-diagnostics-pass.md`: controlled CLI/config/logging experiments.
- `fallstack/docs/template-audit-pass.md`: pinned first-party React/Phaser install, audit, build, and contract evidence.
- `fallstack/docs/maintainer-patch-map.md`: upstream source root causes, verified dependency bumps, exact files, and minimal patch recommendations.
- `fallstack/docs/server-persistence-experiment.md`: real route + Redis concurrency/fault-injection evidence and application-owned persistence findings.
- `fallstack/docs/submission-evidence-audit.md`: requirement coverage, primary claims, exclusions, and completion blockers.
- `fallstack/docs/feedback-form-submission.md`: current paste-ready Google Form answers plus a non-form appendix index.
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

## Last full validation

Run from `fallstack/` after the 2026-07-12 CLI pass:

- `npm audit --audit-level=high` — passed, 0 vulnerabilities.
- `npm run type-check` — passed.
- `npm run lint` — passed.
- `npm test` — passed, 44/44 tests.
- `npm run build` — passed; existing Phaser chunk-over-500-kB warning remains.
- `git diff --check` — passed.

Never report a later validation as passing without rerunning it in this worktree.

The dedicated worktree was initialized with `npm ci` on 2026-07-12 (568 packages, 0 vulnerabilities). After the submission synthesis pass, the full validation above was rerun in this worktree and passed again: audit 0, type-check, lint, 44/44 tests, build, and `git diff --check`. The build retained its existing Devvit plugin-timing and chunk-size advisories.

## Highest-value next work

1. Use a logged-in human Reddit browser or documented safe developer-token browser setup to inspect the actual inline post and expanded iframe.
2. Exercise real `/api` fall, clear, summit, duplicate-event, stale-seed, anonymous-user, and contribution-cap flows against playtest Redis.
3. Capture inline-to-expanded timing, first canvas paint, client-log forwarding, mobile host layout, and iframe console/network behavior.
4. Trigger a controlled server exception through the real host and evaluate trace/request correlation in playtest and historical logs.
5. Gather first-hand community support evidence: question, channel, timestamps, response accuracy, resolution, and follow-up. Do not invent a support rating.
6. Revisit the paste-ready submission only when new host, Redis, or support evidence changes a claim; preserve the current evidence cutoff and confidence labels otherwise.

## Operating rules

- Preserve unrelated user changes and do not merge worktrees implicitly.
- Keep Devvit-owned, Reddit-host-owned, Phaser/Vite-owned, environment-owned, and Fallstack-owned issues explicitly separated.
- Routine successes belong in pass reports; only reproducible failures/gaps belong in `devvit-feedback-log.md`.
- Each primary submission claim needs authoritative evidence, developer impact, workaround status, and a concrete recommendation.
- Keep the broader goal active until the remaining host, Redis, support, and final evidence-audit work is genuinely complete.

## Worktree transfer record

On 2026-07-12, the feedback files were selectively stashed from `master`, a new `feedback-reward-research` worktree was created at the canonical path, and the stash was applied there. The transfer included seven pre-existing feedback artifacts (288 added lines plus one 80,227-byte PNG and the modified platform log). It excluded `.agents/` and `fallstack/docs/design-redesign/`. The temporary transfer stash should be dropped only after source/destination verification.
