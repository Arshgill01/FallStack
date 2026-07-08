# Devvit Platform Feedback Log

## 2026-07-08 00:00 UTC — Setup and first Phaser integration

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7, app `fallstack`.
- Task attempted: install Phaser, build a Devvit Web expanded entrypoint, and validate with project-native commands.
- Commands:
  - `npm install phaser`
  - `npm run type-check`
  - `npm run lint`
  - `npm run build`
  - `npx devvit --version`
  - `npx devvit whoami`
  - `npx vite --host 127.0.0.1 --port 5173`
- Expected result: local Vite dev server can be used for quick browser smoke tests, or the Devvit tooling clearly routes to an equivalent local preview path.
- Actual result: `npx vite` fails with `devvit plugin error` and the message `This plugin only supports vite build. For development, run: npm run dev`.
- Reproduction steps:
  1. Use the current Devvit Web scaffold with `@devvit/start/vite`.
  2. Run `npx vite --host 127.0.0.1 --port 5173`.
  3. Observe the plugin-level failure before the dev server starts.
- Severity: rough edge.
- Workaround: use `npm run build` for bundle validation and Devvit playtest for integrated testing.
- Notes: The explicit error message is useful. A documented lightweight browser smoke-test path for client-only rendering would reduce iteration time for canvas-heavy games.

## 2026-07-08 00:00 UTC — npm engine warning during supported Node setup

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7.
- Task attempted: install `phaser`.
- Command: `npm install phaser`.
- Expected result: clean install with the scaffold's package manager expectations.
- Actual result: install succeeds, but npm warns that `moderndash@4.0.0` requires `npm >=10` while the VM has npm 9.2.0.
- Severity: confusing.
- Workaround: none needed for this task; install and validation still succeeded.
- Notes: The scaffold targets Node 22, but npm version expectations are less obvious. Calling out npm 10 in setup docs would prevent uncertainty.

## 2026-07-08 00:00 UTC — Build feedback for Phaser-sized expanded app

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7.
- Task attempted: production build after adding Phaser to the expanded entrypoint.
- Command: `npm run build`.
- Expected result: successful build with actionable warnings.
- Actual result: build succeeds. Warnings report significant time in the Devvit plugin and chunks larger than 500 kB after minification.
- Severity: docs gap.
- Workaround: none for the current build; later code-splitting may be useful.
- Notes: Phaser games are likely to cross the default chunk warning threshold. Devvit-specific guidance on acceptable bundle size, iframe load impact, and whether expanded entrypoints should code-split would be helpful.

## 2026-07-08 00:00 UTC — Playtest path successfully handles WebView asset upload

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7, authenticated as `u/BrightyBrainiac`.
- Task attempted: run integrated Devvit playtest after adding Phaser and a larger WebView bundle.
- Command: `npm run dev`.
- Expected result: Devvit builds server/client assets, uploads the WebView bundle, and returns a playable Reddit URL.
- Actual result: playtest succeeded and returned `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack` with version `v0.0.1.3`.
- Severity: praise.
- Notes: The command gave clear progress for server rebuild, client rebuild, asset upload count, and final playtest URL. That is a strong integrated loop once the developer knows to use `devvit playtest` instead of raw Vite dev server.

## 2026-07-08 00:00 UTC — Playtest after mutation hardening and listing cleanup

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7, authenticated as `u/BrightyBrainiac`.
- Task attempted: verify Devvit playtest after adding idempotency fields, result-card data, audio UI, and removing scaffold form/menu items.
- Command: `npm run dev`.
- Expected result: server/client rebuild, WebView asset upload, and a fresh playable Reddit URL.
- Actual result: playtest succeeded and returned `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack` with version `v0.0.1.5`.
- Severity: praise.
- Notes: Rebuild and upload remained reliable after server route/config changes. The large Phaser bundle still triggers Vite's chunk-size warning, but upload completed.

## 2026-07-08 00:00 UTC — Local custom Codex UI/UX skills install path

- Environment: Ubuntu VM, local tarball `/home/arshdeepsingh/codex-ui-ux-skills.tgz`.
- Task attempted: install local/custom UI design skills that are not in the public `openai/skills` index.
- Commands:
  - `mkdir -p ~/.codex/skills`
  - `tar -xzf /home/arshdeepsingh/codex-ui-ux-skills.tgz -C ~/.codex/skills`
  - `find ~/.codex/skills -maxdepth 2 -name SKILL.md | sort`
- Expected result: each skill directory appears under `$CODEX_HOME/skills`.
- Actual result: local skills installed, including `frontend-design`, `impeccable`, `web-design-guidelines`, `agent-browser`, and related UI/UX skills.
- Severity: docs gap.
- Workaround: install from the tarball directly rather than using the public skill installer lookup.
- Notes: Public skill discovery only finds published curated skills. Local/custom skills need direct copy or tar extraction into `$CODEX_HOME/skills`.

## 2026-07-08 00:00 UTC — Final local validation pass

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7.
- Task attempted: final local QA after adding pure game tests and display-label copy cleanup.
- Commands:
  - `npm test`
  - `npm run lint`
  - `npm run build`
- Expected result: automated tests, lint, and production build pass before submission packaging.
- Actual result: all commands passed. Lint reports only Fast Refresh warnings for Vite entrypoint-local components. Build reports the known Phaser chunk-size warning.
- Severity: praise.
- Notes: The scaffold's TypeScript project references made it straightforward to run pure shared game tests without launching Phaser or Devvit after adding a `node --test` script against emitted shared JS.

## 2026-07-08 00:00 UTC — Static browser smoke found graceful-degradation gap

- Environment: Ubuntu VM, Node v22.22.1, local static server via `python3 -m http.server`, Playwright CLI wrapper, Google Chrome 150.0.7871.100.
- Task attempted: open the built `dist/client/game.html` outside Devvit to inspect first viewport and result card rendering.
- Commands:
  - `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist/client`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:4173/game.html`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh snapshot`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename ... --full-page`
- Expected result: even without Devvit server context, the client should show seeded local state and a nonblank tower.
- Actual result: initial run showed the offline message but no seeded snapshot/result data after `/api/init-game` returned 404. Fixed by deriving the seeded snapshot client-side on init failure. Re-test showed enabled result card, seeded tower stats, readable labels, and nonblank Phaser rendering.
- Severity: rough edge.
- Workaround: fixed in client fallback.
- Notes: Static browser smoke is not a substitute for Devvit playtest, but it is fast and caught a real graceful-degradation bug.

## 2026-07-08 00:00 UTC — Playwright browser install needed system Chrome

- Environment: Ubuntu VM with `npx` present but no Chrome at `/opt/google/chrome/chrome`.
- Task attempted: use the local Playwright CLI skill to inspect the built client.
- Command: `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open http://127.0.0.1:4173/game.html`.
- Expected result: wrapper launches a browser or gives clear setup guidance.
- Actual result: wrapper failed with `Chromium distribution 'chrome' is not found` and suggested `npx playwright install chrome`.
- Severity: rough edge.
- Workaround: ran `npx playwright install chrome`, which installed Google Chrome plus supporting dependencies and allowed browser smoke testing to proceed.
- Notes: The error was actionable. On fresh VMs, browser automation needs this one-time setup.

## 2026-07-08 00:00 UTC — Playtest after install-trigger removal

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7, authenticated as `u/BrightyBrainiac`.
- Task attempted: verify Devvit playtest after removing the scaffold app-install trigger so posts are created only through the explicit moderator menu.
- Commands:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `npm run dev`
- Expected result: tests/build still pass, Devvit uploads the WebView bundle, and the playtest URL remains available without an automatic install-time post side effect.
- Actual result: all local validation passed, then playtest succeeded and returned `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack` with version `v0.0.1.7`.
- Severity: praise.
- Notes: The CLI clearly reported the new WebView asset upload, update progress, version number, and the command to revert from the playtest version.

## 2026-07-08 00:00 UTC — Browser inspection of Reddit playtest blocked by network security

- Environment: Ubuntu VM, Playwright CLI wrapper, Google Chrome 150.0.7871.100, Devvit playtest URL `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`.
- Task attempted: open the real Reddit playtest URL in an automated browser to inspect the Devvit iframe after the `v0.0.1.7` upload.
- Commands:
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open 'https://www.reddit.com/r/fallstack_dev/?playtest=fallstack'`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh snapshot`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename output/playwright/reddit-playtest-network-block.png --full-page`
- Expected result: Reddit page loads the playtest post so the interactive post can be visually inspected in its real host page.
- Actual result: Reddit returned a 403 and displayed "You've been blocked by network security" with instructions to log in or use a developer token.
- Severity: blocker.
- Workaround: use a logged-in human browser session for final in-Reddit visual QA; static local browser smoke and `devvit playtest` upload still validate separate parts of the path.
- Notes: The error page is clear, but automated QA for playtest posts needs either browser login state or documented developer-token setup.

## 2026-07-08 00:00 UTC — Playtest after additive mutation counters

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7, authenticated as `u/BrightyBrainiac`.
- Task attempted: verify Devvit build/upload after moving new mutation totals to additive Redis counter keys and adding keyboard/reduced-motion input hardening.
- Commands:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - `npm run dev`
- Expected result: validation passes and Devvit playtest returns a fresh URL/version with the larger Phaser WebView bundle.
- Actual result: validation passed; playtest succeeded and returned `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack` with version `v0.0.1.9`.
- Severity: praise.
- Notes: Upload and update remained reliable after changing server persistence internals. The same Phaser chunk warning still appears during build.

## 2026-07-08 00:00 UTC — Mobile static smoke caught first-viewport HUD compression

- Environment: Ubuntu VM, built `dist/client`, local static server, Playwright CLI wrapper, Google Chrome 150.0.7871.100.
- Task attempted: inspect the expanded `game.html` at a phone-sized `390x844` viewport after input and persistence hardening.
- Commands:
  - `python3 -m http.server 4173 --bind 127.0.0.1 --directory dist/client`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh open 'http://127.0.0.1:4173/game.html'`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh resize 390 844`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh snapshot`
  - `bash ~/.codex/skills/playwright/scripts/playwright_cli.sh screenshot --filename output/playwright/fallstack-mobile-smoke-after-hud.png --full-page`
- Expected result: the first viewport keeps the headline readable, shows the tower immediately, and leaves mobile controls usable.
- Actual result: first smoke showed the headline squeezed into one-word lines. Fixed the mobile HUD grid and duplicate in-canvas zone label, then re-smoked successfully. Saved `docs/screenshots/fallstack-mobile-smoke.png`.
- Severity: rough edge.
- Workaround: fixed in CSS/canvas label rendering.
- Notes: Local static smoke still logs `/api/init-game` 404s by design, then uses seeded local fallback state. That path remains useful for fast visual QA when the real Reddit URL is blocked.

## 2026-07-08 00:00 UTC — Playtest after seeded chunk generator

- Environment: Ubuntu VM, Node v22.22.1, npm 9.2.0, Devvit CLI 0.13.7, authenticated as `u/BrightyBrainiac`.
- Task attempted: verify the app after replacing the flat hardcoded platform source with a pure seeded chunk generator consumed by Phaser.
- Commands:
  - `npm test`
  - `npm run lint`
  - `npm run build`
  - Static smoke of `dist/client/game.html` at `390x844`
  - `npm run dev`
- Expected result: generated towers remain deterministic/reachable, local static smoke renders the first viewport, and Devvit playtest uploads the generated-geometry client.
- Actual result: 11 pure tests passed, static smoke rendered the generated-tower build, and playtest succeeded at `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack` with version `v0.0.1.11`.
- Severity: praise.
- Notes: The CLI uploaded 3 new WebView assets after the shared tower generator split.
