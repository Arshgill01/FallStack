# Phase 22 — Visual Polish & Animations

> Add restrained particles, transition polish, artifact motion, and tactile effects that make the game feel finished without hiding readability.

---

## Context

By this phase, the game loop should work. Polish should sharpen the hook, not add decoration for its own sake. Every visual effect must preserve mobile readability and reduced-motion support.

---

## What This Phase Builds

### Event Effects

Add small effects for:

- jump launch dust
- landing puff or impact line
- fall mutation chime flash
- artifact threshold spawn shimmer
- checkpoint clear glow
- summit arrival emphasis

Effects should be short and tactile.

### Artifact Motion

- Cursed Brick: wobble/crack warning.
- Ghost Platform: subtle opacity pulse.
- Lantern Trail: faint route glow.
- Stabilized artifacts: calmer, steadier state.

With reduced motion, replace motion with static outlines, cracks, or opacity changes.

### Camera Effects

Optional:

- Very brief fall impact shake.
- Checkpoint settle.

Disable cosmetic shake for reduced-motion users.

### UI Micro-Interactions

- Mutation banner entrance/exit.
- Button pressed states.
- Result card open/close.
- Badge state changes.

Keep transitions fast. Do not block play.

---

## Key Technical Considerations

- Do not use large particle systems in a Reddit iframe.
- Effects should be clipped or bounded so they do not overlap HUD text.
- Prefer a few strong effects over many ambient ones.
- Reduced-motion must be checked in both DOM and Phaser layers.

---

## How to Know It's Working

- Jumping, landing, falling, mutation, and checkpoint events feel tactile.
- Artifacts remain readable during motion.
- Reduced-motion mode removes cosmetic movement without making the game harder to understand.
- Mobile framerate remains stable.
- The page does not read as a generic effects-heavy platformer.

