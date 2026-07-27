# ISSUE-007 — SFX Off does not silence queued cues

## Classification

- Severity: Medium
- Workstream: Audio lifecycle
- Ownership: Client gameplay bus and cue timers
- Baseline: `7c4e06f`
- Reproducibility: 100% between a primary and secondary tone
- Current state: Fixed and browser-regressed

## Observation

The mute flag rejected new top-level `play()` calls but did not mute the
gameplay bus. Delayed launch, fall, and checkpoint callbacks could therefore
start after the user selected SFX Off.

## Ranked hypotheses and probes

1. Queued callbacks bypass the top-level mute check. Disable between tones.
2. Existing tails remain audible because the bus stays open. Measure final
   master immediately after the toggle.
3. Cancelling timers could disturb music. Verify independent buses.

## Regression seam

`npm run qa:audio-lifecycle` toggles between launch tones and asserts zero
delayed starts, silent gameplay peak/RMS, and unchanged music state.

## Fix and result

The gameplay bus ramps silent immediately, pending gameplay timers are
cancelled, and secondary callbacks recheck the preference. The
[green report](../evidence/sfx-lifecycle/audio-lifecycle.json) starts only the
intentional primary launch source and records silence after Off. Commit:
`e7a4af2`.

## Residual risk

The deterministic probe cannot measure the perceived fade shape on every
physical output device.
