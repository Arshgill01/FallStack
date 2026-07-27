# ISSUE-004 — background music fully repeats every 17.6 seconds

## Classification

- Severity: High
- Workstream: Background music
- Ownership: Client `ProceduralSound`
- Baseline: `7c4e06f`
- Reproducibility: 100% by source inspection and final-master capture
- Current state: Three original directions ready; user listening selection open

## Observation

The production score is two fixed drones plus two bell notes every 4.4 seconds.
Its eight-note phrase repeats every 17.6 seconds. It has no relationship to the
three reliquary biomes, falls, checkpoints, summit, Guide, Tower Memory,
backgrounding, or reduced motion.

Player impact: a long precision climb receives a short, unchanging loop that
cannot reinforce height, material, or progress and has a high repetition risk.

## Direction brief

Each direction must be original, copyright-safe, restrained under tactile SFX,
and compositionally different rather than an EQ variant. The comparison gives
Lower Ruins, Bell Shaft, and Moon Roof equal time:

- **A — Mended Lantern:** sparse plucks and cloth/stone texture; warmest and
  lowest predicted fatigue, with deliberately subtle biome contrast.
- **B — Crooked Procession:** a five-beat wood, wire, and rope mechanism;
  strongest vertical identity and contrast, with the highest pulse-fatigue
  risk.
- **C — Breathing Reliquary:** pulse-free air, slow harmonic chambers, and
  distant glass; most spacious, with the least explicit climb momentum.

## Reproducible comparison

`npm run qa:music-directions -- <output>` generates three 48-second stereo Opus
previews, spectra, stream metadata, loudness/true-peak measurements, timeline,
provenance, and a provisional authoring scorecard.

The generator uses only original mathematical oscillators and seeded noise.
There are no external samples or music assets. A repeated render produces
identical PCM signal hashes. The three previews measure `-22.1…-22.0 LUFS`,
`5.6…6.5 LU` LRA, and `-9.7…-9.5 dBFS` true peak. Maximum adjacent-sample
deltas are `0.035…0.089`.

Evidence:
[previews, spectra, and report](../evidence/music-directions/).

## Selection and implementation gate

No direction is selected or shipped. Human listening must judge product fit,
coziness, cursed/tactile identity, gameplay clarity, biome coherence,
repetition, and fatigue. After user selection, production work still needs:

- a long-form arrangement and transition policy;
- fall/checkpoint/summit ducking or response;
- Guide, Tower Memory, background, and reduced-motion behavior;
- mute/resume and source-lifecycle regression;
- a ten-minute in-context capture with technical and human scorecards.

Automated loudness, spectra, and discontinuity checks cannot close this issue.
