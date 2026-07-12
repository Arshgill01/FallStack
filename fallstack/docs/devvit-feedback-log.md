# Devvit Platform Feedback Log

Document only observed Devvit or tooling failures, rough edges, and reproducible gaps. Do not add routine successful playtest logs; keep those in commit messages or validation notes instead.

## 2026-07-12 19:00 UTC — Both current first-party Web templates install with a high-severity audit finding

- Environment: Ubuntu VM, Node v24.18.0, npm 11.18.0, clean clones of Reddit's current React and Phaser templates.
- Template revisions:
  - `reddit/devvit-template-react` at `bee528c76b388978cd3c24ca9e6af3402c6116e6`
  - `reddit/devvit-template-phaser` at `23e3eeeae3141216fb211ea64b34f4884167438f`
- Task attempted: follow the new-user dependency-install path, then audit the generated dependency graph.
- Commands: `npm install`, followed by `npm audit --json` and `npm ls tmp devvit @devvit/cli inquirer external-editor` in each template.
- Expected result: current first-party starter templates install without known high-severity findings, or document a pinned mitigation.
- Actual result: both clean installs reported 5 vulnerabilities (1 high, 4 low). The shared path was `devvit@0.13.7 > @devvit/cli@0.13.7 > inquirer@9.1.4 > external-editor@3.1.0 > tmp@0.0.33`. npm associated `tmp` with path-traversal advisory `GHSA-ph9p-34f9-6g65` and reported the available automated fix as the unrelated-looking semver-major `devvit@1.0.0`.
- Product impact: a new app begins with a red audit result before the developer changes any code. Teams with a zero-high policy cannot adopt the starter unchanged, and beginners may run `npm audit fix --force` against a platform CLI without understanding the major-version implication.
- Workaround verified in the Phaser template: add `"overrides": { "tmp": "0.2.7" }` and rerun `npm install`. npm changed the transitive package and returned `found 0 vulnerabilities`; type-check/lint/build had already passed on the same template. Fallstack independently uses the same override and audits cleanly.
- Severity: high-confidence starter/dependency maintenance issue. The vulnerable path is development CLI code, not bundled game runtime, which reduces end-user exposure but does not remove CI/supply-chain impact.
- Recommendation: update `packages/cli/package.json` from `inquirer@9.1.4` to at least `9.3.8` or add the safe transitive override to `devvit`; gate every released starter revision with a clean install plus `npm audit --audit-level=high`.
- Patch validation: a disposable `devvit@0.13.7` project with `inquirer@9.3.8` forced through npm overrides installed with 0 vulnerabilities, removed the legacy `external-editor/tmp` path, and successfully ran `npx devvit --version`. This is targeted compatibility evidence, not a substitute for Reddit's full CLI test suite.
- Notes: plain `npm audit fix` on this npm/Linux environment failed with `EBADPLATFORM` for optional `@esbuild/aix-ppc64@0.28.1`. That secondary failure appears npm/esbuild-owned and is not being presented as a Devvit defect; the explicit `tmp` override was the reliable mitigation.

## 2026-07-12 19:04 UTC — Current quickstart, changelog, Vite guide, and templates disagree on shipped behavior

- Sources inspected:
  - current [App quickstart](https://developers.reddit.com/docs/quickstart)
  - current [Vite plugin guide](https://developers.reddit.com/docs/guides/tools/vite)
  - current [0.13 changelog](https://developers.reddit.com/docs/changelog)
  - the pinned React and Phaser template revisions above
- Expected result: the recommended quickstart and current first-party templates describe the same stack, configuration, and validation commands.
- Actual result:
  - The quickstart architecture section says the React example uses Express; the current React template uses Hono and has no Express dependency.
  - The 0.13 changelog says `post.entrypoints.*.inline` is deprecated, has no effect, and is always implied. Both current templates still emit `"inline": true`, and the current Vite plugin guide includes it in the canonical configuration example.
  - Both template READMEs say `npm run type-check` “Type checks, lints, and prettifies your app,” but the script is only `tsc --build`; lint is separate and no check/prettify step runs.
- Severity: documentation/template consistency issue. None prevents a build, but each weakens trust in the golden path and can make developers misunderstand what their validation actually covered.
- Workaround: inspect the generated `package.json` and current source rather than relying on the README/quickstart prose; omit the no-op `inline` field in new configurations.
- Recommendation: run docs/template contract tests in CI: verify mentioned frameworks against dependencies/imports, execute every documented npm command, and validate configuration examples against deprecations for the released SDK version.

## 2026-07-12 19:04 UTC — Phaser starter establishes a large bundle without a Devvit performance budget

- Environment: current first-party Phaser template at the pinned revision, `phaser@4.2.0`, `vite@8.1.3`, Devvit Vite plugin 0.13.7.
- Commands: fresh `npm install`, `npm run type-check`, `npm run lint`, and `npm run build`.
- Result: all commands passed. The production output included `dist/client/game.js` at 1,380,869 bytes and its source map at 10,960,672 bytes; the full `dist` directory was about 21 MB. The build emitted no bundle-size warning in this template.
- Assessment: not a template failure. This is useful baseline evidence that engine-based games naturally start above generic 500 kB guidance, reinforcing the existing documentation gap around actual Reddit iframe transfer/cache/startup budgets.
- Developer impact: developers cannot tell whether a successful first-party baseline is comfortably within Reddit mobile constraints or already requires code splitting/load measurement.
- Recommendation: publish measured budgets and reference metrics for first-party game templates: compressed transfer bytes, cache behavior, inline and expanded startup, first canvas paint, memory on supported mobile clients, source-map upload treatment, and thresholds that affect review or user experience.

## 2026-07-12 19:02 UTC — Current configuration docs recommend a nonexistent CLI command

- Environment: official Devvit 0.13 configuration page and `@devvit/cli@0.13.7`.
- Documentation inspected: [Configure your app](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration), “Best practices,” item 6.
- Documented instruction: `Validate your config with devvit build before deployment.`
- Command: `devvit build --help`
- Expected result: the documented validation command exists, or the guide points to a supported non-uploading validation command.
- Actual result: `Error: Command build not found.` The current CLI command list contains `playtest`, `upload`, and `publish`, but no `build` or dedicated `validate` command.
- Severity: direct documentation error. It sends developers looking for a safe pre-deployment validation path to a command that cannot run.
- Workaround: run the project-native build (`vite build` here) for artifacts, then use `devvit upload` or `devvit playtest` for Devvit schema/file validation. Those commands can mutate remote app/playtest state, so they are not equivalent to a local validator.
- Recommendation: replace the instruction with the current supported command. Prefer adding `devvit validate --config <path>` that performs schema, permission, endpoint, and artifact checks without building, uploading, or changing an installation.

## 2026-07-12 19:02 UTC — Configuration docs disagree with the current schema and changelog on app-name length

- Environment: official Devvit 0.13 configuration page, published `config-file.v1.json`, and 0.13 changelog.
- Expected result: the prose reference, schema, and release notes agree on a basic required field.
- Actual result:
  - The configuration page says `name` must be 3–16 characters in both “Required properties” and “Core properties.”
  - The live schema specifies `minLength: 3` and `maxLength: 20`.
  - The 0.13.6 changelog says app slugs can now be up to 20 characters.
- Reproduction:
  1. Open the current [configuration reference](https://developers.reddit.com/docs/capabilities/devvit-web/devvit_web_configuration#required-properties).
  2. Fetch `https://developers.reddit.com/schema/config-file.v1.json` and inspect `properties.name`.
  3. Compare the [0.13.6 changelog](https://developers.reddit.com/docs/changelog#relese-0136-external-endpoints-and-app-mentions-triggers-limited-access).
- Severity: documentation correctness issue. It can unnecessarily constrain naming decisions or make IDE/CLI acceptance appear inconsistent.
- Workaround: treat the published schema and current CLI as authoritative.
- Recommendation: generate field constraints in the reference page from the same schema used by the CLI, and add a docs consistency check for duplicated limits.

## 2026-07-12 18:56 UTC — Custom-config missing-entry error waits and then names the wrong file

- Environment: `@devvit/cli@0.13.7`, valid alternate config passed with `--config`, build script completes successfully, configured server entry intentionally absent.
- Command: `devvit upload --config devvit.experiment-missing-entry.json`
- Expected result: after the non-watch build command exits, artifact validation fails promptly and identifies the custom config that supplied the bad path.
- Actual result: the full command took about 22.6 seconds. After `vite build` completed, the CLI entered `Waiting for config.server.entry file ... to be generated`, then failed with an actionable missing-entry explanation that specifically said to correct `devvit.json`, not the custom file named in the command and initial CLI output. Public source inspection later confirmed this artifact poll has a hard-coded 10-second timeout and begins warning at 5 seconds; the remaining observed time belonged to command startup/build work.
- Severity: minor diagnostic rough edge. The core error and missing path were otherwise clear.
- Workaround: inspect the path shown in the error and apply the fix to the file passed via `--config`.
- Recommendation: skip or shorten the 10-second artifact poll after a one-shot `scripts.build` process has exited; include the resolved config filename in every configuration diagnostic.

## 2026-07-12 18:51 UTC — JSON log mode provides no connected or empty-history signal

- Environment: authenticated `@devvit/cli@0.13.7`, installed Fallstack playtest on `r/fallstack_dev`.
- Commands:
  - `devvit logs fallstack_dev fallstack --since=1h --json --show-timestamps`
  - `devvit logs fallstack_dev fallstack --since=1h --json --verbose`
- Expected result: machine-readable mode provides a record indicating connection/readiness and whether the historical query completed with zero records, or documents that it is an indefinite record-only stream.
- Actual result: both commands remained completely silent until interrupted (first run approximately one minute), then exited 0. Human mode printed `streaming logs for fallstack on r/fallstack_dev` after about six seconds, but did not distinguish an empty historical result from waiting for future events.
- Severity: low-to-moderate automation/diagnostic gap. Silence is valid JSON-lines behavior, but a CI or support script cannot distinguish connected-and-empty from stalled-before-connection.
- Workaround: use human mode for a connection banner; there is no observed completion marker for the historical window.
- Recommendation: emit typed JSON control records such as `connected`, `history_complete`, and `heartbeat` (to stderr or behind a flag), and document whether `--since` first drains history and then tails indefinitely.

## 2026-07-12 18:35 UTC — Official test harness install stalls on an implicit Redis source download

- Environment: Ubuntu VM, Node v24.18.0, npm 11.18.0, `@devvit/test@0.13.7`, no preinstalled `redis-server`.
- Task attempted: install the test stack recommended by the official [Testing with @devvit/test](https://developers.reddit.com/docs/guides/tools/devvit_test) guide.
- Command: `npm install --save-dev @devvit/test@0.13.7 vitest@4.1.10`
- Expected result: install the documented development dependencies, with any native prerequisite or download made visible and bounded.
- Actual result: installation remained in `redis-memory-server@0.14.1`'s silent postinstall for more than three minutes. After interruption, buffered output revealed `Downloading Redis stable: 0 % (0mb / 4.4mb)`. The package downloads and compiles Redis during postinstall; the testing guide does not mention this network/toolchain step or its environment variables.
- Reproduction steps:
  1. Start on a Linux environment without `redis-server` or a cached Redis binary.
  2. Run the documented install command.
  3. Observe the postinstall remain at 0% without live progress.
  4. Interrupt it and inspect npm's error output.
- Severity: significant developer-experience rough edge in the newly documented testing path.
- Workaround: install a system Redis binary, then install with `REDISMS_DISABLE_POSTINSTALL=1` and run tests with `REDISMS_SYSTEM_BINARY=/usr/bin/redis-server`.
- Recommendation: document the binary download, cache location, supported environment variables, compilation prerequisites, and system-binary path. Stream progress rather than buffering it until failure.

## 2026-07-12 18:38 UTC — Current official test harness introduces four unfixable audit findings

- Environment: same as above, with installation completed using `REDISMS_DISABLE_POSTINSTALL=1`.
- Commands:
  - `REDISMS_DISABLE_POSTINSTALL=1 npm install --save-dev @devvit/test@0.13.7 vitest@4.1.10`
  - `npm audit --json`
  - `npm ls tar uuid redis-memory-server @devvit/test --all`
- Expected result: the current first-party testing package can be added to a clean current Devvit app without creating known high-severity dependency findings.
- Actual result: npm reported 4 vulnerabilities (2 high, 2 moderate), all on the path `@devvit/test@0.13.7 > redis-memory-server@0.14.1`. The installed versions were `tar@6.2.1` and `uuid@8.3.2`; npm reported no fix available for the dependency path. Installation also emitted deprecation warnings for those packages and `glob@10.5.0`.
- Severity: high-confidence adoption blocker for teams with a zero-high-vulnerability CI policy; development-only dependency, so it does not enlarge the shipped client/server bundle.
- Workaround: none within the published dependency range. Fallstack removed the experimental dependencies after reproducing the issue; `npm uninstall --save-dev @devvit/test vitest` returned the repository to 0 audit findings.
- Recommendation: update `packages/test/package.json` from `redis-memory-server@0.14.1` to `0.17.0`, update the same development dependency in `packages/redis/package.json`, publish a patched `@devvit/test`, and add dependency auditing to its release gate.
- Patch validation: forcing `redis-memory-server@0.17.0` under the published `@devvit/test@0.13.7` resolved `tar@7.5.20`, removed the old UUID path, installed with 0 vulnerabilities, and passed a real Vitest Redis set/get through `createDevvitTest()` using the system Redis binary. Full upstream tests remain required before release.

## 2026-07-12 18:40 UTC — Test harness cannot configure post context for a Devvit Web route

- Environment: `@devvit/test@0.13.7`, Vitest 4.1.10, Hono 4.12.29, Fallstack's `/api/init-game` route using `context.postId` from `@devvit/web/server`.
- Task attempted: integration-test the real Hono route with the documented `createDevvitTest()` runner and its `headers` fixture.
- Expected result: configure a realistic post execution context and exercise the route through its actual request boundary, Redis calls, and authenticated context.
- Actual result: `DevvitTestConfig` exposes username, user ID, subreddit name/ID, settings, and internal `appConfig`, but no post ID. Setting `headers['devvit-post']` to `t3_fallstack_test_post`, both as a fixture mutation and as request headers passed to `api.request()`, still left `context.postId` undefined. The real route returned HTTP 400 with `postId is required but missing from context` in both attempts.
- Root cause confirmed in public source: `packages/test/src/server/vitest/devvitTest.ts` constructs `headers`, immediately snapshots them into `reqCtx = Context(headers)`, and only then exposes the headers object as a fixture. Mutating the fixture inside the test cannot rebuild the request context. The public `DevvitTestConfig` type has no raw-header, post, comment, or logged-out identity fields.
- Reproduction steps:
  1. Create a runner with `createDevvitTest({ username, userId })`.
  2. Import a Hono route that reads `context.postId` from `@devvit/web/server`.
  3. Set the documented mutable headers fixture's `devvit-post` value.
  4. Call the route with `api.request()`, with and without those headers on the request.
  5. Observe that `context.postId` remains missing.
- Severity: testing coverage gap. Capability calls can be tested, but post-scoped Devvit Web endpoints cannot be exercised end-to-end through the obvious public API.
- Workaround: refactor production logic behind injected service/context parameters and test below the HTTP boundary, then reserve the real boundary for uploaded playtests. This weakens the advertised production-like integration coverage.
- Recommendation: add `headers?: Partial<Record<Header, string>>` (or typed `postId`, `commentId`, `loid`, and related fields) to `DevvitTestConfig` and merge it before `Context(headers)` is called. Add assertions against the actual exported `context`, not only the fixture object. Alternatively, document a supported request adapter that hydrates `@devvit/web/server` context from a Hono/Fetch request.

## 2026-07-08 00:00 UTC — Raw Vite dev server is blocked by the Devvit plugin

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7, app `fallstack`.
- Task attempted: run a local Vite dev server for quick browser smoke testing.
- Command: `npx vite --host 127.0.0.1 --port 5173`
- Expected result: local Vite dev server can preview the client, or Devvit tooling clearly routes to an equivalent local preview path.
- Actual result: the Devvit plugin fails with `This plugin only supports vite build. For development, run: npm run dev`.
- Reproduction steps:
  1. Use the current Devvit Web scaffold with `@devvit/start/vite`.
  2. Run `npx vite --host 127.0.0.1 --port 5173`.
  3. Observe the plugin-level failure before the dev server starts.
- Severity: rough edge.
- Workaround: use `npm run build` for bundle validation and Devvit playtest for integrated testing.
- Notes: A documented lightweight browser smoke-test path for client-only rendering would reduce iteration time for canvas-heavy games.

## 2026-07-08 00:00 UTC — npm engine warning during supported Node setup

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7.
- Task attempted: install `phaser`.
- Command: `npm install phaser`.
- Expected result: clean install with the scaffold's package manager expectations.
- Actual result: install succeeds, but npm warns that `moderndash@4.0.0` requires `npm >=10` while the VM has npm 9.2.0.
- Severity: confusing.
- Workaround: none needed for this task; install and validation still succeeded.
- Notes: The scaffold targets Node 22, but npm version expectations are less obvious. Calling out npm 10 in setup docs would prevent uncertainty.

## 2026-07-08 00:00 UTC — Phaser-sized expanded app triggers bundle warnings

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7.
- Task attempted: production build after adding Phaser to the expanded entrypoint.
- Command: `npm run build`
- Expected result: successful build with actionable warnings.
- Actual result: build succeeds. Warnings report significant time in the Devvit plugin and chunks larger than 500 kB after minification.
- Severity: docs gap.
- Workaround: none for the current build; later code-splitting may be useful if measured load time becomes a problem.
- Notes: Phaser games are likely to cross the default chunk warning threshold. Devvit-specific guidance on acceptable bundle size, iframe load impact, and whether expanded entrypoints should code-split would be helpful.

## 2026-07-12 19:45 UTC — Devvit build hides package sizes while uploader selects linked source maps

- Environment: `@devvit/start@0.13.7`, `@devvit/cli@0.13.7`, Vite 8.1.4, Phaser 4.2.1, Fallstack production build.
- Task attempted: determine exactly what the normal Devvit Web build reports and what the CLI selects from `dist/client` for upload.
- Commands: `npm run build`, raw/gzip/Brotli-Q4 file measurement, and the installed CLI's exported `queryAssets('./dist/client', [], 'Client', '0.13.7', false)` function.
- Expected result: a game-oriented build/upload path reports the selected manifest and enough size data to interpret a large successful Phaser build before mutating a remote version.
- Actual result: the first-party Vite plugin sets `sourcemap: true` and `reportCompressedSize: false`. The build printed no file-size table. The CLI glob selected all 12 client files, including three linked source maps. Runtime assets were 1,826,262 raw bytes; maps were 12,571,300 raw bytes; maps comprised 87.3% of the 14,397,562-byte on-disk client directory. The uploader measured 14,397,690 bytes after injecting its script into two HTML files.
- Root cause: `@devvit/start/vite/index.js` owns the build defaults; `@devvit/cli/dist/util/AssetUploader.js` globs every client file because WebView assets use an empty extension allowlist.
- Severity: tooling/guide observability gap. This is not evidence that maps are fetched during ordinary gameplay or that the current runtime bundle violates an unpublished host limit.
- Workaround: measure `dist/client` independently and inspect the upload with `--verbose`; developers can override the Vite map policy, but current docs do not state the tradeoff for playtest versus publish.
- Recommendation: add a non-mutating package report that lists selected files, separates runtime and source-map bytes, estimates compression, identifies entrypoint totals, and compares them with published inline/expanded/mobile targets. Make the source-map policy explicit.
- Full evidence: `docs/phaser-packaging-observability-pass.md`.

## 2026-07-08 00:00 UTC — Static browser smoke found graceful-degradation gap

- Environment: Ubuntu VM, Node v22.22.1, local static server via `python3 -m http.server`, Playwright CLI wrapper, Google Chrome 150.0.7871.100.
- Task attempted: open built `dist/client/game.html` outside Devvit to inspect first viewport and result card rendering.
- Commands:
  - `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist/client`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:4173/game.html`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh snapshot`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename ... --full-page`
- Expected result: even without Devvit server context, the client should show seeded local state and a nonblank tower.
- Actual result: initial run showed the offline message but no seeded snapshot/result data after `/api/init-game` returned 404.
- Severity: rough edge.
- Workaround: derive seeded snapshot client-side on init failure. Static browser smoke then shows seeded tower stats, readable labels, and nonblank Phaser rendering.
- Notes: Static browser smoke is not a substitute for Devvit playtest, but it is fast and caught a real graceful-degradation bug.

## 2026-07-08 00:00 UTC — Playwright browser install needed system Chrome

- Environment: Ubuntu VM with `npx` present but no Chrome at `/opt/google/chrome/chrome`.
- Task attempted: use the local Playwright CLI wrapper to inspect the built client.
- Command: `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:4173/game.html`
- Expected result: wrapper launches a browser or gives clear setup guidance.
- Actual result: wrapper failed with `Chromium distribution 'chrome' is not found` and suggested `npx playwright install chrome`.
- Severity: rough edge.
- Workaround: run `npx playwright install chrome` once on fresh VMs.
- Notes: The error is actionable. Browser automation needs this setup before visual QA can proceed.

## 2026-07-08 00:00 UTC — Browser inspection of Reddit playtest blocked by network security

- Environment: Ubuntu VM, Playwright CLI wrapper, Google Chrome 150.0.7871.100, Devvit playtest URL `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`.
- Task attempted: open the real Reddit playtest URL in an automated browser to inspect the Devvit iframe.
- Commands:
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open 'https://www.reddit.com/r/fallstack_dev/?playtest=fallstack'`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh snapshot`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename output/playwright/reddit-playtest-network-block.png --full-page`
- Expected result: Reddit page loads the playtest post so the interactive post can be visually inspected in its real host page.
- Actual result: Reddit returned a 403 and displayed "You've been blocked by network security" with instructions to log in or use a developer token.
- Severity: blocker.
- Workaround: use a logged-in human browser session for final in-Reddit visual QA; static local browser smoke and `devvit playtest` upload still validate separate parts of the path.
- Notes: Automated QA for playtest posts needs either browser login state or documented developer-token setup.
- Reconfirmed 2026-07-12 with a fresh `agent-browser` Chrome 150.0.7871.115 session after a successful v0.0.14.4 playtest upload. A second attempt using the VM's existing Google Chrome profile produced the same block. Evidence: `docs/playtest-evidence/2026-07-12/screenshots/reddit-network-block.png`.

## 2026-07-08 00:00 UTC — Mobile static smoke caught first-viewport HUD compression

- Environment: Ubuntu VM, built `dist/client`, local static server, Playwright CLI wrapper, Google Chrome 150.0.7871.100.
- Task attempted: inspect expanded `game.html` at a phone-sized `390x844` viewport after input and persistence hardening.
- Commands:
  - `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist/client`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open 'http://127.0.0.1:4173/game.html'`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh resize 390 844`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh snapshot`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename output/playwright/fallstack-mobile-smoke-after-hud.png --full-page`
- Expected result: the first viewport keeps the headline readable, shows the tower immediately, and leaves mobile controls usable.
- Actual result: first smoke showed the headline squeezed into one-word lines.
- Severity: rough edge.
- Workaround: fix the mobile HUD grid and duplicate in-canvas zone label, then re-smoke the built client.
- Notes: Local static smoke still logs `/api/init-game` 404s by design, then uses seeded local fallback state.
