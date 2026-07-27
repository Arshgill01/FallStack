# ISSUE-009 — Phaser creates an unused second AudioContext

## Classification

- Severity: Medium
- Workstream: Audio ownership
- Ownership: Phaser bootstrap configuration
- Baseline: `7c4e06f`
- Reproducibility: 100% under constructor instrumentation
- Current state: Fixed and browser-regressed

## Observation

Runtime instrumentation found two AudioContexts although Fallstack loads no
Phaser audio assets and routes every cue through `ProceduralSound`.

## Ranked hypotheses and probes

1. Phaser's default audio manager owns the second context. Attribute constructor
   stacks and disable Phaser audio.
2. `ProceduralSound` mounts twice. Count React instances and graph owners.
3. Recovery, not startup, creates the duplicate. Compare fresh and closed-state
   counts.

## Regression seam

`npm run qa:audio-lifecycle` instruments AudioContext construction on fresh
load and recovery while exercising gameplay sound.

## Fix and result

Phaser now boots with `audio.noAudio`; `ProceduralSound` remains the sole
intentional owner. The
[green report](../evidence/audio-lifecycle-fix/audio-lifecycle.json) records one
initial context without losing cues. Commit: `e7a4af2`.

## Residual risk

Future Phaser-loaded audio assets would require revisiting this explicit
ownership decision.
