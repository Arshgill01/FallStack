# ISSUE-001 — mobile route extends behind the visible walls

## Classification

- Severity: High
- Workstream: Gameplay and world bounds
- Ownership: Pure viewport layout and Phaser physics bounds
- Baseline: `7c4e06f`
- Reproducibility: 100% at 286, 320, 375, and 480 px
- Current state: Fixed, browser-regressed, and hosted-verified

## Observation

On mobile, deliberate movement reached x=`0…480` although the reliquary's
readable inner wall planes were x=`34…446`. The moving camera could therefore
let the climber leave the frame before a physical edge became legible. Desktop
and fullscreen were not defective: their expanded x=`0…758` edge was already
intentional.

The first correction fixed that physical gutter but not the user's complete
visual report. Hosted `0.0.26` still centred a narrow mobile camera inside the
480 px world. At 286 px the camera showed x=`97…383`, while the painted left
and right walls remained near x=`5…34` and x=`447…475`. Neither true wall was
visible; an internal right-side line only resembled one.

## Ranked hypotheses and probes

1. Mobile inherited the full logical route bounds. Compare world bounds with
   the painted cavity.
2. Camera following exposed an off-frame gutter. Drive both contacts while
   sampling player and screen coordinates.
3. Opening ledges near the wall caused the report. Verify generated platform
   bounds separately before changing route geometry.

## Regression seam

`npm run qa:world-bounds` drives both walls at 286×650, 320×568, 375×812,
480×800, and 1280×800. It now asserts physical bounds, player contact, camera
visibility, fixed mobile rails on both viewport edges, player clearance inside
those rails, and the unchanged desktop edge.

## Fix and result

Below the existing 600 px mobile breakpoint, physics uses the reliquary's
34 px inset while tower generation keeps its 480 px coordinate system.
The reopened visual defect is fixed separately with two 12 px viewport-fixed
reliquary rails. They remain visible while the world camera pans; the player
stays fully inside them at both physical contacts. Desktop/fullscreen still
uses the full expanded world and receives no added rail. The
[red report](../evidence/gate-1-baseline/world-bounds-red/world-bounds.json)
contains twelve mobile failures; the
[green report](../evidence/world-bounds-fix/world-bounds.json) passes all four
original viewports. Commit `4e11711` is the physical-bound correction; the
viewport-rail correction is commit `57d6f2f`. Deployed WebView `0.0.27` then
showed both 12 px rails at 360 px and retained both sides in a 286 px
narrow-frame check.

## Residual risk

The browser probe validates responsive geometry, not a physical-device bezel or
browser toolbar. Rotation continuity is covered separately by ISSUE-017. The
authenticated hosted observation is complete, but physical-device testing
remains separate evidence.
