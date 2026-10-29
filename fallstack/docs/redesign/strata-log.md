# Strata Redesign Log

Branch: `feat/redesign-biomes-powerups` (worktree `../FallStack-redesign`), cut from
`test/connectivity-pipeline` @ `1fa2e09`.

Design canvas: https://claude.ai/artifact/6UvRn69mDWDoSDF3PANUmy (private until shared).

## Scope

In scope: UI redesign, five biomes, four climbers, a power-up layer, and more
dynamic moment-to-moment play.

Out of scope, on purpose: the shared mutation layer, meaning how one player's
falls change the board for others. Another worktree owns it. This branch does
not touch `src/server/**`, `mutation*.ts`, `impact-sites.ts`, `board*.ts`, Redis keys,
`/api` payloads, or the `fallstack:fall` / `fallstack:clear` / `fallstack:summit`
event shapes.

## Merge contract (read before merging)

| Surface | Change on this branch | Merge risk |
| --- | --- | --- |
| `ZONE_IDS`, `ZONE_NAMES`, zone geometry | Unchanged. Biomes map over zone IDs. | None |
| `generateDailyTower` / platform ids | Unchanged. Biome rendering reads the same platforms. | None |
| Server, Redis, `/api` | Unchanged | None |
| `shared/game/biomes.ts`, `powerups.ts`, `climbers.ts` | New files | None |
| `client/game/renderBiomes.ts`, `renderClimbers.ts`, `climb-dynamics.ts` | New files | None |
| `client/redesign.css` | New file, imported after `index.css` | Low |
| `client/game-app.tsx` | Small hook points (see "Scene hook points") | Medium: resolve by hand |
| `client/game/events.ts`, `sound.ts` | New sound ids added to the union | Low |

## Decisions

1. **Biomes sit on top of zones; they don't replace them.** The 12 zone IDs stay
   as server keys. Five biomes span them 3/2/3/2/2 (`BIOME_FOR_ZONE`), so mutation
   counters, receipts and impact sites keep working unchanged.
2. **Same tower geometry.** Biomes change how the tower looks and feels, not
   where ledges are. Keeping the platform list intact keeps fall evidence
   (`lastPlatformId`, `fallX`) valid for the server and the other worktree.
3. **One movement model.** Climbers don't change physics. Each climber gets
   more out of one pickup (its affinity), so the community's fall data stays
   comparable.
4. **Power-ups are solo and client-only.** They're placed deterministically
   from the daily seed (everyone sees the same detours) and never persisted.
   None is required to finish: the tower's existing default path is untouched.
5. **The climber picker doesn't auto-open.** AGENTS.md says the first viewport
   must show the tower before any wall, so the picker opens from a climber chip
   in the top bar. The chip is filled with the biome accent until you make a
   first pick. The choice is saved in `localStorage['fallstack:climber']`
   inside try/catch; it's only a per-device convenience.
6. **Safety Thread suppresses the fall event.** A caught fall is not a fall, so
   no mutation is recorded. The cap is 1, or 2 for the Diver. Flag this for the
   mutation worktree if they want near-misses counted.

## Biomes

| # | Biome | Zones | Mechanic | Rule |
| --- | --- | --- | --- | --- |
| 1 | Kiln Hollow | 1–3 | Bellows vents | Vent columns between some jumps puff on a 2.4 s beat. While a vent is active and you're airborne inside it, it cancels most of gravity. |
| 2 | Tidewell | 4–5 | Bladder springs | Every other ledge is a spring. Landing at 430 px/s or faster rebounds you straight up. Holding Jump on touchdown plants you instead. |
| 3 | Gale Loom | 6–8 | Crosswind gusts | A 5.2 s cycle: calm, then a 0.7 s warning (HUD shows the direction), then a 1.5 s gust of up to 110 px/s² sideways. Only airborne players are pushed. |
| 4 | Rime Archive | 9–10 | Slick ledges | The ground settle factor drops from 0.32 to 0.12, so landings skid. Charging zeroes x velocity, which stops the skid. |
| 5 | Orrery Crown | 11–12 | Low gravity | Gravity × 0.8 and launch velocity × √0.8. Apex height and landing distance are unchanged; hang time grows about 12%, and air steering gets that extra time. |

## Power-ups

| Pickup | Effect | Notes |
| --- | --- | --- |
| Spark | Charge runs 2.4× faster for 10 s | `effectiveChargeHeldMs` |
| Updraft | For 6 s, gravity × 0.38 while falling and fall speed capped at 230 px/s | Glide |
| Second Wind | Held. Tap Jump in mid-air for a −760 px/s hop | Cap 1 (Pilgrim: 2) |
| Safety Thread | Held. Catches a drop of more than 320 px below your last ledge and reels you back | Cap 1 (Diver: 2) |

Placement: two pickups per zone, one **arc** pickup hanging 58 px above the
landing ledge of a mid-zone jump and one **ledge-edge** pickup on the outer lip
of another ledge. Each biome leans toward the pickup that answers its mechanic.
Pickups re-arm when you respawn.

## Climbers

| Climber | Affinity | Perk |
| --- | --- | --- |
| Pilgrim | Second Wind | Holds 2 |
| Wick | Spark | 60% longer |
| Kite | Updraft | 60% longer |
| Diver | Safety Thread | Holds 2 |

## Scene hook points (`client/game-app.tsx`)

When resolving merge conflicts, these are the only behavioural insertions:

- **Fields:** `dynamics: ClimbDynamics`, `prevJumpInput`, `publishedLoadoutKey`, `publishedGustKey`.
- **`create()`:** `dynamics.setTower` / `setClimber`, and a `fallstack:climber` listener.
- **`update()`:**
  - `airForces` → `body.setGravityY(extraGravityY)`. This replaces the old `setGravityY(0)`; an extra of 0 gives the old behaviour.
  - Ground settle comes from `dynamics.groundSettle(zone)`. It's 0.32 everywhere except ice.
  - In the air: wind acceleration, Updraft fall cap, and Second Wind on a fresh Jump press.
  - Charge time goes through `dynamics.effectiveChargeMs` (Spark).
  - Landing calls `onStrataLanding` (safe-ledge memory and springs).
  - Every frame: `collectPickups`, `publishLoadout`, `publishGust`.
- **`checkFall()`:** `tryThreadCatch(runEnding)` runs before the normal fall path.
- **`respawn()`:** `dynamics.onRespawn`.
- **`drawWorld()`:** uses `renderBiomeBackdrop` / `renderBiomePlatform` (it used `renderReliquary*` before).
- **`drawDynamicElements()`:** `drawStrata(g)`, which draws vents, pickups and gust streaks.
- **`drawPlayer()`:** `renderClimber(climberId)`. The Pilgrim still uses `renderReliquaryPlayer`.
- **`drawChargeIntent()`:** the arc preview uses biome gravity.
- **Shell:**
  - Climber state, plus `climberSelectOpen` in `gameplayReady`.
  - `data-biome` and biome CSS variables on `<main>`.
  - The climber chip in the top bar.
  - `<StrataHud>` inside `.tower-wrap`.
  - The guide section "Five biomes, four pickups".
  - Strata sound cues.

New window events (all scene → shell, presentation only):

| Event | Detail |
| --- | --- |
| `fallstack:climber` | `{climberId}` (shell → scene) |
| `fallstack:loadout` | `{chips}` |
| `fallstack:gust` | `{phase, direction}` or `null` |
| `fallstack:pickup` | `{kind}` |
| `fallstack:strata-moment` | `{kind: 'spring' \| 'hop' \| 'thread'}` |

## Visual direction: "Strata"

- An ink ground (`#16111A`), bone paper (`#F3EBDD`), hard 2–3px ink edges, and
  offset block shadows instead of soft cards.
- Display type is **Big Shoulders Display**, bundled locally (OFL, latin subset,
  36 KB): tall condensed letterforms for a vertical game. Body type stays
  Zen Maru Gothic.
- HUD accents retint per biome through `--biome-accent`, set on `<main>` from
  `currentZoneId`.
- The top-bar hanko and Japanese reliquary styling are hidden, not deleted, so
  `index.css` stays mergeable.
- `redesign.css` is imported after `index.css` in `game.tsx` only. The splash page
  is untouched.
- Old art still on screen (owned by the mutation layer or left for a later pass):
  artifact sprites (`renderArtifacts.ts`) and the swinging checkpoint lanterns.

## Progress log

- **Checkpoint 1:** pure modules `biomes.ts`, `powerups.ts`, `climbers.ts`, plus
  16 tests. Design canvas published (direction board, climber select, HUD,
  moments).
- **Checkpoint 2:** scene and shell wiring (`climb-dynamics.ts`,
  `renderBiomes.ts`, `renderClimbers.ts`, `StrataHud.tsx`, `ClimberSelect.tsx`),
  plus 7 client tests.
- **Checkpoint 3:** `redesign.css` and the bundled display font, the guide section,
  and sound cues (`pickup`, `spring`, `hop`, `thread`).
  - QA pipeline, iPhone profile: 60 jumps from Kiln Hollow into Tidewell with
    0 falls, 0 framing, visibility or notice failures, and 0 page errors.
  - Visual probe fixes:
    - The climber dialog sat under the HUD banners because of a z-index override; removed it.
    - The zone tag is now a single line.
    - Loadout chips moved to the bottom-left so they don't collide with the receipt banner.
    - The biome-entry title is smaller.
    - The Second Wind glyph was redrawn because it read as a frown.
- **Checkpoint 4: full-tower verification.**
  - Baseline: the untouched `1fa2e09`, full laptop climb, reached the summit in
    152 jumps with 0 falls.
  - The strata build first stalled in three places. Each fix is below.
    - **Vents in jump corridors** wrecked aimed leaps. Vents now sit off the
      outer lip, and any vent a route corridor crosses is dropped. There's a
      test for this.
    - **Gale Loom gusts.** Softened to 110 px/s². The QA bot now waits for calm
      air, the way the HUD tells players to.
    - **Orrery Crown overshoot.** Plain 0.8× gravity stretched every arc past
      the tuned geometry. Launches now scale by √0.8, which keeps apex height
      and landing distance identical. There's a test for this.
  - Final strata build, full laptop climb: summit in 153 jumps, 0 falls,
    0 problems, p95 frame 17.4 ms.
  - Quick runs on iPhone, laptop, desktop and small phone: 0 falls and
    0 problems on every profile.
  - QA bot changes (`scripts/qa/full-playthrough.mjs`):
    - It drops its own pickups before each jump, because its charge model
      assumes base physics.
    - It waits for calm air in the Gale Loom.

## Follow-ups and known gaps

- **Not covered by the bot:** Spark, Updraft, Second Wind and Thread in live play,
  and steering against gusts. Unit tests cover these; they still need a human
  playtest pass for feel.
- **No Devvit playtest yet.** Everything ran in local Chromium with the QA board
  mock.
- **Old art still on screen:** artifact sprites and the swinging checkpoint
  lanterns are still the reliquary style. Artifacts belong to the mutation layer,
  so restyle them after the merge.
- **Shared-board worktree:** another worktree is in progress on
  `feat/shared-board-presence`. Expect conflicts in `game-app.tsx`; use the
  hook-point list above. Ask that worktree whether Safety Thread catches should
  count as near-misses.
- **Legacy renderers left in place:** `renderReliquaryBackdrop` and
  `renderReliquaryPlatform` are unused by the scene now but still covered by
  `art-direction` tests. Delete them only after the merge settles.
