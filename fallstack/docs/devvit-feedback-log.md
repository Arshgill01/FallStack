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
