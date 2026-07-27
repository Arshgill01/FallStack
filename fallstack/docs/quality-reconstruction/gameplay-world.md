# Gameplay and world-boundary record

## Current bounds model

- The logical route is 480 px wide.
- On narrow viewports, the camera follows horizontally across the 480 px route.
- On wider viewports, `gameWorldWidth()` expands the physics world to the full
  canvas and centres the 480 px route with `currentRouteOffset`.
- Desktop/fullscreen intentionally collides with the expanded outer edge.
- Mobile uses the reliquary's inner route edge so the player cannot leave the
  narrow moving frame before reaching a readable boundary.
- The reliquary backdrop paints a 480 px route cavity and wall planes, but those
  painted wall planes do not have continuous collision bodies.

## QR-001 — physical and visual walls disagree

Runtime inspection originally found the same visual/physics distinction at
mobile and desktop widths. The user then clarified the report is mobile-only:
desktop and fullscreen already expose an intentional outer edge. The defect is
therefore the narrow moving-camera path, where the player can leave the visible
frame before a readable side boundary appears.

This directly matches the user's report more closely than out-of-bounds tower
generation.

Ranked hypotheses:

1. Mobile inherited the full 480 px route bounds even though its camera shows
   only 320–480 px at once, creating an off-frame playable gutter.
2. The narrow horizontally following camera made the full logical route
   accessible but did not establish a shared safe route boundary.
3. Generated ledges near the older opening margin make the mismatch easier to
   discover but are not themselves outside `WORLD_WIDTH`.

Required feedback loop:

- expose player x, camera scroll, physical world bounds, and painted route bounds;
- drive deliberate left/right wall contact at 320×568, 375×812, 480 px, and
  1280×800;
- assert mobile never crosses its selected route boundary and remains visible;
- assert desktop/fullscreen retains the original outer canvas edge;
- preserve a complete summit playthrough.

Do not choose between physical wall bodies, player clamping, or different
responsive bounds until the browser loop identifies the smallest fix compatible
with wall-bounce behavior.

Observed red/green result:

- The red browser probe drove wall contact at 320×568, 375×812, 480×800, and
  1280×800. Mobile could enter the off-frame gutter.
- The smallest compatible correction keeps the generated 480 px coordinate
  system and applies the reliquary's 34 px inner wall edge only below the
  existing 600 px mobile breakpoint.
- Narrow runtimes use x=`34…446`.
- The 758 px desktop runtime deliberately remains x=`0…758`, preserving the
  outer edge the user confirmed already works.
- The green probe reaches both mode-specific collision edges without crossing
  them and keeps contacts inside the camera at all four viewports.

Evidence:
[`world-bounds.json`](evidence/world-bounds-fix/world-bounds.json).

## Tower ledge status

- All generated platforms are already asserted inside the 480 px logical world.
- Later generated landings use a 46 px side margin across sampled seeds.
- The first seven ledges intentionally preserve the older opening geometry and a
  smaller margin, including x≈48/53 surfaces.
- Those ledges are near the wall but not outside the world.

The fixed opening geometry remains frozen until camera/landing visibility
evidence demonstrates a playability defect.

## Camera test gap

The current camera target centres on the player. Existing tests prove world and
viewport sizing but do not prove that the next usable landing edge remains
visible for every maximum lateral jump at 320/375 px.

Required loop: calculate and browser-check takeoff, apex, and landing visibility
over representative seeds using actual movement constants. Score the usable
landing segment rather than platform centre alone.

Observed result:

- A no-lookahead calculation over 160 seeds found a 320 px summit-connector
  jump with 0 px of usable target visible at takeoff.
- Committed charge and airborne movement now apply 64 px of lookahead in the
  launch direction; grounded velocity lookahead is capped at 40 px.
- The regression scores the target segment after a 10 px player-half-width
  inset. Every consecutive route jump across 160 seeds exposes at least 40 px
  at both 320 and 375 px.

## QR-013 — complete-playthrough failure

The baseline production-build run began before the mobile wall and camera changes and
finished after 1,579,427 ms without a summit:

- 1,200 total jumps;
- 627 advancing landings;
- 400 falls;
- final support: `ledge-orbital_scrapyard-4`;
- 105 failed attempts to advance from opening ledge 6 to ledge 7.

This is not yet proof that the route is impossible. The same report shows the
mechanical harness resetting its local retry counter after every run-ending
fall, preventing the requested eight/forty-attempt fail-fast limit. More
importantly, ledge 7 sits beside the right wall, so the corrected mobile edge
changes the available bounce timing. A bounded post-fix run cleared that ledge
and reached `crater_foundry` within 100 jumps.

After restoring the desktop outer edge, the canonical mobile rerun crossed that
opening route and reached `comet_reef`. It stopped at ledge 36 because the
replay controller reused one target-wide attempt number for several different
approaches, forcing the same overshooting direct jump every time the player
returned to ledge 35. A source-target approach counter cleared that blocker.

A second replay defect then surfaced: the controller could judge a landing
before the released jump input had produced an airborne frame, and it could
trust a stale `lastPlatformId` while the player was visibly standing on a
nearby obstacle. Waiting for a real airborne transition and resolving support
from player geometry moved checkpointed probes through Ring Citadel, Dwarf
Garden, Pulsar Spine, Neutron Forge, and into Black Hole Chapel. The probe then
cycled between the previous checkpoint and early Black Hole Chapel until its
320-jump budget expired.

The Black Hole and Galaxy probes isolated two final controller defects:

1. It alternated into a reverse wall-bounce launch even when the route jump was
   unobstructed.
2. While rising below a target, it steered toward a point outside the platform
   using the ascending time-to-height root. Compact lateral steps therefore
   started braking after their safe landing window had passed.

The fixed controller uses physical support as route authority, launches
directly on the default route, remembers a successful source-target approach,
and projects horizontal correction to the descending platform-height
intersection. This moved the Galaxy checkpoint probe to the summit in 36 jumps
with no non-advancing falls.

The canonical 375×812 production-build replay then completed the uninterrupted
local-practice route:

- all 155 non-obstacle route platforms;
- all 11 zone clears and a screenshot for every zone;
- 158 controlled jumps over 170 seconds;
- the intentional opening mutation fall;
- five recovered non-advancing fall outcomes;
- one summit event and final `summitSent: true`;
- zero page exceptions.

The report and captures are in
[`full-playthrough-fixed`](evidence/full-playthrough-fixed/). The expected
static-server `/api` 404 means this is local-practice mechanical evidence, not
authenticated shared-state evidence.

QR-013 is closed as a replay-controller defect. The result proves the current
default route can be completed with the shipped movement model and the
mobile-only boundary correction; it does not claim a broader difficulty or
human-feel approval.
