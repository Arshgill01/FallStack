---
name: fallstack-art-director
description: Direct Fallstack visual redesigns from baseline capture through Figma concept selection, controlled game-asset trials, Phaser compatibility proof, and a browser-validated opening-zone vertical slice. Use for Fallstack art direction, UI redesign, scene composition, asset-provider evaluation, visual-system changes, or requests to improve the game's aesthetic quality.
---

# Fallstack Art Director

Treat this as an art-direction workflow, not a frontend polish pass. Preserve gameplay and the pure/client/server boundary while making the tower, artifacts, shell, controls, and feedback read as one compact cursed diorama.

## Required context

Read `AGENTS.md`, `PRODUCT.md`, the Settled Grill Decisions in `fallstack_concept_log.md`, `fallstack/AGENTS.md`, and `fallstack/docs/design-redesign/status.md`. Inspect the current implementation and fresh mobile/desktop captures before proposing work.

Read [scorecard.md](references/scorecard.md) before evaluating directions or assets.

## Stage gates

Do not skip gates or silently change direction.

1. **Baseline:** build current production code and capture splash, 375x812 mobile, and 1280x800 desktop states. Record systemic problems, not isolated CSS symptoms.
2. **Directions:** create three compositionally distinct first-mobile-viewport directions in one native Figma file. Each must show the opening jump, existing community mutation, controls, and first-fall feedback. Variations that only change color or typography do not count.
3. **Selection:** score all three with the repository scorecard. Recommend one, record the user's selection, and freeze its visual grammar before implementation.
4. **Art bible:** define values, palette, materials, silhouettes, type, labels, scale, depth, motion, accessibility, and forbidden patterns. The five artifact types must remain distinguishable by shape and collision semantics.
5. **Asset bake-off:** trial Scenario and Layer with the same brief for one platform family, one artifact with states, and the player. Normalize outputs before comparison. Select at most one provider; do not subscribe or bulk-generate without explicit approval.
6. **Phaser proof:** prove selected assets import cleanly, retain transparency and scale, and work with Phaser 4.2.1 collision/display rules. Phaser Editor generated code must stay readable and must not absorb game logic or persistence.
7. **Vertical slice:** implement only the starting zone plus first-fall mutation. Do not migrate the remaining scene until the slice materially beats the baseline.
8. **Validation:** compare before/after at Reddit iframe sizes, verify reduced motion and touch controls, then run type-check, lint, tests, and build.

## Art-direction rules

- Make today's accumulated community failure visible before input.
- Keep the tower dominant; overlays are sparse and never hide a critical jump.
- Use chunky physical materials, damaged edges, depth layers, and stamped/in-world labels.
- Use washi, indigo, and persimmon as the starting grammar unless a scored direction demonstrates a stronger coherent system.
- Avoid programmer rectangles, debug labels, twelve unrelated zone palettes, generic pixel fantasy, neon gradients, card stacks, fake parchment overload, and Reddit mascot theming.
- Treat generated art as source material requiring cleanup, consistent dimensions, edge treatment, palette normalization, and provenance tracking.

## Stop conditions

Stop and surface the blocker when Figma is unauthenticated, paid-provider access is absent, Phaser Editor compatibility is unproven, or a user choice would materially change the selected direction. Continue with reversible repository work that does not depend on that handoff.

Update `fallstack/docs/design-redesign/status.md` at every gate with evidence, decisions, commands, and remaining handoffs.
