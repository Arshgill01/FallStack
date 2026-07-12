# Cutaway Reliquary production redesign ExecPlan

This is the living execution plan for carrying the selected `Cutaway Reliquary v2` direction from Figma through a production-ready Fallstack visual system. Update progress, decisions, evidence, and deviations as work proceeds. Do not skip a gate because later work appears straightforward.

## Outcome

Ship Fallstack as one coherent compact cursed reliquary across the inline splash, expanded game shell, full three-zone tower, all five community artifacts, mutation and checkpoint feedback, touch controls, results, responsive layouts, reduced-motion behavior, and Devvit-hosted runtime.

The redesign is complete only when the selected grammar materially beats the recorded baseline at Reddit iframe sizes without weakening movement feel, tower reachability, mutation comprehension, accessibility, performance, or the pure/client/server architecture split.

## Selected direction and non-negotiables

- Figma source: [Fallstack — Gate 2 Mobile Directions](https://www.figma.com/design/h24S9x4pxMjPaVyj5LqrSk), selected frame `2:88`, `SELECTED — Cutaway Reliquary v2`.
- The tower is a framed architectural cutaway/reliquary. It is the visual hero.
- Status stays at the top: title left, compact daily status seal right. Do not adopt Direction B's left dashboard.
- The climb reads as an alternating left/right physical route without tutorial arrows.
- Community artifacts are embedded in the architecture and distinguishable by silhouette and collision meaning before contact.
- Mutation labels are stamped, pinned, engraved, or otherwise physically attached near their object.
- First-fall feedback uses a compact persimmon plaque below the critical jump, never a modal or obstructive card.
- Use the washi, indigo, burgundy, persimmon, restrained gold, and ghost-mint grammar unless a documented accessibility adjustment requires a value change.
- Preserve the analog charge model, tower generation, checkpoint behavior, mutation rules, structured event flow, and server authority.
- Do not introduce new production dependencies, paid services, authentication changes, persistence changes, or infrastructure changes without explicit approval.

## Scope

### In scope

- A complete art bible derived from the selected direction.
- Figma refinement for the selected mobile viewport and required desktop/responsive adaptations.
- Equal-brief Scenario and Layer asset trials, normalized and scored, if account access is supplied.
- A provider-independent fallback using cleaned repository-owned vector/raster assets and Phaser drawing where provider access is unavailable or output fails the scorecard.
- Phaser 4.2.1 import, transparency, scale, atlas, and collision compatibility proof.
- A production asset manifest, provenance record, naming convention, export dimensions, and optimization budget.
- The full expanded game presentation: shell, top status, frame, tower background/depth layers, all zones, platforms, checkpoints, player, all five artifacts, in-world labels, mutation feedback, controls, result overlay, loading/error states, and audio/visual feedback treatment.
- The inline splash so feed and expanded views share the same world and promise.
- Responsive behavior for 375×812 mobile, 1280×800 desktop, and the existing large/fullscreen capture.
- Reduced motion, contrast, focus, touch-target, non-color semantics, and readable text validation.
- Browser screenshot comparison, gameplay smoke checks, project-native checks, and Devvit playtest evidence when available.
- Focused scene decomposition only where necessary to make the redesign testable and maintainable; no unrelated architecture rewrite.

### Out of scope unless separately approved

- New gameplay mechanics, physics models, zones, artifacts, game modes, progression systems, persistence schema, auth flow, monetization, or infrastructure.
- Bulk asset subscriptions or generation before the controlled bake-off passes.
- Replacing Phaser, changing the pure/client/server ownership split, or moving persistence into the client.
- Generic design-system expansion unrelated to Fallstack's shipped surfaces.

## Baseline and success measures

Use the existing evidence in `docs/screenshots/test_splash.png`, `test_mobile.png`, `test_desktop.png`, and `test_fullscreen.png` as the before state.

The final result must satisfy all of the following:

- Weighted repository visual scorecard at least 85/100 for mobile and desktop, with no first-five criterion below 4.
- A new player can identify existing community failure, its cause, and its consequence before input.
- The opening jump visibly benefits from or is altered by a community artifact.
- All five artifacts communicate solid, narrow-solid, semi-solid, hazardous, or visual-only behavior through shape and treatment rather than color alone.
- Controls remain at least 44 CSS px in the interactive dimension and do not hide a critical jump.
- First-fall mutation feedback appears within the established product timing and does not obscure play.
- The opening-zone route remains reachable without helpful artifacts; cursed artifacts do not block the only route.
- The selected visual system remains legible at 375×812 and does not become sparse or dashboard-like at 1280×800.
- Reduced-motion mode removes nonessential oscillation, parallax, shake, particles, and looping ambience while preserving state communication.
- No new client trust boundary, Redis write, event payload, or server-authority regression is introduced.
- Asset and code changes fit the existing Vite/Devvit bundle and do not introduce an unexplained material size or frame-time regression.

## Architecture and ownership

Keep the existing three layers intact:

- `src/shared/game/`: tower generation, mutation derivation, collision semantics, validation, and player-facing summaries. Visual work may add pure presentation metadata only when deterministic and rendering-independent.
- `src/client/game/` plus focused Phaser rendering modules: layout, input, collision, camera, display objects, particles, sound cues, and event emission. This layer consumes authoritative shared state but does not persist it.
- `src/client/game-app.tsx` and DOM shell: scene lifecycle, API integration, expanded shell, top status, touch controls, feedback surfaces, results, and accessibility state. Reduce its rendering burden with focused modules when required; do not perform a speculative full rewrite.
- `src/server/`: unchanged unless a verified display requirement exposes missing authoritative data. Any such change requires a separate risk review and server tests.

Expected focused client modules, created only when implementation reaches them:

- `src/client/game/art-direction.ts`: shared visual constants and scale rules mapped from the art bible.
- `src/client/game/assets.ts`: typed asset keys, atlas/frame contracts, preload helpers, and fallback handling.
- `src/client/game/renderTower.ts`: reliquary frame, depth layers, platform bodies, checkpoint architecture, and zone dressing.
- `src/client/game/renderArtifacts.ts`: five artifact renderers and state treatments, consuming existing `Artifact` data.
- `src/client/game/renderPlayer.ts`: player display/presentation separated from movement authority.
- `src/client/game/renderFeedback.ts`: in-canvas labels, plaques, and short-lived visual responses that do not own React or persistence state.

Do not create all modules preemptively. Extract each seam when its vertical slice proves the ownership boundary.

## Asset contract

Every adopted asset must have:

- A stable lowercase kebab-case source name and typed runtime key.
- Transparent PNG or WebP output where transparency is required; SVG may remain source-only if Phaser runtime support or raster consistency is weaker.
- Documented source/provider, prompt/version, license/commercial-use status, cleanup performed, export dimensions, and checksum or final filename.
- Consistent pixel density and a defined world-to-source scale.
- No baked labels, usernames, counters, or daily state.
- Clean alpha edges with no provider background remnants.
- Collision geometry defined in code/shared tower data, never inferred from decorative pixels.
- A safe procedural fallback for missing or rejected art.

Initial families to prove before broad production:

- Platform family: top surface, thick underface, left/right termination, cursed state, checkpoint state.
- Artifact family: Corpse Stack, Mercy Nail, Ghost Platform, Cursed Brick, Lantern Trail, including idle/active/upgraded state where the current logic exposes it.
- Player family: grounded, charge, airborne, land, fall, and respawn readability at mobile scale.
- Reliquary architecture: outer frame, inner rim, cavity, arch/pier segments, depth shadow, and restrained zone dressing.

## Milestones

### M0 — Reconfirm baseline and working tree safety

- Re-read local `AGENTS.md` files and this plan before implementation turns.
- Inspect `git status`; preserve existing user changes and avoid overlapping unrelated files.
- Re-run or recapture the production baseline if code changed since the recorded screenshots.
- Record exact commands and evidence in `docs/design-redesign/status.md`.

Exit: baseline evidence is current, worktree risks are known, and no user-owned change is at risk.

### M1 — Complete the art bible in Figma and repository docs

Define and document:

- Values and contrast roles for frame, cavity, architecture, platforms, artifacts, text, focus, and feedback.
- Exact palette tokens and permitted opacity ranges.
- Material rules: washi rim, indigo lacquer/stone, burgundy cavity, gold bindings, persimmon mutation, ghost-mint spectral surfaces.
- Platform silhouettes, thickness, edge damage, underfaces, terminations, and collision-edge clarity.
- All five artifact silhouettes and their collision/state semantics.
- Player proportions, silhouette, scarf/accent behavior, charge readability, and fall pose.
- Typography hierarchy using Shippori Mincho and Zen Maru Gothic; mobile minimums and label length constraints.
- In-world label placement, maximum width, collision avoidance, hierarchy, and dry-copy limits.
- Scale system for 375×812 logical composition, desktop adaptation, touch safe area, and camera lookahead.
- Depth layers, parallax limits, lighting direction, shadows, and foreground occlusion rules.
- Motion vocabulary, durations, easing, amplitude, reduced-motion substitutions, and feedback priority.
- Audio mapping for charge, leap, land, mutation, curse, checkpoint, and result without expanding the sound system unnecessarily.
- Accessibility rules: contrast, focus, touch targets, shape-not-color semantics, text sizing, motion, and readable fallback states.
- Forbidden patterns specific to the selected grammar.

Produce a desktop adaptation and at least these state frames in Figma: pre-input seeded mutation, charge, airborne opening jump, first fall feedback, respawn with mutation increment, checkpoint, cursed shelf active, and result overlay.

Exit: art bible is explicit enough that two implementers would make materially the same visual decisions; mobile and desktop state frames pass the scorecard.

### M2 — Controlled asset bake-off and provider decision

- Use the same locked brief for Scenario and Layer: one platform family, Corpse Stack with base/upgraded states, and player grounded/charge/airborne states.
- Do not subscribe or bulk-generate without explicit approval.
- Normalize canvas size, scale, palette, edge cleanup, alpha, and presentation before comparison.
- Record prompts, source files, raw outputs, cleanup, provenance, reproducibility, licensing evidence, and costs.
- Score providers on visual fit plus transparency, state consistency, reproducibility, commercial rights, and pipeline friction.
- Select at most one provider. Reject both if neither beats repository-native production.
- Define the provider-independent fallback before leaving the milestone.

Exit: one provider is approved with evidence, or the fallback is explicitly selected; there is no unresolved paid-service decision hidden in implementation.

### M3 — Phaser 4.2.1 compatibility and performance proof

- Obtain and verify Phaser Editor access only if it materially improves scene/prefab authoring; do not block code-native Phaser proof on the editor.
- Import the normalized proof assets through Vite.
- Verify transparency, filtering, scale, origin, camera zoom, responsive layout, texture keys, and disposal/reload behavior.
- Keep Arcade Physics collision bodies derived from tower/artifact data and visually align them with the new top surfaces.
- Prove cursed wobble, ghost transparency, lantern visual-only behavior, charge pose, and reduced-motion substitutions.
- Measure initial asset payload, texture memory estimate, build chunk impact, and representative mobile frame behavior.
- Confirm generated/editor code remains readable and contains no physics logic, mutation rules, API calls, or persistence.

Exit: a minimal proof scene works in Phaser 4.2.1 at mobile and desktop sizes, collision/display alignment is documented, and asset/runtime budgets are acceptable.

### M4 — Opening-zone vertical slice

Implement the selected direction for Lower Ruins only:

- Reliquary frame, inner rim, cavity, arch/pier architecture, platform family, and depth layers.
- Top title/status seal and compact controls copy.
- Opening route framing with upward lookahead and bottom control safe area.
- Player presentation for grounded, charge, airborne, land, fall, and respawn.
- Corpse Stack, Mercy Nail, Ghost Platform, Cursed Brick, and Lantern Trail visual semantics when present in the opening state.
- Stamped in-world mutation labels sourced from existing artifact data.
- First-fall feedback plaque, local threshold change, respawn, and updated artifact state.
- Touch controls, keyboard controls, focus handling, sound cues, reduced motion, pause/result/audio interactions, loading, and error fallback.
- Procedural fallback renderers behind the same typed renderer boundary.

Add or adapt targeted tests for layout math, artifact renderer selection/state mapping, label placement bounds, reduced-motion decisions, and asset-key completeness. Do not test Phaser pixels in pure shared tests.

Exit: the opening-zone slice scores at least 85/100, no first-five score below 4, movement and collision remain unchanged, and browser comparison materially beats the baseline.

### M5 — Full expanded-game migration

Proceed only after M4 exit evidence is recorded.

- Extend the selected grammar through Bell Shaft and Moon Roof without creating unrelated palettes or physics systems.
- Preserve one global movement model and differentiate zones through architecture, silhouette density, damage, light, and one light mechanical emphasis already supported by the product.
- Migrate every generated platform/chunk/checkpoint presentation while retaining deterministic tower data and reachability.
- Complete all artifact counts/upgrades, cursed/stabilized visual states, checkpoint banners, summit, mutation history, result overlay, audio cues, and fallback states.
- Keep visual artifact caps and label density within product rules.
- Ensure desktop composition expands the cutaway rather than turning into a dashboard or tiny centered phone mockup.
- Remove only procedural rendering code made obsolete by the new renderer, after verifying fallback and tests; clean imports created unused by this migration.

Exit: every expanded-game state uses the selected system, all three zones remain playable and finite, and no obvious baseline visual fragment remains.

### M6 — Inline splash and cross-surface coherence

- Recompose the splash as the same reliquary world, with the existing community artifact and `14 falls made this foothold` promise visible before expansion.
- Keep the inline entrypoint lightweight; do not load Phaser in `splash.html`.
- Preserve `requestExpandedMode` and Devvit navigation behavior.
- Align splash typography, frame, artifact silhouette, CTA, focus state, and reduced motion with the expanded game.
- Ensure the feed-to-expanded transition feels continuous without depending on unsupported state bridges.

Exit: splash and expanded game clearly belong to one product, and the splash remains lightweight and functional in the Devvit inline surface.

### M7 — Responsive, accessibility, performance, and regression validation

Run and record:

- Fresh screenshots for splash, 375×812 mobile, 1280×800 desktop, and large/fullscreen at the same gameplay states as baseline.
- Before/after scorecard with evidence for each criterion.
- Keyboard: left/right, charge/release, air nudge, focus, result/audio controls.
- Touch: fixed left/jump/right, hold/release, multi-touch where supported, safe-area and thumb reach.
- Reduced motion: system preference at load and live changes where currently supported.
- Contrast and shape-only checks for every artifact and feedback state.
- Long and edge copy, capped mutation contribution, loading, API failure/local fallback, checkpoint, summit, and result states.
- Representative tower seeds and all existing reachability tests.
- Asset 404/fallback behavior and repeat scene mount/unmount.
- Bundle/build output and any material chunk-size change.

Required commands from `fallstack/`:

    npm run type-check
    npm run lint
    npm test
    npm run build

Run the existing screenshot harness against the production build and use browser automation for targeted interaction/screenshot smoke coverage. Run a Devvit playtest when credentials/runtime are available; document exact blockers otherwise.

Exit: all required checks pass, visual scorecard passes, browser evidence is archived, and residual risks are explicit.

### M8 — Final cleanup and handoff

- Update `docs/design-redesign/status.md` with final gate evidence, commands, screenshots, selected provider/fallback, asset provenance, performance notes, and residual risks.
- Ensure docs explain how to add or replace an asset without breaking keys, scale, collision, or provenance.
- Verify no secrets, raw paid-provider credentials, unused generated output, temporary captures, or unlicensed assets are committed.
- Review the final diff for unrelated refactors and user-owned changes.
- Commit in verified checkpoints if the active workflow authorizes commits; do not create one massive unrelated commit.

Exit: the production redesign is reviewable, reproducible, validated, and maintainable.

## Validation matrix

| Area | Narrow validation | Broad validation |
| --- | --- | --- |
| Pure tower/mutation behavior | Existing shared tests plus any deterministic presentation metadata tests | `npm test` |
| Responsive layout | `src/client/game/layout.test.ts` and targeted browser sizes | Screenshot matrix |
| Asset contract | Typed asset-key and manifest tests; missing-asset fallback | Build plus browser network inspection |
| Artifact semantics | Renderer/state mapping tests and visual state captures | Scorecard and gameplay smoke |
| Input | Focused keyboard/touch smoke | Mobile and desktop browser flows |
| Reduced motion | Unit-test decision helpers where extracted | Browser preference emulation |
| Devvit shell | Local production server and API fallback | Devvit playtest when available |
| Quality gates | Targeted type/lint/test during milestones | Type-check, lint, tests, build at M7 |

## Risks and mitigations

- Monolithic `game-app.tsx`: extract only proven rendering seams during M4; preserve scene lifecycle and physics behavior with targeted tests and screenshots.
- Art/collision mismatch: collision remains data-driven; every platform/artifact proof includes an overlay or measured alignment check.
- Generated asset inconsistency: equal-brief bake-off, normalized states, provenance, and a repository-native fallback prevent provider lock-in.
- Mobile crowding: 375×812 is the primary composition; labels have bounds and density limits; controls reserve a fixed safe area.
- Decorative occlusion: foreground layers may never cover collision edges or the active opening jump; validate at gameplay scale, not only zoomed Figma views.
- Bundle growth: define budgets during M3, prefer atlases/shared materials, and reject decorative volume that does not improve the scorecard.
- Accessibility regression: no color-only semantics, explicit reduced-motion replacements, touch targets, focus states, and contrast checks are milestone exits.
- Scope drift into gameplay or persistence: architecture ownership and out-of-scope rules require a separate decision before such changes.
- Paid provider/editor blockers: stop at the relevant external handoff while continuing art-bible, fallback, code-native proof, tests, and reversible repository work.

## Decision log

- 2026-07-13: Direction C, Cutaway Reliquary, selected by the user. Direction A rejected; Direction B contributed only its alternating consequence rhythm and Mercy Nail route option.
- 2026-07-13: Status remains top-aligned; the left dashboard rail is forbidden.
- 2026-07-13: Plan covers the complete shipped visual surface, but implementation remains gate-controlled: opening-zone proof must beat baseline before full tower migration.
- 2026-07-13: No complete repository ExecPlan or `PLANS.md` template existed, so this plan was created under `docs/design-redesign/`.

## Progress

- [x] Gate 1: baseline captured.
- [x] Gate 2: three native Figma directions created.
- [x] Gate 3: Cutaway Reliquary selected and refined to v2.
- [x] M0: reconfirm baseline and worktree safety for implementation start.
- [x] M1: complete art bible and responsive/state designs.
- [x] M2: asset bake-off/fallback decision. Scenario and Layer were not trialled without supplied account access or paid approval; the scored repository-native fallback was selected and shipped.
- [x] M3: Phaser compatibility and performance proof using the repository-native fallback.
- [x] M4: opening-zone vertical slice.
- [x] M5: full expanded-game migration.
- [x] M6: inline splash and cross-surface coherence.
- [x] M7: full validation.
- [x] M8: cleanup and handoff.
