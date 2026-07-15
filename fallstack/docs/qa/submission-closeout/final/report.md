# Submission Closeout QA Report

Date: 2026-07-15 UTC  
Build: local production client at `http://127.0.0.1:8080/game.html`  
Result: repository-ready; hosted Reddit and first-time-human gates remain external.

## Product verdict

Fallstack now proves the intended v1 concept as one subreddit sharing one daily tower. Any member of that installed community can leave an accepted fall, clear, or summit that changes the authoritative daily board and what another member sees or climbs. Realtime transports revision hints; Redis remains authoritative, and airborne clients defer the resulting geometry until a safe point.

This is asynchronous shared mutation, not shared live physics, and it is not a global cross-Reddit board. UI and reviewer copy now use that precise scope. Local practice explicitly says that it writes no shared marks.

## Final evidence

| Area | Evidence | Result |
| --- | --- | --- |
| Complete game | Real keyboard input over all 154 route platforms | Summit reached in 153 jumps and 2m43s |
| Progression | 12 zones, 11 clears, 1 fall and recovery, 1 summit | Consistent through the entire tower |
| Shared mutation | Two independent browser contexts on one daily board | r37 to r39 propagated safely |
| Safe reconciliation | Second climber received a newer board while airborne | Stayed at r37 until safe, then applied r39 |
| Visible consequence | Two First Gap falls crossed the artifact threshold | Remote Mercy Nail and mutation beat rendered |
| Persistence behavior | Reload after reconciliation | Board and artifact remained at r39 |
| Touch | Browser-level touch start/end at 375x812 | Move and charge-release launch passed; input released |
| Reduced motion | `prefers-reduced-motion: reduce` | Enabled with zero charge particles |
| Frame pacing | Canvas renderer at 375x812 in the VM | 16.7ms median, 16.8ms p95, zero frames over 34ms |
| Automated gates | TypeScript, Node, ESLint, Vite | 135/135 tests pass; lint and build pass |

Selected artifacts:

- `playthrough-pass/playthrough.json` — every attempted landing, event, and final scene state.
- `playthrough-pass/screenshots/00-opening.png` — unchanged opening route.
- `playthrough-pass/screenshots/zone-078-pulsar-spine.png` — representative moving-game frame.
- `playthrough-pass/screenshots/99-summit.png` — completed Tower Memory and Reddit handoff actions.
- `shared/shared-session.json` — two-client propagation, airborne defer, reload, and artifact proof.
- `runtime/runtime-smoke.json` — touch, reduced-motion, local-fallback, and frame-pacing proof.

## Findings closed during the complete run

| Finding | Resolution |
| --- | --- |
| Restoring a bottom checkpoint marked later zones complete because render order was mistaken for climb order | Resume restoration now uses canonical progression order and has a regression test |
| Optional ricochet geometry overlapped a baseline landing | Route-overlapping obstacles are rejected and sampled across 240 seeds |
| A late landing depended on a few pixels of world-wall luck | Later route landings retain a fixed side margin, sampled across 160 seeds |
| Checkpoint undersides could catch a valid jump exactly at its apex | Checkpoints are one-way from below and solid while descending from above |
| The QA controller itself approached solid undersides with only four pixels of clearance | The controller now preserves a full player-width approach margin |

The protected first eight route platforms were not changed. The opening still retains its deliberate trial-and-error identity.

## Reddit lifecycle closeout

- Authenticated daily checkpoint resume is server-derived, monotonic, per-user, and reset by the next UTC board.
- Anonymous shared play remains session-only; disclosed local practice uses device-local daily progress.
- A scheduled `00:05 UTC` task and moderator action share one idempotent daily-post creator.
- Daily post text fallback, board identity, yesterday-memory line, and post URL are bounded and validated.
- Tower Memory separates Return, Discuss, and Copy result. It never auto-posts a comment.
- Every accepted mutation persists before a best-effort Realtime hint; polling and visibility refresh recover missed hints.
- Opening scars are kept separate from organic community activity in player-facing language.

## Commands run

From `fallstack/`, with `dist/client` served on port 8080:

```sh
npm run qa:playthrough -- --url http://127.0.0.1:8080/game.html --output docs/qa/submission-closeout/final/playthrough-pass --max-jumps 1500 --retries 12
npm run qa:runtime -- docs/qa/submission-closeout/final/runtime
npm run qa:shared -- docs/qa/submission-closeout/final/shared
npm test
npm run lint
npm run build
```

## Remaining external gates and risks

- No app was deployed, published, or connected to new production Reddit state in this pass. The daily scheduler, post creation, authenticated context, Redis, Realtime transport, navigation, and modmail URL still require one final installed Devvit smoke test.
- Five independent first-time participants have not completed the comprehension protocol. The blank evidence sheet remains intentionally blank; automated agents do not count as human evidence.
- A physical iPhone was unavailable. Chromium mobile touch and viewport behavior pass, but iOS Safari compositor, audio unlock, Reddit in-app focus, and safe-area behavior still deserve a physical-device smoke test.
- Local static hosting produces the expected failed `/api/init-game` request before entering disclosed local practice. It is warning-only and is not representative of an installed post.
- Vite reports the known expanded-game chunk warning above 500kB. Phaser remains outside the lightweight inline entrypoint, but hosted cold-load timing should be measured once more on the installed post.

These are verification gates, not missing repository implementation. A clean submission green light should be given after the installed Reddit smoke and five-person comprehension gate pass.
