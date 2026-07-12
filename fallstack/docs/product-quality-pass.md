# Product Quality Pass

Evidence-backed checklist for the astronomy/gameplay redesign begun 2026-07-12.

## Current diagnosis

- The shared-mutation hook is present in seeded artifacts, but a transient network-state banner obscures the opening route.
- Cosmic zones mostly differ through palette and background line art; platform silhouettes remain too uniform.
- The generated route is valid but reads as one long alternating staircase. Existing wall rebound physics lacks clearly authored places to use it.
- Wide desktop layouts dilute the compact diorama by stretching the canvas across large empty areas.
- `game-app.tsx` owns scene physics, rendering, effects, labels, and React wiring. Future visual iteration should extract cohesive modules only after behavior has screenshot and gameplay coverage.

## Direction

Fallstack should feel like a damaged astronomical instrument the subreddit is collectively repairing and corrupting. Space is the setting; community-authored scars are the subject. Keep the lacquer, verdigris, ashlight, and persimmon palette instead of switching to generic blue-purple sci-fi.

## Implementation checklist

### First playable viewport

- [x] Preserve seeded community artifacts and in-world origin labels.
- [x] Move transient state feedback out of the central jump lane.
- [ ] Put one helpful artifact directly on the obvious opening route and one cursed artifact on a tempting alternate route.
- [ ] Make the first fall feedback point to the exact affected ledge and next threshold.

### Traversal grammar

- [x] Add deterministic optional ricochet chimneys while keeping the default ledge route clear.
- [ ] Replace uniform procedural steps with tested chunk archetypes: switchback, chimney, orbit gap, narrow shelf, recovery bowl, and checkpoint approach.
- [ ] Give each archetype an explicit entrance, exit, recovery behavior, and reachability test.
- [ ] Telecast wall-bounce surfaces by silhouette and edge treatment, not color alone.
- [ ] Keep one global charge model; biome forces may alter the puzzle but not redefine the controls.

### Celestial world art

- [ ] Give every zone one dominant landmark silhouette visible during play: broken moon, ring engine, nebula vault, pulsar mast, black-hole chapel, or dying sun.
- [ ] Tie animation to mechanics: accretion flow shows pull, comet trails show wind, pulsar timing shows force pulses.
- [ ] Reduce low-information scratches and repeated orbital ellipses.
- [ ] Add depth through three restrained parallax planes without hiding platforms or artifacts.
- [ ] Support reduced motion with equivalent static cues.

### Shell and HUD

- [x] Restore a compact desktop diorama width.
- [ ] Collapse sound controls into one compact accessible control without hiding their state.
- [ ] Keep community totals readable but visually subordinate to the tower.
- [ ] Ensure banners never cover the player's next landing on mobile or desktop.
- [ ] Verify touch targets, safe areas, contrast, and keyboard focus.

### Architecture and verification

- [ ] Extract pure world-art descriptions from Phaser rendering.
- [ ] Extract tower chunk generation from route stitching.
- [ ] Add deterministic screenshot states for opening, checkpoint, fall mutation, and each biome family.
- [ ] Add a movement simulator that evaluates actual arcs and wall rebounds, not only center-distance budgets.
- [ ] Playtest representative seeds on mobile and desktop before deployment.

## Reference principles

- Committed hold/release jumping stays familiar; route design supplies variety.
- Wall rebounds should be visibly invited and optional before they become demanding.
- Landmarks should teach physics and orientation, not merely decorate the backdrop.
- A community artifact must be readable as cause, mechanical effect, and aggregate history in the same viewport.
