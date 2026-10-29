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
5. **Safety Thread suppresses the fall event.** A caught fall is not a fall, so
   no mutation is recorded. The cap is 1, or 2 for the Diver. Flag this for the
   mutation worktree if they want near-misses counted.

## Biomes

| # | Biome | Zones | Mechanic | Rule |
| --- | --- | --- | --- | --- |
| 1 | Kiln Hollow | 1–3 | Bellows vents | Vent columns between some jumps puff on a 2.4 s beat. While a vent is active and you're airborne inside it, it cancels most of gravity. |
| 2 | Tidewell | 4–5 | Bladder springs | Every other ledge is a spring. Landing at 430 px/s or faster rebounds you straight up. Holding Jump on touchdown plants you instead. |
| 3 | Gale Loom | 6–8 | Crosswind gusts | A 5.2 s cycle: calm, then a 0.7 s warning (HUD shows the direction), then a 1.5 s gust of up to 140 px/s² sideways. Only airborne players are pushed. |
| 4 | Rime Archive | 9–10 | Slick ledges | The ground settle factor drops from 0.32 to 0.12, so landings skid. Charging zeroes x velocity, which stops the skid. |
| 5 | Orrery Crown | 11–12 | Low gravity | Gravity × 0.8. |

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

## Progress log

- **Checkpoint 1:** pure modules `biomes.ts`, `powerups.ts`, `climbers.ts`, plus
  16 tests. Design canvas published (direction board, climber select, HUD,
  moments).
