# Mobile release-hardening report

Date: 2026-07-16

Primary viewports: 320×568, 375×812, 1280×800

Browser engines: Chromium and WebKit 26.5

## Outcome

The reported post-fall loop was reproduced against the production build and fixed at two Phaser lifecycle seams:

1. Respawn moved the GameObject but did not reset the Arcade Physics body's previous-frame state. A deliberate first fall produced a second fall event without a launch in 9 of 10 fresh 375×812 contexts. Respawn now uses `Body.reset(...)`; the same ten-run loop then produced exactly one fall in all 10 contexts.
2. Restoring a saved checkpoint changed the player/camera zone without rebuilding that zone's static platform bodies. The player briefly crossed into the prior zone before the checkpoint body appeared. Respawn now rebuilds the active platform bodies before simulation resumes, and the restored WebKit run remained grounded in `ring_citadel` before input.

The first fix was uploaded and installed as `fallstack v0.0.22` on `r/fallstack_dev` after the targeted and full-climb gates passed. The complete build, including the checkpoint-body and palette commits, was then uploaded and installed as `fallstack v0.0.23`; an independent installation listing confirmed that exact version.

## Reproduction and recovery evidence

| Probe | Before | After |
| --- | ---: | ---: |
| Fresh deliberate-fall contexts | 10 | 10 |
| Runs with an unintended second fall before input | 9 | 0 |
| Fall-event counts | `2,2,2,2,2,2,2,1,2,2` | `1,1,1,1,1,1,1,1,1,1` |
| Touch-driven fall events in one recovery | — | 1 |
| Grounded after touch recovery | — | yes |
| Movement and launch accepted after recovery | — | yes |

The red browser regression failed with `Respawn emitted 1 duplicate fall event(s) before the next launch`. The fixed regression checks the new attempt ID, grounded checkpoint state, absence of another fall before launch, and successful continuation.

## Complete playthroughs

All six recorded production-build routes reached the summit through real Phaser movement; the driver does not teleport between ledges.

| Engine and path | Viewport | Jumps | In-run falls | Elapsed |
| --- | ---: | ---: | ---: | ---: |
| Chromium fresh + opening fall | 375×812 | 158 | 4 | 167.8 s |
| Chromium compact + reduced motion + opening fall | 320×568 | 160 | 5 | 170.7 s |
| Chromium restored Bell Shaft | 375×812 | 102 | 0 | 108.0 s |
| Chromium desktop fresh | 1280×800 | 155 | 1 | 161.4 s |
| WebKit fresh + opening fall | 375×812 | 156 | 3 | 164.5 s |
| WebKit restored Bell Shaft + opening fall | 375×812 | 103 | 0 | 111.7 s |

The final WebKit restored run proved the saved checkpoint, deliberate fall, same-checkpoint recovery, continued input, remaining zone transitions, and summit in one session. Browser reports contain no page exceptions. The local static server's `/api/init-game` 404 is expected and exercises the disclosed local-practice fallback.

## Opening movement measurement

Five fresh Chromium touch contexts recorded 120 normal-motion frames each:

- median frame interval: 16.7 ms;
- p95: 17.4–17.5 ms;
- frames over 34 ms: zero;
- warm 140 ms ground move: 28.5 logical pixels in all five runs;
- post-respawn 140 ms ground move: 28.5 logical pixels in all five runs;
- launch velocity: approximately -831 px/s in the final repeated runs.

The first 140 ms probe varied between 23.0 and 26.2 pixels because it begins on the same render boundary that enables the React controls; the immediately repeated and post-respawn measurements are identical. Removing the audio-unlock listener did not change that result. Complete-playthrough launch/landing cadence did not show a multi-jump physics ramp, so movement constants were not retuned without evidence. WebKit's pointer-control pass likewise stayed stable between its repeated and post-respawn samples (19.0/19.0) with p95 18 ms and no frame over 34 ms; Playwright uses its mouse pointer driver for held WebKit controls, so its absolute displacement is not compared to Chromium's CDP touch driver.

## Visual-zone proof

The three presentation zones retain one Cutaway Reliquary structure and global collision semantics, but no longer reuse one magenta/burgundy field:

- Lower Ruins: warm earthen burgundy, repaired stone, ember-gold trim;
- Bell Shaft: dark verdigris cavity, brass bindings, riveted metal;
- Moon Roof: cool lunar indigo, blue-lit stone, ghost-mint edges.

Typed palette tests require distinct outer, cavity, wall, platform, and route-edge colors for all three zones. Representative captures:

- `playthroughs/chromium-compact-reduced/screenshots/00-opening.png`
- `playthroughs/chromium-compact-reduced/screenshots/zone-052-ring-citadel.png`
- `playthroughs/chromium-compact-reduced/screenshots/zone-104-black-hole-chapel.png`
- `playthroughs/chromium-desktop-fresh/screenshots/zone-052-ring-citadel.png`
- `playthroughs/webkit-mobile-resumed-intro-fall/screenshots/99-summit.png`

The existing 96/100 Cutaway Reliquary score remains valid: this pass improves zone identification and coherence without changing the tower geometry, artifact silhouettes, UI hierarchy, fonts, or payload class.

## Installed/local relationship

- Initial installed version: `fallstack v0.0.21`.
- Emergency respawn hotfix installed and independently listed: `fallstack v0.0.22`.
- Complete release-hardening build installed and independently listed: `fallstack v0.0.23`.
- Hotfix commit: `2dddaf5`.
- Additional verified checkpoint lifecycle commit: `a54cb32`.
- Palette commit: `316c14b`.

Devvit reported `v0.0.23` built successfully at `2026-07-16T14:55:01.994Z`. This version contains all three commits above; `v0.0.22` contained only the urgent body-reset hotfix.
