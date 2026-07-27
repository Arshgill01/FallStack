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

Recommendation: **B — Bell Warden**. It has the clearest 1× mobile read and the
most coherent gameplay-state vocabulary without requiring a physics change.

The user selection remains the gate for sprite/state implementation.
