# Character reconstruction record

## Baseline

The current player is a procedural reliquary figure drawn with Phaser graphics:

- transparent 20×28 physics box;
- approximately 30×42 visual silhouette;
- indigo hood/body, washi face, one gold eye, persimmon scarf;
- coarse grounded, charge, airborne, and fall states.

The user has explicitly rejected the current character quality. Existing tests
only prove broad state and size relationships; they do not prove a distinctive
silhouette, landing/respawn language, scarf motion, or mobile-scale appeal.

## Constraints

- Keep the current physics body, origin, and movement authority unless a
  separately reproduced collision defect requires change.
- Fit the selected Cutaway Reliquary grammar and palette.
- Read at 1× 320/375 mobile scale over every biome.
- Show direction, charge, ascent, descent, hard fall, respawn, checkpoint, and
  summit without relying on color alone.
- Preserve reduced-motion state communication.
- Avoid generic pixel fantasy, mascot/Snoo identity, and a cosmetic asset that
  obscures collision truth.

## Required direction gate

Create three compositionally distinct relic-bearer directions with identical
physics/origin/palette constraints. Capture their complete state rows at actual
mobile scale with optional collision overlays. Score silhouette recognition,
direction/charge legibility, emotional fit, tactile material identity, animation
coherence, originality, and Phaser/runtime cost.

Stop for user selection before implementation because this choice materially
defines the product character.

## Direction set

The generated boards are concept evidence, not shippable sprites. Each keeps the
current physics target while exploring a different primary silhouette:

| Direction | Silhouette | State read | Product fit | Runtime cost | Assessment |
| --- | ---: | ---: | ---: | ---: | --- |
| [A — Washi Pilgrim](character-directions/option-a-washi-pilgrim.png) | 4/5 | 4/5 | 4/5 | Low | Most sympathetic and closest to the existing bearer, but the rounded hood risks reading as a familiar fantasy mascot. |
| [B — Bell Warden](character-directions/option-b-bell-warden.png) | 5/5 | 5/5 | 5/5 | Low | Strongest compact silhouette. Squash, tilt, inversion, and impact all follow from one material idea and reinforce the bell-shaft world. |
| [C — Threadbare Effigy](character-directions/option-c-threadbare-effigy.png) | 5/5 | 3/5 | 4/5 | Medium | Most original and cursed, with excellent directional thread motion, but its tall rigid body is hardest to reconcile with the current collision box. |

Recommendation before selection: **B — Bell Warden**. It had the clearest 1×
mobile read and the most coherent gameplay-state vocabulary without requiring a
physics change.

## Selected direction

The user explicitly selected **A — Washi Pilgrim** on 2026-07-27. That choice
supersedes the implementation recommendation above.

The production grammar is frozen as:

- an angular, folded-washi hood over a mostly faceless indigo void;
- one restrained gold seal-eye and one pale hand/face notch;
- an asymmetric persimmon prayer strip, never more than one quarter of the
  silhouette;
- a dark layered cloak with a ragged paper hem and two readable contact points;
- a small bound archive pack and cord as the relic-bearer detail;
- squash, fold, unfurl, stamp, and binding poses for gameplay state changes.

The runtime version must avoid the concept board's mascot risk: no rounded face,
facial animation, oversized eyes, or soft blob silhouette. The 20×28 physics
body, player origin, movement tuning, collision authority, and event payloads
remain unchanged.

Implementation acceptance requires actual-scale evidence for grounded, low and
full charge, rising, apex, falling, hard landing, respawn, checkpoint, and
summit states in standard and reduced-motion modes.

## Implementation result

The selected Washi Pilgrim is integrated as a focused procedural Phaser
renderer. It replaces the rounded rectangle mascot language with:

- a faceted washi hood and angular indigo cloak;
- a faceless inner void with one gold seal-eye and one pale notch;
- a front persimmon prayer strip with two coarse ink marks;
- asymmetric hood tie, gold waist cord, ragged hem, and bound archive pack;
- distinct rising, apex, falling, impact, stamp-in, binding, and summit
  silhouettes.

The physics rectangle remains transparent and unchanged at 20×28. The grounded
visual contract is 26×39 at 375×812, where one world pixel maps to one CSS
pixel. Charge compresses from 29.4×34.4 to 31×32; rising stretches to 25×42;
falling opens to 32×38. Short presentation-only ceremonies attach to existing
land, respawn, checkpoint, and summit hooks. They do not alter movement,
collision, event payloads, API calls, or persistence.

Reduced motion keeps the same pose swaps and ceremony marks while removing
ascent/fall tilt and respawn fading.

## Evidence

- [Standard-motion state matrix](evidence/character-washi-pilgrim/standard-contact-sheet.png)
- [Reduced-motion state matrix](evidence/character-washi-pilgrim/reduced-contact-sheet.png)
- [375×812 gameplay context](evidence/character-washi-pilgrim/mobile-context.png)
- [320×568 gameplay context](evidence/character-washi-pilgrim/mobile-context-320.png)
- [Machine-readable state/body report](evidence/character-washi-pilgrim/report.json)

| Criterion | Result | Evidence |
| --- | ---: | --- |
| Silhouette recognition | 4/5 | Angular hood, ragged cloak, prayer strip, and archive pack survive at 1× |
| Direction and charge legibility | 4/5 | Seal-eye, hood tie, prayer-strip lag, compression, and three charge notches |
| Product/emotional fit | 4/5 | Sympathetic relic bearer without a face-led mascot treatment |
| Tactile material identity | 5/5 | Fold lines, washi facets, binding cord, seal, and stamped ceremonies |
| State coherence | 5/5 | Ten states share one squash/fold/unfurl/binding vocabulary |
| Originality | 4/5 | Familiar pilgrim role is made specific through Fallstack's reliquary materials |
| Phaser/runtime cost | 5/5 | Procedural graphics only; no dependency, asset, or texture payload |

Validation:

- `npm run qa:character-states -- docs/quality-reconstruction/evidence/character-washi-pilgrim` — passed.
- `npm run qa:runtime -- /tmp/fallstack-quality/character-runtime-chromium --browser=chromium` — passed.
- `npm run qa:runtime -- /tmp/fallstack-quality/character-runtime-webkit --browser=webkit` — passed.
- `npm run qa:world-bounds -- /tmp/fallstack-quality/character-world-bounds` — passed.
- `npm run type-check` — passed.
- `npm run lint` — passed.
- `npm test` — passed, 153 tests.
- `npm run build` — passed with the existing large-chunk warning.
