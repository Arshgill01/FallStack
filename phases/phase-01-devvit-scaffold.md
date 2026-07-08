# Phase 01: Devvit Web Phaser Scaffold

Stand up the current Devvit Web app structure, get it deploying as an interactive post, and prove the client/server path that future game code will use for state.

---

## Context

The project has design documentation ([AGENTS.md](../AGENTS.md), [PRODUCT.md](../PRODUCT.md), [fallstack_concept_log.md](../fallstack_concept_log.md)) and three working HTML mockups with canvas physics, zone layouts, artifact logic, and visual exploration.

Current Devvit guidance matters here. Older Blocks patterns are not the foundation for this project:

- Do not use `Devvit.addCustomPostType()`.
- Do not use `@devvit/public-api` JSX Blocks for the post UI.
- Do not use `devvit.yaml`; current Devvit Web apps use `devvit.json`.
- Do not use `submitCustomPost({ preview: ... })` or `useWebView` bridge patterns.

Use Devvit Web with HTML entrypoints declared in `devvit.json`, a client app in `src/client`, and server endpoints in `src/server`. The app has already been created as `fallstack` and installed for playtest on `r/fallstack_dev`.

---

## What This Phase Builds

### 1. Devvit Web Project Initialization

Initialize or normalize the project using the official Phaser starter:

```bash
npm create devvit@latest --template=phaser
```

If the Devvit app already exists, keep its app identity and transplant the Phaser starter structure rather than creating a second app. The target app name is `fallstack`.

Target directory structure:

```text
fallstack/
├── devvit.json                 # App config, entrypoints, menus, triggers
├── package.json                # Dependencies, build scripts
├── tsconfig.json               # TypeScript project references
├── src/
│   ├── client/                 # HTML/CSS/TS client inside Reddit iframe
│   │   ├── splash.html         # Inline feed entrypoint
│   │   ├── splash.ts           # Lightweight launch screen
│   │   ├── game.html           # Expanded game entrypoint
│   │   ├── game.ts             # Phaser bootstrap
│   │   ├── game.css            # Game viewport styles
│   │   └── scenes/             # Phaser scenes
│   ├── server/                 # Devvit Web server endpoints
│   │   ├── index.ts            # Hono server entry
│   │   ├── core/post.ts        # Custom post creation
│   │   └── routes/             # API/menu/form/trigger routes
│   └── shared/                 # Shared request/response and game types
└── docs/
    └── devvit-feedback-log.md  # Platform feedback
```

Add pure game logic under `src/shared/game/` or `src/game/` once rules are extracted. That code must stay dependency-free from Devvit and Phaser so it can be tested without launching Reddit or a canvas.

### 2. Interactive Post Entrypoints

Configure post entrypoints in `devvit.json`:

```json
{
  "post": {
    "dir": "dist/client",
    "entrypoints": {
      "default": {
        "inline": true,
        "entry": "splash.html"
      },
      "game": {
        "entry": "game.html"
      }
    }
  },
  "server": {
    "dir": "dist/server",
    "entry": "index.cjs"
  }
}
```

The inline `splash.html` is the feed/launch surface and must stay lightweight. The expanded `game.html` loads Phaser and the playable tower.

### 3. Menu Action for Post Creation

Register the subreddit menu item in `devvit.json` and implement the endpoint in `src/server/routes/menu.ts`.

`devvit.json`:

```json
{
  "menu": {
    "items": [
      {
        "label": "Create Fallstack Tower",
        "description": "Create today's shared Fallstack tower",
        "location": "subreddit",
        "forUserType": "moderator",
        "endpoint": "/internal/menu/post-create"
      }
    ]
  }
}
```

`src/server/core/post.ts`:

```typescript
import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: "Today's Fallstack Tower",
    entry: 'default',
    postData: {
      dailySeed: 37,
    },
  });
};
```

Use `postData` only for small post-scoped boot metadata. Shared counters, contribution caps, clears, and daily state live in Redis.

### 4. Client/Server API Contract

Devvit Web client code calls server endpoints under `/api`. This replaces the older postMessage bridge pattern.

Define explicit shared types in `src/shared/api.ts`:

```typescript
export type InitGameResponse = {
  type: 'init-game';
  dailySeed: number;
  username: string;
  zoneState: ZoneState[];
};

export type RecordFallRequest = {
  zoneId: string;
  failureBucket: FailureBucket;
  timestamp: number;
};

export type RecordFallResponse = {
  type: 'state-update';
  zoneState: ZoneState[];
  feedback: string;
  counted: boolean;
};
```

Initial endpoints to establish:

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/init-game` | `GET` | Send daily seed, user-safe display info, and derived zone state to the client |
| `/api/record-fall` | `POST` | Validate and persist one fall event, then return updated derived state |
| `/api/record-checkpoint` | `POST` | Persist a zone clear/checkpoint event |
| `/api/record-summit` | `POST` | Persist summit clear and result-card stats |

For Phase 01, `/api/init-game` plus a Redis read/write smoke test is enough. Later phases flesh out mutation writes.

### 5. Phaser Client Shell

`src/client/game.html` should contain only the game root and module script:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no"
    />
    <link rel="stylesheet" href="game.css" />
    <title>Fallstack</title>
  </head>
  <body>
    <div id="app">
      <div id="game-container"></div>
    </div>
    <script type="module" src="game.ts"></script>
  </body>
</html>
```

Key CSS requirements:

- `touch-action: none` on the expanded game surface.
- `user-select: none` during play.
- `overflow: hidden`.
- A stable `#game-container` that fills available space.

### 6. Redis Key Structure

Plan the key namespacing now, even though full persistence comes later:

```text
fallstack:{dailySeed}:zone:{zoneId}:counts           Hash { short_jump, overjump, wall_bonk, helper_overuse }
fallstack:{dailySeed}:zone:{zoneId}:clears           Number
fallstack:{dailySeed}:zone:{zoneId}:badge            String (Quiet|Haunted|Cursed|Reinforced|Stabilized)
fallstack:{dailySeed}:user:{userId}:contrib:{zoneId} Hash { short_jump, overjump, wall_bonk, helper_overuse, clear }
fallstack:{dailySeed}:user:{userId}:totalContrib     Number
fallstack:{dailySeed}:stats                          Hash { totalClimbs, totalFalls, totalClears, firstSummit }
fallstack:{dailySeed}:meta                           Hash { towerName, seed, createdAt }
```

Key design decisions:

- Daily seed is the namespace root.
- Zone state is derived from additive counters.
- Redis increments happen server-side only.
- User identity comes from Devvit server context, never from client payloads.

For this phase, verify server-side Redis access with a harmless key through an `/api` endpoint or menu-triggered path.

### 7. Build Scripts

Use the current Devvit Web starter scripts:

```json
{
  "scripts": {
    "build": "vite build",
    "deploy": "npm run type-check && npm run lint && devvit upload",
    "dev": "devvit playtest",
    "launch": "npm run deploy && devvit publish",
    "lint": "eslint 'src/**/*.{ts,tsx}'",
    "type-check": "tsc --build"
  }
}
```

Expected core dependencies:

- `@devvit/web`
- `@devvit/start`
- `devvit`
- `hono`
- `vite`
- `typescript`
- `phaser`

Do not add React/Tailwind unless a later shell requirement clearly benefits from them. Phaser plus plain HTML/CSS is the simpler foundation for this game.

### 8. Devvit Feedback Log

Start `docs/devvit-feedback-log.md` from the moment Devvit work begins. Log every friction point, bug, surprise, documentation gap, and positive experience during scaffold setup.

```markdown
# Devvit Platform Feedback Log

## Environment
- OS:
- Node:
- Devvit CLI:
- Browser:

## Entries

### Entry 1: [Date] - Project initialization
- Task:
- Expected:
- Actual:
- Severity: blocker | confusing | rough edge | docs gap | feature request | praise
- Workaround:
```

---

## Key Technical Considerations

### Devvit Web Runtime

The client runs in a Reddit iframe and talks to server endpoints. Important constraints:

- Client code cannot make arbitrary external requests; use server endpoints for external or privileged work.
- Server endpoints are request/response only and should finish quickly.
- Use Redis for persistent shared state. Do not rely on `localStorage` for durable data because app updates can change iframe origins.
- Bundle Phaser and assets through Vite rather than loading CDN scripts.
- Use Devvit client APIs such as `requestExpandedMode` and `navigateTo` instead of direct browser navigation.

### Rate Limits

Devvit has API call quotas. Design API calls around meaningful events:

- Do not call the server per frame.
- Do not persist every jump start/release.
- Send one mutation event when an attempt ends.
- Send one clear event when a checkpoint or summit is reached.
- Poll sparingly, if at all; prefer state returned from event writes.

### Viewport Dimensions

Reddit posts render approximately 400-500px wide with variable height. The mockups assume `WORLD_W = 480`; treat that as a logical game width, not a guaranteed CSS width. Phaser should resize to the available container while preserving legibility and touch targets.

### The Three-Layer Boundary

Establish the boundary early:

- **Pure game logic** owns rules, constants, tower generation, mutation thresholds, and derived artifact state.
- **Phaser client** owns movement, collision, camera, rendering, local input, and local event emission.
- **Devvit Web server** owns Redis, Reddit API access, user identity, post creation, validation, contribution caps, and persistence.

The Phaser client may call `/api` endpoints directly, but it must not be trusted. The server validates every mutation and clear event.

---

## How to Know It's Working

- `npm run type-check` passes.
- `npm run lint` passes.
- `npm run build` passes.
- `npm run dev` uploads and installs the app to `r/fallstack_dev`.
- The playtest URL opens an interactive post flow with the inline entrypoint and expanded game entrypoint.
- The expanded entrypoint renders a Phaser canvas, not a blank iframe.
- `/api/init-game` returns seed/user/state data from the Devvit server.
- A server-side Redis read/write smoke test succeeds.
- `docs/devvit-feedback-log.md` has at least one setup entry.

The post does not need full gameplay yet. A launch screen plus a static Phaser scene and proven `/api` state path is enough for Phase 01.

---

## Files to Create or Normalize

| File | Purpose |
|---|---|
| `devvit.json` | Devvit Web app config, entrypoints, menus, triggers |
| `package.json` | Dependencies and build scripts |
| `tsconfig.json` | TypeScript project references |
| `src/client/splash.html` | Inline feed entrypoint |
| `src/client/splash.ts` | Lightweight launch screen |
| `src/client/game.html` | Expanded game entrypoint |
| `src/client/game.ts` | Phaser bootstrap |
| `src/client/game.css` | Game viewport styles |
| `src/client/scenes/` | Phaser scenes |
| `src/server/index.ts` | Hono server entry point |
| `src/server/core/post.ts` | Custom post creation |
| `src/server/routes/api.ts` | Client/server API endpoints |
| `src/server/routes/menu.ts` | Subreddit menu action |
| `src/shared/api.ts` | Shared API request/response types |
| `src/shared/game/` | Pure game logic, once extracted |
| `docs/devvit-feedback-log.md` | Platform feedback log |

---

## What This Phase Does NOT Build

- Final player movement or physics.
- Tower geometry or collision.
- Camera follow behavior.
- Fall detection and respawn.
- Full mutation persistence.
- Artifact rendering.
- Result card.
- Sound.
- Submission packaging.
