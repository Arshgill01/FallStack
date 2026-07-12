# Design redesign status

## Objective

Replace the disconnected programmer-art presentation with one coherent compact cursed diorama, using Figma for composition, one selected asset provider for controlled source art, Phaser Editor for scene/prefab proof, and the repository-native art-director workflow for stage control.

## Current gate

Full expanded-game migration after the opening-zone quality gate. The Lower Ruins slice passed its browser interaction, scorecard, and project checks; the same grammar may now extend through Bell Shaft and Moon Roof.

The complete production execution path is defined in [`EXECPLAN.md`](EXECPLAN.md). It covers the art bible, controlled asset bake-off, Phaser proof, opening-zone quality gate, full three-zone migration, inline splash, responsive/accessibility/performance validation, and final handoff.

## Completed

- Official Figma plugin is installed locally and enabled in `~/.codex/config.toml`.
- Repository-native `fallstack-art-director` skill and weighted scorecard created.
- Toolchain responsibilities, provider bake-off, and stage gates documented.
- Existing screenshot automation and production scripts identified.
- Production build passed and the pulled baseline was recaptured at splash, mobile, desktop, and large viewports.
- Baseline evidence: `docs/screenshots/test_splash.png`, `test_mobile.png`, `test_desktop.png`, and `test_fullscreen.png`.
- Gate 2 Figma file created: [Fallstack — Gate 2 Mobile Directions](https://www.figma.com/design/h24S9x4pxMjPaVyj5LqrSk).
- Three native 375×812 direction frames completed on the `Directions` page:
  - `A — Shrine Spine` (`2:86`): narrow central tower, stacked physical strata, labels pinned to ledges, controls as plinth.
  - `B — Split Shaft` (`2:87`): opposing walls and diagonal route, vertical status rail, mutation evidence embedded in the gap.
  - `C — Cutaway Reliquary` (`2:88`): framed architectural cutaway, focal community relic, foreground plinth and in-world feedback plaque.
- All three directions show existing community mutation before input, an opening jump affected by an artifact, fixed mobile controls, and concrete first-fall feedback.
- Local Figma foundations created for the direction study: 29 scoped variables, five product text styles, two tactile depth styles, and reusable `Touch Control` / `Stamped Label` components.
- Gate 3 user selection recorded: Direction C, `Cutaway Reliquary`, is selected. Direction A was rejected; Direction B was considered decent but not selected.
- Selected frame refined and renamed `SELECTED — Cutaway Reliquary v2` (`2:88`): fixed the overlapping top title/status, retained the top HUD, strengthened the alternating route, added a Mercy Nail alternative, made one shelf visibly cursed, and deepened the primary ledge underfaces.
- Implementation-grade repository art bible created at [`art-bible.md`](art-bible.md). It locks exact palette/value roles, materials, platform and five-artifact silhouettes, player states, type/copy constraints, label placement, responsive geometry, depth, motion/reduced-motion substitutions, audio, accessibility, feedback hierarchy, asset/runtime budgets, forbidden patterns, and the required Figma state matrix.
- M0 implementation-start audit complete: tracked changes remain limited to the baseline screenshots and capture harness; `.agents/` and `docs/design-redesign/` remain untracked current-work files. No production source overlaps were found, and the current production build passes with the known large-chunk warning.
- Gate 4 art bible complete. Figma page `Art Bible` (`14:2`) contains eight 375×812 state frames—seeded pre-input, charge, airborne, first fall, respawn +1, checkpoint, cursed shelf active, and result—plus two 1280×800 desktop adaptations. Representative mobile and desktop frames were screenshot-validated after correcting an off-canvas reparenting defect; the selected source frame `2:88` was not modified.
- Gate 5 equal-brief package locked in [`asset-bakeoff.md`](asset-bakeoff.md): identical Scenario/Layer prompt, output cells, hard failures, normalization procedure, weighted provider scorecard, run record, and repository-native fallback. No paid action was taken.
- Gate 6 repository-native Phaser proof integrated. New focused modules own the selected palette/motion contracts, platform family, all five artifact silhouettes, and relic-bearer presentation. The scene still owns physics and calls these renderers with existing tower/artifact data; collision bodies, movement, event payloads, API calls, and persistence were not changed.
- Phaser dependency state repaired from an invalid local `4.2.0` install to the declared `4.2.1`; `package-lock.json` now resolves the required runtime.
- Production proof captures show the reliquary cavity/arches, expanded desktop architectural surround, thick platform underfaces, distinct cursed/Mercy silhouettes, and the new player at mobile and desktop sizes. Reduced-motion browser proof is archived at [`phaser-proof-reduced-motion.png`](phaser-proof-reduced-motion.png).
- Opening-zone vertical slice complete. The production shell now uses the top title/status-seal composition, `Lower Ruins` visual naming, architectural cavity/frame, relic-bearer poses, Cutaway platform/artifact renderers, attached labels, fixed mobile controls, and a bottom persimmon mutation plaque. Twelve persistence/checkpoint segments map deterministically onto the three approved visual zones without changing IDs or stored authority.
- Real opening interaction evidence is archived at [`opening-first-fall.png`](opening-first-fall.png): browser-driven hold/release input produced a fall, incremented Falls from 37 to 38, showed concrete feedback without obscuring the route, and respawned the player at the start. The exposed noncanonical `Cursed Helper` copy was corrected to the canonical `Cursed Brick` taxonomy.

## Gate 3 scorecard

Scores use the repository visual scorecard. Direction C is scored after the selected v2 refinement.

| Criterion | Weight | A — Shrine Spine | B — Split Shaft | C — Cutaway Reliquary v2 |
| --- | ---: | ---: | ---: | ---: |
| Shared-mutation comprehension in 10 seconds | 20 | 4 | 4 | 5 |
| Tower dominance and scene composition | 15 | 3 | 4 | 5 |
| Tactile material identity and depth | 15 | 2 | 3 | 4 |
| Artifact and collision readability | 15 | 3 | 4 | 5 |
| Opening jump and first-fall feedback | 15 | 4 | 4 | 5 |
| Mobile controls and accessibility | 10 | 4 | 4 | 4 |
| System coherence | 5 | 3 | 3 | 4 |
| Implementation and runtime cost | 5 | 4 | 4 | 4 |
| **Weighted total** | **100** | **67** | **76** | **93** |

Direction C wins because the tower reads as a physical object, community mutation is the focal relic rather than detached HUD copy, all four collision classes are visible by shape, and the composition remains feasible with Phaser geometry plus cleaned source art. Direction B contributed its alternating consequence rhythm and Mercy Nail route option; its left status rail was explicitly not carried forward.

## Selected visual grammar

- Framed architectural cutaway: the tower is presented as a compact reliquary/diorama, not a full-bleed abstract playfield.
- Top status only: title at top-left, compact daily status seal at top-right; no left dashboard rail.
- Alternating climb rhythm: left/right ledges make the intended route legible without arrows or tutorial overlays.
- Artifacts live in the architecture: Corpse Stack, Ghost Platform, Cursed Brick/shelf, Lantern Trail, and Mercy Nail use distinct silhouettes and collision meanings.
- Thick indigo structure, burgundy cavity, washi frame, persimmon feedback, and restrained gold artifact accents.
- Mutation copy is stamped or engraved near its object; first-fall feedback uses the bottom persimmon plaque and does not cover a jump.
- Chunky ledge underfaces and foreground piers supply depth; decoration must not obscure collision edges.

## Baseline findings

- The first viewport now communicates community failure, but the labels look pasted onto the playfield instead of belonging to the tower.
- Platforms, artifacts, and background depth remain mostly flat procedural shapes with inconsistent material cues.
- The mint shell/controls and burgundy celestial playfield read as separate visual systems.
- The mobile tower is dominant and controls are reachable, but the upper HUD is dense and the scene lacks a strong physical focal hierarchy.
- Artifact semantics are explained by text more strongly than by silhouette, material, or state treatment.

## Account handoffs

- Figma OAuth and callable MCP access are now working; the previous Gate 2 tool-injection blocker is resolved.
- Sign in to Phaser Editor to download the Core/Linux editor. Verify Phaser 4.2.1 compatibility before adopting generated scenes.
- Scenario and Layer require account/API access for the paid bake-off; no subscription should be selected until equal prompts are scored.

## Gate record

| Gate | State | Exit evidence |
| --- | --- | --- |
| Baseline | Complete | Fresh splash/mobile/desktop captures and passing build |
| Three Figma directions | Complete | Native Figma file plus validated 375×812 frames `2:86`, `2:87`, and `2:88` |
| Direction selection | Complete | Weighted scorecard, explicit user selection, and selected v2 frame `2:88` |
| Art bible | Complete | [`art-bible.md`](art-bible.md), Figma page `14:2`, eight mobile states, two desktop adaptations, representative screenshot validation |
| Provider bake-off | In progress | Equal brief/fallback locked; Scenario/Layer outputs require authenticated paid access |
| Phaser compatibility proof | Complete | Phaser 4.2.1, procedural fallback modules, browser captures, reduced-motion proof, full checks |
| Opening-zone vertical slice | Complete | Real first-fall/respawn capture, 90/100 scorecard, 48 tests, full checks |
| Full expanded-game migration | Complete | Distinct three-zone contracts, checkpoint/summit/platform families, reliquary loading/controls/results, mobile/desktop browser evidence, 49 tests |

## Validation log

- `git pull --ff-only` — passed; fast-forwarded `master` from `b846409` to `27fd626`.
- `python3 .../quick_validate.py ../.agents/skills/fallstack-art-director` — passed.
- `npm run build` — passed with the existing large-chunk warning.
- `npx playwright install chromium` — passed; installed the matching local browser runtime.
- `node take_screenshots.js` against `python3 -m http.server 8080 -d dist/client` — passed; generated all four baseline captures.
- `codex mcp login figma` — passed; OAuth completed and `codex mcp list` reports `figma ... enabled ... OAuth`.
- Post-restart tool inventory (2026-07-13) — failed Gate 2 access check; zero callable tools matched Figma despite the enabled OAuth MCP entry.
- Computer Use fallback (2026-07-13) — failed before app inspection with `Sky Computer Use native pipe startup failed`; no Figma file or UI state was changed.
- Figma `whoami` (2026-07-13) — passed; authenticated as Arshdeep Singh with one available student team plan.
- Figma file creation (2026-07-13) — passed; created design file `h24S9x4pxMjPaVyj5LqrSk`.
- Figma foundations validation (2026-07-13) — passed after fixing an initially clipped 1 px foundations root; final foundations frame is 1200×443 with correct Shippori Mincho and Zen Maru Gothic rendering.
- Gate 2 direction screenshots (2026-07-13) — passed at exact 375×812 for all three frames. Direction B exposed a contextual touch-control instance rendering defect; the affected row was replaced with equivalent bound primitives and revalidated successfully.
- Gate 3 selected-direction refinement (2026-07-13) — passed at 375×812. The title/status overlap was removed; the selected frame now includes a clearer alternating route, distinct cursed shelf, Mercy Nail option, and deeper ledge silhouettes without moving status away from the top.
- Comprehensive redesign ExecPlan audit (2026-07-13) — passed; no existing `PLANS.md` template or complete redesign plan existed. Created `docs/design-redesign/EXECPLAN.md` with milestones M0–M8 and full-surface exit criteria.
- M0 worktree audit (2026-07-13) — passed; `git status --short`, `git diff --stat`, and `git diff -- fallstack/take_screenshots.js` confirm the current tracked changes are the baseline capture evidence/harness and do not overlap production source.
- `npm --prefix fallstack run build` (2026-07-13) — passed in 907 ms; existing `>500 kB` chunk warning remains and is explicitly budgeted for comparison during M3/M7.
- Gate 4 Figma state validation (2026-07-13) — passed for mobile pre-input `14:3`, mobile first-fall `14:165`, repaired result `17:42`, desktop pre-input `17:102`, and repaired desktop first-fall `17:246`. The top title/status keep a clear gap, feedback stays outside the jump corridor, result content remains inside the reliquary, and desktop extends the architectural surround without a side dashboard.
- Gate 4 weighted scorecard (2026-07-13) — 89/100: shared mutation 5/5, tower composition 4/5, tactile depth 4/5, collision readability 5/5, opening jump/feedback 5/5, mobile/accessibility 4/5, coherence 4/5, runtime feasibility 4/5. No first-five criterion is below 4.
- `npm install` (2026-07-13) — passed; repaired the invalid Phaser 4.2.0 local install. `npm ls phaser --depth=0` now reports `phaser@4.2.1`.
- M3 checks after dependency repair (2026-07-13) — `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` all passed; 47 tests passed. Build retains the known chunk warning. `dist/client/game.js` is 1,448,088 bytes uncompressed; procedural proof adds no texture payload or texture memory.
- M3 production screenshot harness (2026-07-13) — `node take_screenshots.js` against `python3 -m http.server 8080 -d dist/client` passed at splash, 375×812, 1280×800, and fullscreen sizes. Local `/api/init-game` returns the expected 404 and the existing local snapshot fallback renders.
- M3 reduced-motion browser proof (2026-07-13) — `agent-browser` emulated 375×812 with `prefers-reduced-motion: reduce`; runtime evaluation returned `{ reducedMotion: true, canvases: 1 }`, the accessibility snapshot exposed result/audio/three climb controls, and the screenshot was saved to `docs/design-redesign/phaser-proof-reduced-motion.png`.
- M4 first-fall browser smoke (2026-07-13) — Playwright drove real `ArrowRight` plus held/released `Space` through the Phaser scene. DOM evidence changed community Falls `37 → 38`; the live plaque read `Your fall counted here. 1 more helper slip spawns Cursed Brick.` after the taxonomy fix; the player visibly respawned on the start platform.
- M4 weighted scorecard (2026-07-13) — 90/100: shared mutation 5/5, tower composition 5/5, tactile depth 4/5, collision readability 4/5, opening jump/feedback 5/5, mobile/accessibility 5/5, coherence 4/5, runtime feasibility 5/5. No first-five criterion is below 4.
- M4 project checks (2026-07-13) — `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` passed; 48 tests passed. The known large-chunk warning remains for M7 measurement.
- M5 three-zone migration (2026-07-13) — Lower Ruins uses broad repaired arches and washi-edged stone; Bell Shaft uses narrow bound piers, hanging bell lines, riveted metal ledges; Moon Roof uses open roof teeth, spectral traces, and ghost-edged moonstone. The mapping remains presentation-only over the existing twelve persistence segments and five platform kinds.
- M5 expanded-state migration (2026-07-13) — checkpoint gates, summit reliquary, loading state, charge meter, fixed touch controls, checkpoint plaque, and daily result now share the washi/indigo/burgundy/persimmon/gold grammar. Existing sound events, result data, tower geometry, collision bodies, and event authority are unchanged.
- M5 browser proof (2026-07-13) — production build rendered at 375×812 and 1280×800. Archived `m5-mobile.png`, `m5-result-mobile.png`, and `m5-desktop.png`; the accessibility tree exposed the tower, status, progressbar, result dialog, and all three touch controls. Measured touch targets were 52×50, 190×50, and 52×50 CSS px.
- M5 project checks (2026-07-13) — `npm run type-check`, `npm run lint`, `npm test`, and `npm run build` passed; 49 tests passed. The known large-chunk warning remains for M7 measurement.
- No repository build, test, lint, or type-check was run for Gate 2 because production code was not changed.
