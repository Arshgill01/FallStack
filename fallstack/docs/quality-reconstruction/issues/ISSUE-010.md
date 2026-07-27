# ISSUE-010 — player-centred camera hides the committed landing

## Classification

- Severity: Medium
- Workstream: Camera and route readability
- Ownership: Pure camera layout consumed by Phaser
- Baseline: `7c4e06f`
- Reproducibility: One failing connector in the 160-seed narrow sample
- Current state: Fixed and regression-tested

## Observation

At narrow widths, a strictly player-centred camera could show none of the usable
next landing at takeoff on a maximum lateral jump. The route remained
mathematically reachable, but the committed target was not readable.

## Ranked hypotheses and probes

1. Camera centring ignores committed direction. Score the usable landing
   segment at takeoff, apex, and descent.
2. Platform centre is the wrong visibility metric. Inset by player half-width.
3. Geometry is defective. Compare the same route with directional lookahead
   before changing generation.

## Regression seam

`src/client/game/layout.test.ts` evaluates 160 deterministic seeds at 320 and
375 px using movement constants and the safe target segment.

## Fix and result

Committed charge and flight apply 64 px directional lookahead; grounded
velocity lookahead stays capped at 40 px. The red calculation found a 0 px
usable target; the green sample exposes at least 40 px for every consecutive
route jump. No route geometry changed. Commit: `4e11711`.

## Residual risk

The deterministic corpus is broad but finite and is not a human difficulty
rating.
