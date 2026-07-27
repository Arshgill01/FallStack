# ISSUE-003 — gameplay cues lack collision meaning

## Classification

- Severity: High
- Workstream: Gameplay sound design
- Ownership: Phaser event emission and client `ProceduralSound`
- Baseline: `4e11711`
- Reproducibility: 100% in the deterministic palette reel
- Current state: Implemented and browser-verified; human listening decision open

## Observation

The baseline used one biome-selected oscillator ping for every landing, emitted
that same landing event for a wall bounce, and had no sound IDs for an artifact
collapse or summit. Soft and hard stone landings therefore had identical input
to the sound layer. Unknown review cues fell through to one generic noise burst.

Player impact: collision weight and material were unclear, a wall strike implied
a floor landing, and checkpoint/summit progress lacked a trustworthy hierarchy.

## Ranked hypotheses and probes

1. The event contract cannot express the distinction. Probe real gameplay event
   payloads for landing, wall contact, and artifact expiry.
2. Oscillator-only cues erase material identity. Render the same ordered cue
   sequence before and after a noise/resonance palette and compare both the
   capture and spectrum.
3. Landing loudness cannot react to impact because impact velocity is lost at
   collision. Sample pre-contact velocity and lock its bounded mapping in a pure
   test.
4. Adding short noise sources could regress immediate mute or lifecycle cleanup.
   Count oscillator and buffer-source starts around SFX Off and rerun the
   twenty-cycle lifecycle probe.

## Regression seams

- `landingProfile()` proves bounded impact weight and distinct material
  frequency profiles.
- `npm run qa:audio-events` performs an actual jump and wall collision. Its
  current report contains a stone route landing at impact `740`, a left wall
  bonk at impact `353`, and zero simultaneous fake landing events.
- `npm run qa:audio-palette` records a deterministic final-master A/B reel with
  charge/cancel, three charged launches, soft/hard stone, metal, ghost, wall
  bonk, two collapse types, fall, mutation, checkpoint, and summit.
- `npm run qa:audio-lifecycle` now instruments oscillator and buffer sources.
  Immediate SFX Off starts zero delayed sources and leaves peak/RMS at zero.

## Fix

- Landing events now carry material, surface role, and bounded pre-contact
  impact speed.
- Wall bonk and artifact collapse have separate events and sound IDs.
- Launch uses charge strength; checkpoint and summit use separate cues.
- Gameplay pings were replaced by deterministic noise/resonance pairs with
  material profiles and explicit progress hierarchy.
- Short-lived oscillator, buffer, filter, and gain nodes disconnect on
  completion.
- The final-master preview API remains available only on `?qa=audio`.

## Result and evidence

- [Baseline reel](../evidence/sfx-palette-comparison/baseline.webm) and
  [tactile reel](../evidence/sfx-palette-comparison/tactile.webm) are both
  14.34-second stereo Opus captures at 48 kHz with identical cue order.
- [Baseline spectrum](../evidence/sfx-palette-comparison/baseline-spectrum.png)
  and [tactile spectrum](../evidence/sfx-palette-comparison/tactile-spectrum.png)
  show the added transient and resonant structures.
- The tactile reel measures `-30.8 LUFS`, `15.3 LU` LRA, and `-18.8 dBFS` true
  peak. The baseline measures `-29.0 LUFS`, `17.6 LU` LRA, and `-14.8 dBFS`
  true peak.
- The [real gameplay capture](../evidence/sfx-gameplay-capture/final-master.webm)
  measures `-29.2 LUFS` and `-16.8 dBFS` true peak.
- The [event contract report](../evidence/sfx-event-contract/audio-events.json)
  proves the real landing/wall distinction.
- The [lifecycle report](../evidence/sfx-lifecycle/audio-lifecycle.json) proves
  immediate mute, rapid toggles, and closed-context recovery with the new
  buffer-based cues.

Chromium and WebKit runtime smokes, 151 tests, type-check, lint, build, and
`git diff --check` pass. The known Phaser chunk warning remains.

## Residual risk

Automated signal, spectrum, and event evidence cannot approve timbre, fatigue,
or product fit. QR-003 remains at the listening gate until the baseline and
tactile reels are reviewed on the current Mac output. QR-004 background music
is unchanged and must be judged separately.
