# ISSUE-001 — mobile route extends behind the visible walls

## Classification

- Severity: High
- Workstream: Gameplay and world bounds
- Ownership: Pure viewport layout and Phaser physics bounds
- Baseline: `7c4e06f`
- Reproducibility: 100% at 320, 375, and 480 px
- Current state: Fixed and browser-regressed

## Observation

On mobile, deliberate movement reached x=`0…480` although the reliquary's
readable inner wall planes were x=`34…446`. The moving camera could therefore
let the climber leave the frame before a physical edge became legible. Desktop
and fullscreen were not defective: their expanded x=`0…758` edge was already
intentional.

## Ranked hypotheses and probes

1. Mobile inherited the full logical route bounds. Compare world bounds with
   the painted cavity.
2. Camera following exposed an off-frame gutter. Drive both contacts while
   sampling player and screen coordinates.
3. Opening ledges near the wall caused the report. Verify generated platform
   bounds separately before changing route geometry.

## Regression seam

`npm run qa:world-bounds` drives both walls at 320×568, 375×812, 480×800, and
1280×800. It asserts physical bounds, player contact, camera visibility, and
the unchanged desktop edge.

## Fix and result

Below the existing 600 px mobile breakpoint, physics uses the reliquary's
34 px inset while tower generation keeps its 480 px coordinate system.
Desktop/fullscreen still uses the full expanded world. The
[red report](../evidence/gate-1-baseline/world-bounds-red/world-bounds.json)
contains twelve mobile failures; the
[green report](../evidence/world-bounds-fix/world-bounds.json) passes all four
viewports. Commit: `4e11711`.

## Residual risk

The browser probe validates responsive geometry, not a physical-device bezel or
browser toolbar. Rotation continuity is covered separately by ISSUE-017.
