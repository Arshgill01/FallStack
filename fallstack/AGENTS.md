You are writing a Devvit Web Phaser application that runs on Reddit.com.

## Tech Stack

- **Game client**: Phaser, TypeScript, Vite, plain HTML/CSS.
- **Backend**: Devvit Web server endpoints, Hono, Node.js v22 serverless runtime.
- **State**: Redis and Reddit APIs through `@devvit/web/server`.
- **Configuration**: `devvit.json` entrypoints, menus, triggers, and permissions.

## Layout & Architecture

- `/src/client`: client code executed inside Reddit's iframe.
  - `splash.html`: lightweight inline/feed entrypoint.
  - `game.html`: expanded playable game entrypoint.
  - `game.ts`: Phaser bootstrap.
  - `scenes/`: Phaser scenes.
- `/src/server`: backend endpoints.
  - Access `redis`, `reddit`, and `context` here via `@devvit/web/server`.
  - All persistent mutation writes, contribution caps, user identity, and Reddit API calls belong here.
- `/src/shared`: shared request/response types and pure game logic.
  - Pure game logic must not import Devvit or Phaser.

## Frontend Rules

- Use `requestExpandedMode` from `@devvit/web/client` to enter the expanded game view.
- Use `navigateTo` from `@devvit/web/client` instead of `window.location` or `window.open`.
- Keep the inline entrypoint light. Load Phaser only in `game.html`.
- Bundle assets with Vite; do not depend on CDN scripts for core runtime.
- DOM controls may update shared client input state that Phaser reads each frame.

## Server Rules

- Define client/server calls under `/api`.
- Validate every client event server-side. The client is untrusted.
- Never accept usernames, user IDs, Redis keys, or displayed text from client payloads.
- Construct Redis keys on the server from validated daily seed/date, zone IDs, and authenticated user context.
- Whenever you add an endpoint for a menu item, add the corresponding mapping to `devvit.json`.

## Current-API Rules

- Do not use Blocks APIs.
- Do not use `@devvit/public-api` for post UI.
- Do not use `Devvit.addCustomPostType()`.
- Do not add `devvit.yaml`; this project uses `devvit.json`.
- Do not use legacy `useWebView` or postMessage bridge patterns for server state. Use Devvit Web endpoints.

Docs: https://developers.reddit.com/docs/llms.txt.
