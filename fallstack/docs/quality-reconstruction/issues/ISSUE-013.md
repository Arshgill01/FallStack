# ISSUE-013 — complete-playthrough replay stalls below the summit

## Classification

- Severity: High
- Workstream: QA and tower finishability
- Ownership: Production-browser replay controller
- Baseline: `4e11711`
- Reproducibility: 100% at the isolated failing source-target pairs
- Current state: Fixed and production-replayed

## Observation

The original production-build replay exhausted 1,200 jumps without leaving the
opening zone. Incremental controller repairs moved checkpoint probes into Black
Hole Chapel, where they still cycled between earned checkpoints and nearby
ledges. This left the required complete mobile summit proof open.

The partial runs did not prove an impossible tower. Pure generation tests
already found a default path, while trace records showed the controller
declaring progress from stale platform labels and repeatedly selecting
approaches that contradicted the player's physical position.

## Ranked hypotheses and probes

1. Route progress trusts stale `lastPlatformId` after obstacle contacts and
   checkpoint respawns. Compare the label with geometric support under the
   player.
2. The controller invents reverse wall bounces for unobstructed route jumps.
   Run matched direct-only checkpoint probes.
3. Air correction predicts the first, ascending platform-height intersection
   and delays braking past the safe landing window. Compare projected positions
   at the ascending and descending roots.
4. A successful approach is lost when the same source-target pair recurs after
   a fall. Cache the first advancing approach per pair.

## Fix

- Resolve route authority from the platform physically supporting the player,
  with a same-height checkpoint fallback after administrative respawn.
- Wait for a real airborne frame before judging the jump.
- Use direct launches for the artifact-free default route.
- Reuse the first successful approach for a recurring source-target pair.
- Correct horizontal flight against the descending intersection with the
  target height and aim within its safe landing segment.

No tower geometry, movement constant, desktop/fullscreen boundary, or
production gameplay behavior changed.

## Result

Checkpoint probes reached the summit:

- Galaxy Reef: 36 jumps, 35 advancing landings, zero non-advancing falls.
- Dying Star Garden: 23 jumps, 22 advancing landings, zero non-advancing falls.
- Event Horizon Crown: 10 jumps, 9 advancing landings, zero non-advancing falls.

The final 375×812 Chromium run then completed all 155 route platforms from the
base in 158 controlled jumps over 170 seconds. It includes the intentional
opening fall, all 11 clears, every-zone screenshots, one summit event, and
`summitSent: true`. Five non-advancing fall outcomes recovered within the
40-attempt contract. Page exceptions were empty.

Evidence:
[report and screenshots](../evidence/full-playthrough-fixed/).

## Residual risk

This is deterministic mechanical evidence for the captured local-practice
route. It is not human difficulty approval, a broad seed-corpus simulator, or
authenticated shared-state verification. The local static server predictably
logs an `/api` 404 before falling back to practice mode.
