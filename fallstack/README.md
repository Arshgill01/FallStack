# Fallstack

Fallstack is a shared daily mutation game for Reddit, expressed as a compact precision climber. Everyone in one subreddit climbs the same UTC-day tower. Aggregate falls and clean clears alter named sites, so one member can change what the next member sees and plays.

The tower—not a dashboard—is the product. The opening viewport identifies the subreddit scope, shows a generated opening scar at the first gap, and explains its physical consequence in place. Player-caused activity is reported separately from generated opening scars.

## Play

- Desktop: Left/Right arrows move or face. Hold Space, then release to leap. Arrows nudge the arc in flight.
- Mobile: fixed Left, Jump, and Right controls. Hold Jump, then release.
- Falling below the current recovery line records one fall and returns the player to the latest checkpoint.
- Crossing a zone boundary records a clean clear and advances the daily checkpoint.
- Authenticated players resume that checkpoint on the same daily board. Anonymous shared play is session-only; local practice keeps a disclosed device-only daily checkpoint.

The opening jump intentionally keeps its trial-and-error character. The generated tower is finite, retains a default artifact-free route, and ends at a summit.

## Shared-board contract

- Scope: one subreddit installation, one UTC date, one tower version.
- Authority: Redis stores aggregate counters, receipts, achievements, recent visible mutations, daily player checkpoints, and the daily-post record.
- Trust boundary: the server derives Redis keys, authenticated identity, display names, impact sites, and checkpoint destinations. The client supplies bounded play observations, never persistence identifiers.
- Synchronization: an accepted mutation persists first, then sends a best-effort Devvit Realtime revision hint. Clients fetch the authoritative snapshot and defer geometry changes until a safe landing. A 15-second revision poll and visibility refresh recover missed messages.
- Privacy: failures remain aggregate/anonymous. Positive achievements may show a Reddit username. Daily board data expires after 72 hours; the idempotent post record is retained for eight days. No external analytics or paid service is used.

The app promises a shared mutable tower, not synchronized per-frame multiplayer physics.

## Reddit lifecycle

`devvit.json` schedules one daily post at `00:05 UTC`. The scheduler and moderator menu use the same Redis `SET NX` lease, so concurrent or repeated requests submit at most one post for the installation/date/version. A failed Reddit submission releases its lease for retry.

Each post includes:

- the lightweight inline entrypoint and expanded Phaser game;
- a dated subreddit-scoped title and bounded post data;
- a plain Markdown fallback with controls and a Reddit-native support route;
- a truthful prior-day memory line derived from retained organic activity;
- matching light/dark loading colors and a tall post height.

At the summit, Tower Memory provides separate Return, Discuss, and Copy result actions. It never posts a comment automatically.

## Architecture

| Layer | Responsibility |
| --- | --- |
| `src/shared/game` | Deterministic tower generation, mutation derivation, validation, receipts, movement/progression contracts |
| `src/client` | Phaser physics/rendering, React shell, input, safe reconciliation, Realtime subscription |
| `src/server` | Devvit context, Redis transactions, event persistence, daily post lifecycle, Realtime revision publishing |

The inline splash does not import Phaser. Shared game logic remains testable without launching Devvit or a browser.

## Local verification

Requirements: Node.js 22.2 or newer and the dependencies in `package-lock.json`.

```sh
npm install
npm test
npm run lint
npm run build
```

Additional browser harnesses expect the built `dist/client` directory to be served at `http://127.0.0.1:8080`:

```sh
npm run qa:runtime
npm run qa:shared
npm run qa:audio
npm run qa:audio-lifecycle
npm run qa:world-bounds
npm run qa:playthrough -- --retries 40 --max-jumps 1200
```

`qa:audio` records the built game's final Web Audio master through a
query-gated browser seam, verifies that it contains a non-silent audio stream,
and writes an FFprobe-backed report beside the WebM artifact.
`qa:audio-lifecycle` checks preference migration, single-context ownership,
immediate SFX mute, rapid Music toggles, and closed-context recovery.

`npm run dev`, `npm run deploy`, and `npm run launch` interact with Reddit/Devvit. They are intentionally not part of local verification and should only be run by an authenticated maintainer who intends that external change.

## Evidence and release gates

- Final automated/browser evidence: [`docs/qa/final-pass/report.md`](docs/qa/final-pass/report.md)
- Closeout contracts: [`docs/submission-closeout/architecture.md`](docs/submission-closeout/architecture.md)
- First-time-player protocol: [`docs/shared-mutation/comprehension-test.md`](docs/shared-mutation/comprehension-test.md)
- Blank human evidence sheet: [`docs/submission-closeout/comprehension-evidence.md`](docs/submission-closeout/comprehension-evidence.md)

Automated tests can prove finite play, input, rendering, persistence rules, two-client propagation, and rollover behavior. They cannot substitute for five independent first-time participants. That human comprehension result remains an explicit external release gate until the blank sheet is completed with real observations.

## Support

In an installed shared post, use **Tower Memory → Report a problem via subreddit modmail**. The text fallback includes the same Reddit-native modmail route. For source-level defects, include the UTC date, device/viewport, expected behavior, actual behavior, and reproduction steps.

Current development subreddit: `r/fallstack_dev`. Devvit Web API/CLI version: `0.13.7`.
