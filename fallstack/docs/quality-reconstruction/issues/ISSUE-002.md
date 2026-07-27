# ISSUE-002 — readiness and respawn emit false landings

## Classification

- Severity: High
- Workstream: Audio event correctness
- Ownership: Phaser grounded-state history
- Baseline: `7c4e06f`
- Reproducibility: 100%
- Current state: Fixed and browser-regressed

## Observation

An untouched scene emitted `fallstack:land` immediately after readiness.
Checkpoint teleportation after a fall emitted another landing without a new
airborne contact, layering landing sound onto startup and fall/respawn.

## Ranked hypotheses and probes

1. `wasGrounded` is false when the readiness branch hands control to the normal
   update loop. Count events before input.
2. Respawn body reset creates the same false transition. Count fall and landing
   timestamps around one real fall.
3. Suppressing all landings would hide real contacts. Capture a later real
   launch/landing in the same master-bus sequence.

## Regression seam

The runtime smoke asserts zero opening-settle and reset landings. The audio
capture records structured events alongside the final master and requires a
real post-launch landing to remain.

## Fix and result

Readiness initializes grounded history from the settled body. Respawn consumes
exactly one administrative checkpoint settlement. The
[baseline matrix](../evidence/gate-1-baseline/baseline-matrix.json) records one
landing before input and a second after respawn; the
[green capture](../evidence/landing-fix-audio/audio-capture.json) records none
before launch while retaining the real landing. Commit: `e358181`.

## Residual risk

Browser event proof does not by itself approve the landing timbre; that belongs
to the QR-003 listening gate.
