# ISSUE-001 — mobile route extends behind the visible walls

## Classification

- Severity: High
- Workstream: Gameplay and world bounds
- Ownership: Pure viewport layout and Phaser physics bounds
- Baseline: `7c4e06f`
- Reproducibility: 100% at 286, 320, 375, and 480 px
- Current state: Fixed, browser-regressed, and corrected host version verified

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

The second correction in `0.0.27` added fixed rails and verified only the
player's 20 px transparent collision body. Option A's rendered Washi Pilgrim
is wider: the falling pose occupied x=`24…63` when its body stopped at the
left x=`34` wall plane. Ten pixels of visible character therefore entered the
painted wall even though the body-only assertion passed. Safari's Reddit
Mobile modal was using the narrow mobile layout; Retina-scaled screenshot
dimensions had initially obscured that fact.

## Ranked hypotheses and probes

1. The Reddit modal bypassed the mobile breakpoint. Safari reproduction ruled
   this out: the modal used the narrow layout and rendered both fixed rails.
2. The test measured the collision body instead of the wider character art.
   A visible-versus-hidden canvas pixel diff reproduced ten pixels inside the
   left wall in the falling pose.
3. Camera following or opening ledges caused the report. Existing contact and
   route probes remained correct once the visual envelope was measured.

## Regression seam

`npm run qa:world-bounds` drives both walls at 286×650, 320×568, 375×812,
480×800, and 1280×800. It now asserts physical bounds, player contact, camera
visibility, fixed mobile rails on both viewport edges, player clearance inside
those rails, the actual falling-pose canvas pixels at both painted wall planes,
and the unchanged desktop edge.

## Fix and result

Below the existing 600 px mobile breakpoint, physics now uses the reliquary's
34 px inset plus 12 px of character-art clearance while tower generation keeps
its 480 px coordinate system.
The reopened visual defect is fixed separately with two 12 px viewport-fixed
reliquary rails. They remain visible while the world camera pans; the player
stays fully inside them at both physical contacts. The worst falling pose now
occupies x=`36…77` beside the x=`34` left wall, and the symmetric right-side
pixel assertion passes at 286, 320, 375, and 480 px. Desktop/fullscreen still
uses the full expanded world and receives no added rail. The
[red report](../evidence/gate-1-baseline/world-bounds-red/world-bounds.json)
contains twelve mobile failures; the
[green report](../evidence/world-bounds-fix/world-bounds.json) passes all four
original viewports. Commit `4e11711` is the physical-bound correction; the
viewport-rail correction is commit `57d6f2f`. WebView `0.0.27` proved that
both rails rendered, but its body-only signoff did not prove that the complete
character silhouette stayed inside them. Commit `7e990ad` adds the 12 px
mobile character-art clearance and the rendered-pixel regression. Devvit
`0.0.28` was uploaded and installed on `r/fallstack_dev`; CLI read-back and an
authenticated Safari expansion both identified the hosted `0.0.28` WebView.
The mobile frame loaded both rails and touch controls without gameplay input or
a shared mutation event.

## Residual risk

The browser probe validates responsive geometry and Phaser canvas pixels, not a
physical-device bezel or browser toolbar. Rotation continuity is covered
separately by ISSUE-017. The hosted shared post was not driven into a wall,
because doing so could create a fall and mutate the community tower; the
rendered-pixel contact proof therefore remains local and deterministic.
Physical-device testing remains separate evidence.
