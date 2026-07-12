# Gate 5 asset bake-off package

Status: brief locked; provider runs pending authenticated Scenario and Layer access. No subscription, credit purchase, or bulk generation is authorized.

## Decision rule

Scenario and Layer receive the exact same content brief. Their raw outputs are preserved, then normalized to identical canvases and palette limits before scoring. Select at most one provider. If neither passes every hard gate and scores at least 80/100, use the repository-native fallback.

Hard failures:

- unclear commercial-use rights or missing provenance
- unusable transparency or persistent background/matte residue
- state-to-state character/object drift that cleanup cannot reasonably correct
- baked text, counters, usernames, logos, watermarks, or provider marks
- visual collision edges that cannot align with existing data-driven bodies
- a workflow that cannot reproduce the chosen style and states

## Locked equal brief

Create a compact 2D game-art proof for **Fallstack**, a tactile cursed vertical climbing diorama. The art belongs to a framed architectural cutaway/reliquary. It is not generic pixel fantasy, neon UI, a parchment card game, a horror-gore scene, or a Reddit-themed game.

Visual grammar:

- chunky damaged architectural silhouettes
- indigo-black lacquer/stone structure, burgundy recess, warm washi repair, restrained aged-gold binding, persimmon mutation accent, ghost-mint spectral surfaces
- upper-left hard light, thick underfaces, clean alpha, readable at mobile gameplay scale
- smooth painted/vector-like edges, not pixel art
- one dominant chip/repair event per object; no noisy texture blanket
- no text or symbols that look like language

Produce exactly these three families on transparent backgrounds:

### A. Platform family

One broad Lower Ruins ledge shown as five matching modular pieces:

1. middle/top surface
2. thick underface
3. left damaged termination
4. right repaired termination with one gold binding
5. cursed state with downward teeth and one cracked loose segment

The solid top edge must remain straight across at least 70% of the usable span. Decoration cannot imply false collision geometry.

### B. Corpse Stack states

One anonymous, non-gory community foothold made from three offset bundled slabs/bodies. It must read as a solid stepped wedge with a flat usable crown.

1. base state: three bundled layers
2. upgraded state: same silhouette family plus a bound top slab and stronger stability

Do not show faces, blood, named characters, or literal individual blame.

### C. Player states

One small anonymous relic-bearer/climber, approximately 2:3 head-to-body proportion, dark indigo body mass, small washi face/hand notch, and one persimmon scarf/waist binding.

1. grounded: two readable contacts
2. charge: 12–16% compressed silhouette, wider feet
3. airborne: extended body, clear foot gap, scarf trailing opposite travel

No fine facial detail, weapon, mascot proportions, or elaborate costume.

## Required output format

- Transparent PNG or WebP plus highest-quality editable/source output the provider allows.
- Platform proof arranged so each module can be isolated into a 256×128 px 2× cell.
- Artifact states each fit a 192×128 px 2× cell.
- Player poses each fit a 96×96 px 2× cell.
- At least 4 transparent pixels of export padding around every isolated item.
- Consistent camera, light direction, scale, line/edge treatment, and palette across all states.

## Normalization procedure

Raw output is never compared directly in a flattering provider presentation.

1. Preserve raw response, prompt, seed/model/version, account tier, date, and rights evidence.
2. Remove only background residue and accidental detached noise; do not redraw a provider into passing.
3. Place each family on the required transparent cells at the same apparent world scale.
4. Normalize to the art-bible palette. Record every material color shift.
5. Align platform collision truth to a separate overlay; do not crop art to hide disagreement.
6. Export a common proof sheet on both `burgundy-950` and checkerboard backgrounds.
7. Record time, credits/cost, failed generations, manual cleanup minutes, and reproducibility notes.

## Provider scorecard

Score 1–5 with evidence.

| Criterion | Weight | Evidence |
| --- | ---: | --- |
| Cutaway Reliquary visual fit | 20 | Material, silhouette, light, palette, absence of generic fantasy |
| Mobile gameplay readability | 15 | 1× screenshot at intended apparent size |
| Cross-state consistency | 15 | Platform, Corpse Stack, and player overlay comparisons |
| Alpha and edge quality | 10 | Checkerboard and dark-cavity inspection |
| Collision compatibility | 10 | Code-body overlay with visual top/termination insets |
| Editability and cleanup cost | 10 | Source format and timed cleanup log |
| Reproducibility | 10 | Same-account rerun or documented seed/model controls |
| Commercial rights/provenance | 5 | Saved provider terms/license evidence |
| Pipeline/runtime cost | 5 | Export size, atlas fit, compression, integration friction |

## Repository-native fallback

The repository-native fallback is the selected production path for this redesign while provider access is absent. It uses no new dependency and remains replaceable behind the focused renderer boundaries.

- Build silhouettes from Phaser Graphics and small repository-owned SVG source shapes.
- Rasterize only when the Phaser proof shows a measured benefit; otherwise retain procedural geometry behind typed renderers.
- Use the exact palette, silhouette, alpha, scale, and collision contracts in [`art-bible.md`](art-bible.md).
- Prove the platform family, Corpse Stack base/upgraded states, and player grounded/charge/airborne states first.
- Preserve procedural fallback for every adopted texture key.
- Record repository authorship as provenance and store no generated-provider output in production folders until selected.

Fallback passes Gate 5 only if its normalized proof scores at least 80/100 and materially supports the selected Figma direction. It remains replaceable behind the same typed asset/rendering boundary.

## Run record

| Provider | Access | Raw output | Normalized proof | Score | Decision |
| --- | --- | --- | --- | ---: | --- |
| Scenario | Not supplied | Pending | Pending | — | External handoff |
| Layer | Not supplied | Pending | Pending | — | External handoff |
| Repository-native fallback | Selected | Implemented in `renderTower.ts`, `renderArtifacts.ts`, and `renderPlayer.ts` | 96/100 final product scorecard | Repository-authored procedural geometry; BSD-3-Clause repository license | Production path; no external asset payload |

## Production manifest and replacement workflow

This pass intentionally ships no external texture files, atlases, or provider output. The production manifest is therefore the three repository-authored renderer modules above plus the palette/state contract in `art-direction.ts`; there are no binary checksums or third-party licenses to record.

To add or replace a future asset safely:

1. Add the stable lowercase kebab-case source and record provider, prompt/version, rights, cleanup, export size, filename, and checksum in this document before it enters a production folder.
2. Keep collision geometry in shared tower/artifact data. Align the visual top edge to that body; never derive a body from pixels.
3. Preserve the world scale, origins, alpha padding, and mobile silhouette rules in the art bible.
4. Add a typed texture key/preload seam only when the first accepted texture exists. Do not weaken the procedural renderer fallback.
5. Run the artifact/state tests, full project commands, missing-asset fallback check, and mobile/desktop screenshot matrix before adoption.
