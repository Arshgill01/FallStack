# Fallstack Final-Pass QA Report

Date: 2026-07-15 UTC

Build: local production client at `http://127.0.0.1:8080/game.html`
Result: pass, with hosted-Devvit and physical-device limitations listed below.

## Final result

| Area | Evidence | Result |
| --- | --- | --- |
| Full climb | Real keyboard input from spawn through all 154 route platforms | Summit reached in 180 jumps and 3m20s |
| Progression | 12 zones, 11 checkpoint clears, 2 falls and recoveries | Consistent through the entire tower |
| Shared mutation | Two independent browser contexts on one in-memory `r/FallStack` daily board | r37→r39 propagated safely |
| Collision-safe sync | Second climber fetched r39 while airborne | Stayed on r37 until recovery, then applied r39 |
| Visible influence | Two First Gap falls crossed the artifact threshold | Remote Mercy Nail and board beat rendered |
| Reload | Second client reloaded after reconciliation | Board and artifact remained at r39 |
| Mobile opening | 320×568 and 375×812 | Player, first foothold, mutation proof, and controls remain readable |
| Touch | Browser-level touch start/end events | Movement and charge-release launch passed; inputs released |
| Reduced motion | `prefers-reduced-motion: reduce` | Camera snapping and zero charge/landing particles verified |
| Frame pacing | Final Canvas renderer, 375×812 VM browser | 16.7ms median, 16.8ms p95, zero frames over 34ms |
| Automated checks | TypeScript, ESLint, Node tests, Vite build | Pass; 113/113 tests |

The opening jump geometry is unchanged. A regression test freezes the first eight route platforms by ID, x, width, and height from the floor. The work shortened checkpoint segments and repaired generated collision traps without making that opening easier.

## Shared-scope contract

The implemented promise is one subreddit-scoped daily tower:

- The board ID is derived from subreddit installation identity, UTC date, and tower version.
- Shared UI names the actual scope, for example `r/FallStack shares one daily tower`.
- Local fallback says `Local practice only` and explicitly states that it does not change the shared tower.
- Remote snapshots are polled by revision and deferred while a climber is airborne. They apply on a safe landing or recovery so geometry never changes under the player.
- A fall can therefore change what another member of that subreddit climbs next; the game does not claim per-frame simultaneous physics.

## Closed findings

| ID | Finding | Resolution | Status |
| --- | --- | --- | --- |
| FP-001 | Mobile mutation message covered spawn | Moved beneath the zone label, raised text to 12px, and dismisses on charge | Closed |
| FP-002 | Moving tower was flatter than the shell | Smooth rendering, larger climber, denser architecture, material seams, braces, and depth planes | Closed |
| FP-003 | Shared scope was ambiguous | Runtime copy names the subreddit; local mode makes no sharing claim | Closed |
| FP-004 | Expected local fallback logged an app error | Downgraded to an explicit local-practice warning | Closed |
| FP-005 | 659-platform route was impractically long | 154-platform finite route with roughly twelve jumps per checkpoint | Closed |
| FP-006 | Obstacle posts blocked baseline approaches | Posts now dress the landing's outer edge and are sampled across seeds | Closed |
| FP-007 | Centered checkpoints formed underside ceilings | Checkpoints expose an entry lane while retaining safe x=240 respawn coverage | Closed |
| FP-008 | Ricochet walls sealed normal landings | Walls are shortened and lifted above the baseline lane | Closed |
| FP-009 | Boundary ledges stacked beneath checkpoints | Near-boundary ledges coalesce or retain at least 96px clearance | Closed |
| FP-010 | Summit connector and summit formed final underside traps | Final approach alternates to an exposed side with validated vertical clearance | Closed |
| FP-011 | Reduced motion still emitted landing and wall dust | Both emitters are suppressed and existing particles clear when reduction turns on | Closed |
| FP-012 | AUTO selected slow software WebGL in the VM | Explicit Canvas 2D renderer holds 60fps on the final vector scene | Closed |

## Reproduction commands

From `fallstack/` with the built client served on port 8080:

```sh
npm test
npm run lint
npm run build
npm run qa:runtime
npm run qa:shared
npm run qa:playthrough -- --retries 40 --max-jumps 1200
```

Selected final evidence:

- `full-playthrough-07-final/screenshots/00-opening.png`
- `full-playthrough-07-final/screenshots/zone-143-event-horizon-crown.png`
- `full-playthrough-07-final/screenshots/99-summit.png`
- `shared-session-06-final/shared-session.json`
- `shared-session-06-final/alice-mutated.png`
- `shared-session-06-final/bob-reconciled.png`
- `runtime-smoke-06/runtime-smoke.json`
- `runtime-smoke-06/touch-airborne.png`
- `runtime-smoke-06/reduced-motion.png`

The much larger per-jump playthrough trace is retained locally and can be regenerated with the command above; it is intentionally excluded from source control.

## VM limitations and remaining risk

- No app was deployed, published, made public, or connected to external Reddit state. This was deliberate.
- The VM can fully test the game, touch emulation, multi-client browser behavior, pure server validation, transaction tests, reconciliation, reloads, and rendering. It cannot prove the final Reddit iframe/auth/network path without a hosted Devvit playtest session.
- The shared browser harness uses the real client plus the project's validation, fall resolution, mutation plan, receipt, board snapshot, and artifact derivation code. Its HTTP transport is in-memory. Redis concurrency/idempotency is covered separately by the server test suite, not by that browser harness.
- A physical iPhone was unavailable. Browser-level touch events and iPhone-sized viewports passed, but Safari compositor/audio behavior still deserves a physical-device smoke test before release.
- The static file server naturally returns one 404 for `/api/init-game`; the app handles it as local practice. The application no longer emits an error-level `init-game failed` log.
- Vite still reports the known expanded-game chunk warning above 500kB. Phaser remains isolated to the expanded entrypoint, so this does not burden the inline splash, but network loading on a hosted post remains worth measuring.
