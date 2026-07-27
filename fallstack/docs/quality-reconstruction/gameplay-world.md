# Gameplay and world-boundary record

## Current bounds model

- The logical route is 480 px wide.
- On narrow viewports, the camera follows horizontally across the 480 px route.
- On wider viewports, `gameWorldWidth()` expands the physics world to the full
  canvas and centres the 480 px route with `currentRouteOffset`.
- The player collides with the expanded physics world bounds.
- The reliquary backdrop paints a 480 px route cavity and wall planes, but those
  painted wall planes do not have continuous collision bodies.

## QR-001 — physical and visual walls disagree

Runtime inspection at 1280×800 measured a 760 px game world with the 480 px route
centred at approximately x=140–620. Physics bounds remained x=0–760. The painted
reliquary wall is therefore not the actual movement boundary; a player can move
behind the architecture before reaching the world edge. Narrow mobile keeps a
smaller version of the same semantic mismatch between the inner painted wall and
the x=0/480 physics boundary.

This directly matches the user's report more closely than out-of-bounds tower
generation.

Ranked hypotheses:

1. The visual cavity was introduced as presentation only while the responsive
   world continued to use canvas bounds, creating an unintended playable gutter.
2. The narrow horizontally following camera made the full logical route
   accessible but did not establish a shared safe route boundary.
3. Generated ledges near the older opening margin make the mismatch easier to
   discover but are not themselves outside `WORLD_WIDTH`.

Required feedback loop:

- expose player x, camera scroll, physical world bounds, and painted route bounds;
- drive deliberate left/right wall contact at 320×568, 375×812, 480 px, and
  1280×800;
- assert the player never crosses the selected shared route boundary and remains
  visible with a safe margin;
- preserve a complete summit playthrough.

Do not choose between physical wall bodies, player clamping, or different
responsive bounds until the browser loop identifies the smallest fix compatible
with wall-bounce behavior.

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

