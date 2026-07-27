# ISSUE-008 — closed AudioContext recovery retains stale state

## Classification

- Severity: Medium
- Workstream: Audio lifecycle
- Ownership: Client audio-context replacement
- Baseline: `7c4e06f`
- Reproducibility: 100% in the forced-close probe
- Current state: Fixed and browser-regressed

## Observation

Replacing a closed context rebuilt buses and persistent music nodes but retained
charge references and several gameplay/music timers. Stale references could
suppress a new charge cue or later start duplicate work.

## Ranked hypotheses and probes

1. Charge and timer fields outlive the context. Inspect them before replacement.
2. A pending music start/stop races the new graph. Close during each timer phase.
3. Recovery creates more than one new context. Instrument constructors.

## Regression seam

`npm run qa:audio-lifecycle` closes the context during active state, resumes,
starts charge again, and counts contexts, sources, timers, and page errors.

## Fix and result

Recovery clears charge state and every gameplay, music-start, music-stop, and
bell-loop timer before creating one replacement graph. The
[lifecycle report](../evidence/audio-lifecycle-fix/audio-lifecycle.json)
records exactly one replacement context and a working new charge cue. Commit:
`e7a4af2`.

## Residual risk

Forced `close()` is a deterministic proxy for browser interruption. Chromium
and WebKit runtime smokes cover normal suspend/resume behavior separately.
