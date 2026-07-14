# Devvit Feedback Maintainer Triage Brief

Evidence cutoff: 2026-07-12
Tested release: Devvit 0.13.7

This is the shortest path through the Fallstack evidence package. It prioritizes reproduced, Devvit-owned improvements that are small enough to evaluate independently and valuable beyond one app.

## Executive summary

Devvit Web's architecture worked: a real Phaser + React + Hono app built, uploaded, installed, and used the intended client/server/Redis split. The largest opportunity is the confidence path around that architecture.

Three changes would remove the most friction:

1. make `@devvit/test` install cleanly and accept complete request-context fixtures;
2. make new templates pass a zero-high dependency gate and contract-test the golden-path documentation;
3. add a non-mutating validation/package report plus typed lifecycle records for automation.

These recommendations come from clean installs, pinned first-party sources/templates, actual CLI commands, installed-version read-back, authenticated Reddit host QA, same-version cold/warm iframe timing, a real two-tab hosted Redis race, hosted validation probes, 101 requests through Fallstack's real Hono routes, concurrency and fault injection, and exact upload-manifest enumeration.

## Recommended triage order

| Priority | Finding | Why it matters | Candidate scope | Verification already completed |
| --- | --- | --- | --- | --- |
| P0 | `@devvit/test` cannot configure post/comment/`loid` context | Stateful Web routes cannot be tested at the real request boundary | One public config field plus merge-before-`Context()` tests | Root cause pinned; manual context enabled 101 real-route requests |
| P0 | Test harness pins vulnerable Redis-memory dependency | Common zero-high CI gates reject the first-party test package | `redis-memory-server` 0.14.1 → 0.17.0 in test/Redis packages | Override audited at zero and passed a real Redis harness test |
| P0 | Fresh React/Phaser starters inherit a high CLI finding | New projects fail security gates before app code exists | CLI Inquirer 9.1.4 → 9.3.8 | Override audited at zero and CLI version command passed |
| P0 | Golden-path docs/templates contradict executable contracts | New users receive wrong commands, limits, stack, and deprecated config | Correct six source locations; add CI contracts | Docs/schema/changelog/templates/commands compared at pinned revisions |
| P1 | No non-mutating `validate`/package manifest | Developers learn config/package problems only inside mutating upload flows | CLI validation command or `upload --dry-run` | Controlled config failures and exact uploader enumeration completed |
| P1 | JSON logs omit lifecycle state | Automation cannot distinguish connected-empty from stalled | Optional typed status JSONL | Human/JSON behavior reproduced and source branch confirmed |
| P1 | Browser responses cannot be joined to runtime logs | Intermittent hosted failures lack a copyable platform trace key | Opaque response request ID + structured log propagation/filter | CLI flags, recent runtime stream, and authenticated response headers inspected |
| P1 | Phaser builds lack actionable Reddit-host targets | Generic Vite warnings cannot answer host/mobile/review readiness | Guidance plus manifest/runtime/map split and reference metrics | Three host runs: 0.392–4.164 s cold vs 0.400–0.412 s warm FCP |

## Fast reproductions

### 1. Starter dependency gate

From clean current React and Phaser template clones:

```sh
npm install
npm audit --json
npm ls devvit @devvit/cli inquirer external-editor tmp --all
```

Observed in both templates: 1 high + 4 low findings on:

```text
devvit@0.13.7
└─ @devvit/cli@0.13.7
   └─ inquirer@9.1.4
      └─ external-editor@3.1.0
         └─ tmp@0.0.33
```

Candidate check: force `inquirer@9.3.8`, reinstall, audit, and run `npx devvit --version`. Those targeted checks passed at zero findings. Full CLI prompt/CI coverage is still required upstream.

### 2. Test-package dependency gate

```sh
REDISMS_DISABLE_POSTINSTALL=1 npm install --save-dev @devvit/test@0.13.7 vitest@4.1.10
npm audit --json
npm ls redis-memory-server tar uuid --all
```

Observed: 2 high + 2 moderate findings through `redis-memory-server@0.14.1`, plus an implicit Redis download that remained silently at 0% for more than three minutes in a clean uncached attempt.

Candidate check: force `redis-memory-server@0.17.0`, configure the system Redis binary, then run a `createDevvitTest()` Redis set/get. The install audited at zero and the real Redis test passed. This does not replace the full upstream suite or download-platform coverage.

### 3. Request-context gap

Relevant source: `packages/test/src/server/vitest/devvitTest.ts`.

The runner creates `headers`, snapshots them into `Context(headers)`, then exposes the mutable headers fixture. `DevvitTestConfig` has no raw headers or post/comment/logged-out fields. Mutating the fixture or adding `devvit-post` to a Hono request does not rebuild `@devvit/web/server` context; Fallstack's real route sees `postId` as undefined.

Acceptance criteria:

- `createDevvitTest({ headers: { [Header.Post]: 't3_...' } })` hydrates exported server context;
- post, comment, authenticated, and logged-out/`loid` fixtures are covered;
- a documented Hono route example reaches Redis through the actual request boundary;
- existing fixture behavior remains compatible or its observational semantics are explicit.

### 4. Documentation contracts

Run or compare these current first-party contracts:

| Contract | Current mismatch |
| --- | --- |
| Configuration prose vs schema/changelog | App-name maximum 16 vs 20 |
| Configuration command vs CLI | `devvit build` is documented but does not exist |
| Quickstart/template library vs current templates | Express vs Hono |
| Changelog vs Vite guide/templates | `inline` deprecated/no-op but still emitted |
| Template README vs package script | Type-check claims lint/prettier but runs only `tsc --build` |
| Test guide vs harness installation/context | Redis binary/download and post-scoped Web route path omitted |

Acceptance criteria: runnable docs commands execute in CI; duplicated schema constraints are generated or checked; framework claims match dependencies; active examples contain no current no-op/deprecated properties; starter validation descriptions match scripts.

### 5. Package observability

`packages/start/src/vite/index.ts` sets `sourcemap: true` and `reportCompressedSize: false`. `packages/cli/src/util/AssetUploader.ts` selects every file below the client directory.

Fallstack's successful build and the CLI's exported `queryAssets()` path selected:

```text
Runtime:     9 files   1,826,262 raw bytes   ~517,826 gzip-estimated
Source maps: 3 files  12,571,300 raw bytes   ~2,106,970 gzip-estimated
Total:      12 files  14,397,562 raw bytes
```

Maps were 87.3% of raw client bytes. This does not mean maps are fetched during normal gameplay. It means the default build creates them, the normal summary hides their size, and the uploader selects them.

Acceptance criteria: a local command reports selected paths, entrypoint/runtime/map roles, raw and labeled compression estimates, aggregate entrypoint sizes, and platform-owned inline/expanded/mobile targets before any remote mutation.

Authenticated host evidence strengthens the need for those targets. Across three same-version v0.0.15 runs on one VM, expanded FCP ranged from 392 to 4,164 ms cold (3,292 ms median) and 400 to 412 ms warm (412 ms median). The identical 371,879-byte encoded `game.js` ranged from 90.5 to 2,222.6 ms cold versus a 46.1 ms warm median. Initial API state completed at a 4,267.5 ms cold median versus 1,003.3 ms warm. This is not a platform percentile, but the cold variability demonstrates why raw bundle size and a generic Vite warning are insufficient guidance.

### 6. Machine-readable log lifecycle

```sh
devvit logs fallstack_dev fallstack --since=1h --json --show-timestamps
devvit logs fallstack_dev fallstack --since=1h --json --verbose
```

With no app events, JSON modes remained completely silent until interrupted. Human mode printed a connected banner. Pinned source confirms JSON suppresses connected/completion dividers and serializes only log/error/event payloads; keepalives are hidden by default.

Acceptance criteria: an opt-in discriminated JSONL envelope can report `connected`, keepalive/reconnect, completion, and terminal error without breaking existing log consumers. If the backend cannot distinguish history drain from live tail, document that boundary rather than naming an unsupported event.

### 7. Request correlation

Recent authenticated hosted requests produced no automatic JSON runtime record, and a fresh `/api/init-game` response exposed no request/trace/correlation identifier. Fallstack itself did not log every request, so this is not a missing-log claim; it is the absence of a platform join key.

Acceptance criteria: every Devvit Web API response may expose an opaque request ID; the same ID is available in server context and structured runtime/error logs; CLI filtering can retrieve that record with installed version, subreddit, route, status, runtime, and duration without user or infrastructure identifiers.

## Evidence integrity

The package deliberately excludes these from Devvit criticism:

- earlier Reddit network-security 403s before authenticated interactive login;
- the reproduced incognito/logged-out Reddit security block, which occurs before any Devvit iframe;
- Chrome/Xvfb/browser setup;
- Fallstack's fixed 400-versus-500 error classification;
- Fallstack's still-open interrupted-idempotency design risk;
- local npm configuration warnings;
- generic Phaser/Vite chunk size as a claimed platform defect;
- support response quality, because no firsthand support exchange occurred.

Candidate dependency bumps have targeted validation only. They are not represented as passing Reddit's complete upstream suites. Authenticated host transfer, first paint, responsive Mobile/Desktop layout, and safe hosted validation are now measured; logged-out identity, physical-mobile behavior, a fresh uncapped hosted write/race, and interrupted-response recovery remain open.

## Detailed evidence index

| Need | File |
| --- | --- |
| Full failure records and reproductions | `devvit-feedback-log.md` |
| Exact upstream files and patch shapes | `maintainer-patch-map.md` |
| Clean current template audits | `template-audit-pass.md` |
| CLI/config/logging experiments | `cli-diagnostics-pass.md` |
| Test-harness install and source evidence | `feedback-evidence-matrix.md` and `maintainer-patch-map.md` |
| 101 real Hono route requests and Redis fault injection | `server-persistence-experiment.md` |
| Build/upload manifest and Phaser size split | `phaser-packaging-observability-pass.md` |
| Authenticated cold/warm Reddit timing | `host-performance-pass.md` |
| Inline/expanded screenshots, video, and safe hosted persistence probes | `playtest-evidence/2026-07-12-authenticated-host/report.md` |
| Logged-out boundary and `loid` limitation | `logged-out-host-pass.md` |
| Real two-tab identity/idempotency race | `hosted-duplicate-tab-pass.md` |
| Browser/runtime request-correlation audit | `host-log-correlation-pass.md` |
| Claim-level readiness and exclusions | `submission-evidence-audit.md` |
| Paste-ready survey answers | `feedback-form-submission.md` |
| Published award-signal mapping and readiness judgment | `award-criteria-audit.md` |

## Suggested ownership

| Area | Likely owner |
| --- | --- |
| `@devvit/test`, Redis binary setup, request fixtures | Test/runtime developer experience |
| CLI dependency gate, validation, logs JSONL | Devvit CLI |
| Vite package manifest and map policy | Devvit Web tooling |
| Schema/docs/template contract CI | Documentation + template maintainers |
| Phaser/mobile/host budgets | Games + Devvit Web runtime/performance |

The full source-level patch discussion is in `maintainer-patch-map.md`; this brief is the triage entrypoint, not a replacement for the underlying evidence.
