# ISSUE-005 — rapid Music Off/On overlaps bell tails

## Classification

- Severity: Medium
- Workstream: Audio lifecycle
- Ownership: Client `ProceduralSound`
- Baseline: `7c4e06f`
- Reproducibility: 100% under the rapid-toggle probe
- Current state: Fixed and browser-regressed

## Observation

Scheduled bell voices were not owned by `musicNodes`. Turning Music off started
a delayed cleanup; turning it on before that cleanup reopened the bus and
started a new pair while the old 2.8-second tails remained.

## Ranked hypotheses and probes

1. Bell voices are untracked. Attribute every source to a graph generation.
2. The delayed stop races a new start. Run twenty rapid and normal cycles.
3. Bus reopening, not oscillator gain, makes old tails audible. Record active
   sources and final-master level together.

## Regression seam

`npm run qa:audio-lifecycle` records source IDs, graph ownership, timers, bus
state, and output after twenty cycles.

## Fix and result

Bell voices are tracked separately and stopped during the Music Off ramp. The
red probe ended with seven active oscillators; the
[green lifecycle report](../evidence/audio-lifecycle-fix/audio-lifecycle.json)
ends with the intentional three persistent sources plus the current two-note
pair. Commit: `e7a4af2`.

## Residual risk

Source-count stability proves lifecycle ownership, not musical fatigue or mix
quality.
