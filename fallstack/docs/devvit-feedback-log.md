# Devvit Platform Feedback Log

Document only observed Devvit or tooling failures, rough edges, and reproducible gaps. Do not add routine successful playtest logs; keep those in commit messages or validation notes instead.

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
