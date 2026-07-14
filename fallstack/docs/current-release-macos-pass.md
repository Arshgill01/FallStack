# Devvit Current-Release macOS Pass

Date: 2026-07-14

This pass rechecked the remote Ubuntu evidence on macOS arm64 and against the current stable Devvit release. Fallstack was used only where a real installed, stateful Web app was needed; template, package, documentation, CLI, and test-harness findings were reproduced independently in disposable projects under `/tmp`.

## Environment and scope

- macOS 15.7.3, arm64
- Node v26.0.0, npm 11.12.1
- Fallstack project CLI: `@devvit/cli/0.13.7`
- current npm stable recheck: `devvit`, `@devvit/test`, and `@devvit/web` 0.13.8
- authenticated account and installed app version were read through supported CLI/browser surfaces; no credential value, signed iframe URL, cookie, or HAR was retained
- no app upload, playtest install, synthetic clear/summit, or direct Redis mutation was performed

The installed Fallstack playtest remained `v0.0.20.2`. Its product code was built from commit `6b0b7d0`; current `master` contains later local feedback fixes, so a new playtest would have changed the remote build and was deliberately not started.

## Results that generalized beyond the Ubuntu VM

### Current starters and current CLI still fail a zero-high audit gate

Clean clones of the current official templates were checked at:

- React: `bee528c76b388978cd3c24ca9e6af3402c6116e6`
- Phaser: `23e3eeeae3141216fb211ea64b34f4884167438f`

Both `npm install` runs completed, and both reported 5 findings: 1 high and 4 low. The shared path remained:

```text
devvit@0.13.7
└─ @devvit/cli@0.13.7
   └─ inquirer@9.1.4
      └─ external-editor@3.1.0
         └─ tmp@0.0.33
```

A separate clean `devvit@0.13.8` project reproduced the same five findings and dependency path. npm's automated recommendation was still `npm audit fix --force`, which would install the unrelated-looking semver-major `devvit@1.0.0`.

The candidate override remained effective on the current release: forcing `inquirer@9.3.8` under `devvit@0.13.8` installed with 0 findings, removed the legacy `external-editor/tmp` path, and `npx devvit --version` reported 0.13.8 on Darwin arm64. This is targeted compatibility evidence, not the upstream CLI suite.

### Current `@devvit/test` still has dependency and request-context gaps

A clean `@devvit/test@0.13.8` + Vitest 4.1.10 install resolved `redis-memory-server@0.14.1`, `tar@6.2.1`, and `uuid@8.3.2`. `npm audit --audit-level=high` reported 4 findings: 2 high and 2 moderate, with no fix in the published range.

The setup behavior differed from Ubuntu but exposed the same documentation problem. The clean Mac install downloaded Redis source and compiled `redis-server` with Xcode/Clang during `npm install`; the earlier uncached Ubuntu install remained silently at 0% for more than three minutes. The portable claim is therefore not “the installer always stalls.” It is that the official test package performs an implicit, potentially long native Redis setup without documenting the download, compilation/toolchain requirements, cache, system-binary option, or progress expectations.

The current 0.13.8 declaration still exposes only user, subreddit, settings, and internal app configuration. It has no post, comment, `loid`, or raw-header input. The implementation still constructs `Context(headers)` before the headers fixture is exposed. A focused test confirmed that adding `devvit-post` to the public fixture does not hydrate `context.postId`.

Forcing `redis-memory-server@0.17.0` under `@devvit/test@0.13.8` installed with 0 findings and passed both focused tests:

- a real `createDevvitTest()` Redis set/get;
- the context regression reproduction documenting the current missing-post behavior.

### The machine-readable CLI gap persists in 0.13.8

`npx devvit logs fallstack_dev fallstack --since=1m --json --show-timestamps --log-runtime` emitted no readiness, empty-history, or lifecycle record before interruption. Human mode printed its streaming banner. `npx devvit build --help` still returned `Command build not found`, and `upload --help` still exposed no validation, dry-run, or package-analysis mode.

The current 0.13.8 packages also retain the packaging behavior already traced on Ubuntu: the first-party Vite configuration enables source maps and disables compressed-size reporting, while the CLI uploader selects all files below the client directory.

## New current-release documentation finding

The npm registry published stable 0.13.7 on 2026-07-07 and stable 0.13.8 on 2026-07-13. On 2026-07-14, the official 0.13 changelog still ended at 0.13.6, dated 2026-06-29. The page warns that undocumented package features may be experimental, but these are stable package releases, not `next` builds.

This creates an upgrade-confidence gap: the documentation and FAQ direct developers toward the latest project-local CLI, but developers cannot determine from the official release notes what changed in the two newest stable versions, whether a migration is required, or which docs/templates correspond to them.

Recommended acceptance criterion: every stable registry release either receives a changelog entry before/with publication or is explicitly labeled as a no-developer-facing-change maintenance release, with automated registry-versus-changelog drift detection.

## Safari playtest compatibility finding

Authenticated Safari rendered the real inline post and expanded app, including the current shared board (`R40`) and the mobile control surface. This is positive host evidence; it is not physical-mobile proof.

The `?playtest=fallstack` page consistently reported that its insecure `ws://localhost:5678/` request was blocked from the HTTPS Reddit page. Current `@devvit/cli@0.13.8` source identifies port 5678 as `PlaytestServer`, the bidirectional bridge for client logs and reload messages. A read-only control made the result reproducible:

1. start `devvit logs fallstack_dev fallstack --connect`;
2. verify a Node process is listening on TCP 5678;
3. reload the authenticated Safari playtest URL;
4. observe Safari's mixed-content block and no client connection divider in the CLI.

The app and remote API still rendered; the observed impact is narrower: the documented client-log streaming/live-reload bridge did not connect in Safari. Chrome comparison was not submission-grade because the separate Mac Chrome profile was not authenticated to the private subreddit.

Recommended acceptance criterion: on every documented desktop browser, the playtest query connects to the local bridge without a mixed-content violation and streams a client connection/log event. If Safari is not supported for this feature, the CLI and playtest guide should say so and detect the incompatible page. A secure local bridge or documented fallback is preferable.

## Host gaps closed and left open

- The Ubuntu logged-out result was narrowed. Safari Private Browsing reached Reddit normally on this Mac, but `r/fallstack_dev` is private, so the app iframe was unavailable. Real `loid` behavior remains untested; this is an access/topology blocker, not a Devvit defect.
- The current authenticated host showed board `R40` with three additional ordinary First Gap contributions beyond the earlier controlled `R37 → R39` proof. No write was made in this pass.
- Response-loss, an uncapped hosted write, and an earned clear/summit were not forced. The current account/site state and installed-version mismatch made those experiments more likely to pollute community state than improve a general platform claim.
- Physical mobile remains open. Desktop Safari's responsive/mobile host mode is not a substitute.
- No public support question was posted. Submission would be third-party communication and still requires explicit confirmation; the support score remains neutral and low-confidence.

## Commands and checks

The disposable projects ran these checks:

```sh
npm install
npm audit --audit-level=high
npm ls devvit @devvit/cli inquirer external-editor tmp --all
npx devvit --version
npm ls @devvit/test redis-memory-server tar uuid --all
npx vitest run redis.test.ts context.test.ts
npx devvit build --help
npx devvit logs fallstack_dev fallstack --since=1m --json --show-timestamps --log-runtime
lsof -nP -iTCP:5678 -sTCP:LISTEN
```

Unpatched audit checks failed at the expected gates. Both targeted override projects audited at zero; the CLI version check and both focused harness tests passed. Temporary experiment projects contain no Fallstack source change and should not be committed.
