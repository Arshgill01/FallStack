# Audio reconstruction record

## Current production system

`ProceduralSound` owns one custom WebAudio context, separate gameplay/music gain
buses, a shared master/compressor/analyser chain, and persisted Music/SFX
preferences.

The shipped background music is procedural:

- triangle drone at 146.83 Hz;
- sine drone at 220 Hz;
- slow filter modulation;
- two sine-bell notes every 4.4 seconds;
- an eight-note phrase that fully repeats every 17.6 seconds.

There are no shipped game music assets, biome transitions, event ducking, or
long-session arrangement changes. Files under `fallstack/video/` belong to the
pitch-video pipeline and are not production-game assets.

## What the latest pull fixed

- Music starts based on source/pending state rather than the always-created
  output bus.
- Normal Music Off/On restart has local and hosted oscillator-count evidence.
- Broader context resume, output priming, faster startup, higher levels, SFX
  preview, and combined peak/RMS diagnostics were added.
- Music and SFX now have separate UI state, local-storage keys, controls, and
  buses.
- Touch input resets after a fall.

## Evidence limit

The existing archive proves source scheduling, context state, and signal
activity for the earlier fix. It does not prove the current post-`da850d9`
levels are audible, balanced, non-fatiguing, or good. Existing Playwright videos
contain video only. Current diagnostics observe the combined master and cannot
attribute music versus SFX.

Gate 0 now adds a browser-native recorder at the final master:

- The first harness run failed because the recorder did not exist, preserving
  the missing feedback-loop evidence.
- The recorder is exposed only on `?qa=audio` and fans out from the existing
  post-compressor analyser without replacing speaker playback.
- [`evidence/baseline-audio/final-master.webm`](evidence/baseline-audio/final-master.webm)
  is 5.82 seconds of stereo Opus at 48 kHz.
- [`evidence/baseline-audio/audio-capture.json`](evidence/baseline-audio/audio-capture.json)
  records 93,698 bytes, peak `0.0938`, RMS `0.057`, and the structured gameplay
  events heard by the sound layer.
- FFmpeg measured integrated loudness at `-29.1 LUFS`, loudness range at
  `0.9 LU`, and true peak at `-14.3 dBFS`.

These values prove a recordable, non-clipped signal and establish a baseline.
They do not approve composition, timbre, fatigue, or event semantics.

## Ranked diagnosis queue

### QR-002 — false landing events

Observed source behavior:

- `wasGrounded` begins false.
- The readiness branch waits for a settled player but does not initialize
  `wasGrounded`.
- The first normal frame therefore dispatches `fallstack:land`.
- `respawn()` resets the body onto a checkpoint without setting
  `wasGrounded = true`, so the next normal frame can dispatch another land event
  after the fall cue.
- Wall bounce also dispatches `fallstack:land`.

Ranked hypotheses:

1. False initial and post-respawn transitions layer unexpected oscillators onto
   first unlock and fall/respawn, matching the reported glitches.
2. Wall-bounce-as-land makes collision feedback feel inconsistent even when
   source scheduling is correct.
3. Suspended-context scheduling makes the first false cue more noticeable on
   Safari/mobile than in a running desktop context.

Required probe: capture structured event timestamps and per-bus audio-source
starts for initial readiness, real floor land, wall bonk, fall, and respawn.

Reproduction on 2026-07-27:

- A fresh 375×812 Chromium load emitted `ready` at 709.1 ms and `land` at
  841.0 ms without any player input or airborne state.
- A second fresh load emitted `ready`, the same false initial `land`, one real
  `fall`, then another `land` 116.8 ms after fall while the player was reset to
  the checkpoint.

This confirms the event defect. Final audio impact still requires the master-bus
capture because browser autoplay/context state determines which scheduled cue is
audible. That capture now exists and contains the false initial `land` at
709.4 ms, followed by the intentional charge/launch and a real landing at
1592.3 ms. The regression must distinguish the first false transition from the
later real landing rather than suppressing all landing events.

Fix and regression:

- Scene readiness now initializes grounded history from the settled physics
  body.
- Respawn marks the next checkpoint settlement as administrative and consumes
  that one transition without publishing a landing.
- Chromium runtime reports zero opening-settle and zero reset landing events.
- The
  [`landing-fix-audio` capture](evidence/landing-fix-audio/audio-capture.json)
  has no `land` before `launch` and retains the real landing after the flight.

### QR-005 — rapid music toggle overlap

Persistent drone/filter nodes are stored in `musicNodes`; scheduled bell
oscillators and their gain/filter nodes are not. Music Off ramps the shared
music bus down and waits 420 ms before cleanup. If Music turns On during that
window, the bus reopens and a new bell pair starts while old 2.8-second tails
remain alive.

Required probe: run twenty normal and rapid Off/On cycles while recording
source IDs, timer IDs, bus gain, and output level. Exactly one music graph may
remain and output level must not rise by cycle count.

Fix: bell voices are tracked independently from the persistent drone graph and
are stopped during the Music Off ramp. The browser probe reproduced seven
active oscillators before the fix; after twenty Off/On cycles it now ends with
five active oscillators: three persistent modulation/drone sources and the
current two-note bell pair.

### QR-006 — legacy mute migration

Initial gameplay mute state ORs `fallstack:gameplay-muted` with the legacy
combined `fallstack:muted` key. The legacy key is not removed after a user turns
SFX on. Returning users with legacy `true` can therefore see SFX turn off again
on reload.

Required probe: exercise all legacy/new key combinations through two reloads.

Fix: an explicit `fallstack:gameplay-muted` value now wins over the legacy key,
and the legacy key is removed when the current preference persists. The browser
probe begins with new `false` plus legacy `true` and now renders `SFX On`.

### QR-007 — SFX Off is not immediate

SFX mute prevents new `play()` entry calls but does not mute the gameplay gain
bus. Secondary launch, fall, and checkpoint tones are scheduled with timers that
call `ping()` later without rechecking mute state.

Required probe: switch SFX Off between the primary and secondary tone, verify
the gameplay bus becomes silent immediately, then restore without affecting
music.

Fix: the gameplay bus ramps silent immediately, queued gameplay timers are
cancelled, and secondary callbacks recheck mute state. The launch probe now
starts one oscillator instead of two when SFX is switched off between tones.

### QR-008 — closed-context stale state

Closed-context recovery resets buses and `musicNodes`, but not every charge
reference, music interval, or start/stop timer. Stale state can suppress a new
charge source or start duplicate loops.

Required probe: close/recreate the context during charge and during each music
timer phase. Verify no stale source/timer survives.

Fix: closed-context replacement clears charge references plus gameplay, music
start, music stop, and bell-loop timers before building the new graph. The
browser probe creates exactly one replacement context, starts charge audio
again, and records no page errors.

### QR-009 — redundant AudioContext

Local and hosted instrumentation reports two contexts. The likely explanation
is the custom `ProceduralSound` context plus Phaser's default audio manager.
Fallstack does not intentionally use Phaser audio.

Required probe: attribute context construction and confirm whether configuring
Phaser with no audio reduces the runtime to one intentional owner without
affecting the game.

Fix: Phaser is configured with `audio.noAudio` because Fallstack owns no Phaser
audio assets or calls. Browser constructor instrumentation now records one
initial `AudioContext` instead of two.

The consolidated evidence is
[`audio-lifecycle.json`](evidence/audio-lifecycle-fix/audio-lifecycle.json).

## Gameplay SFX palette checkpoint

QR-003 now has a semantic and tactile implementation:

- `LandEventDetail` carries material, surface role, and pre-contact impact
  speed.
- Wall bonk and artifact collapse are separate events instead of false landing
  aliases.
- Launch receives charge strength, and summit no longer reuses checkpoint.
- Landing profiles cover route stone/metal/moon/obstacle/summit surfaces plus
  corpse, Mercy, ghost, and cursed artifacts.
- Deterministic filtered noise provides onset/material while short resonances
  provide weight. This replaces the baseline's mostly plain oscillator pings.

The deterministic comparison is stored under
[`evidence/sfx-palette-comparison`](evidence/sfx-palette-comparison/):

| Capture            | Duration | Integrated loudness |     LRA |  True peak |
| ------------------ | -------: | ------------------: | ------: | ---------: |
| Baseline `4e11711` |  14.34 s |          -29.0 LUFS | 17.6 LU | -14.8 dBFS |
| Tactile checkpoint |  14.34 s |          -30.8 LUFS | 15.3 LU | -18.8 dBFS |

Both final-master reels are stereo Opus at 48 kHz and contain the same ordered
review sequence: charge/cancel, three charged launches, soft/hard stone,
metal, ghost, wall bonk, ghost/cursed collapse, fall, mutation, checkpoint, and
summit. The baseline sound class did not recognize wall, collapse, or summit,
so those entries honestly exercise its generic fallback.

The analyser is intentionally diagnostic rather than a taste score. It does
show that soft and hard stone are no longer identical: in the current capture
the hard landing reaches RMS `0.0157` versus `0.0073` for the soft landing. The
spectra also show broader transient and resonant structures across the event
sequence.

Real gameplay evidence is separate from the preview reel:

- [`sfx-event-contract/audio-events.json`](evidence/sfx-event-contract/audio-events.json)
  records an actual stone landing at impact `740`, a left wall bonk at impact
  `353`, and zero fake simultaneous landing events.
- [`sfx-gameplay-capture/final-master.webm`](evidence/sfx-gameplay-capture/final-master.webm)
  records charge, launch, and that real landing at `-29.2 LUFS` with a
  `-16.8 dBFS` true peak.
- The updated lifecycle probe counts noise buffers as well as oscillators.
  [`sfx-lifecycle/audio-lifecycle.json`](evidence/sfx-lifecycle/audio-lifecycle.json)
  records zero delayed sources after immediate SFX Off and a silent final bus.

Issue details and residual risk are in
[`issues/ISSUE-003.md`](issues/ISSUE-003.md). This checkpoint passes automated
signal, event, lifecycle, and browser gates. It is not a human listening
approval: the two reels still need review on the current Mac output for timbre,
fatigue, timing clarity, and damaged-reliquary fit.

## Music direction gate

The current bed is too static to satisfy the requested cozy soundtrack:

- mono and harmonically unchanged;
- complete melodic repetition every 17.6 seconds;
- no Lower Ruins, Bell Shaft, or Moon Roof response;
- no fall/checkpoint/summit relationship;
- no Guide/Memory/background policy;
- no current captured listening evidence.

The replacement must be original and provenance-recorded. Jump King remains a
mood/interaction reference, not a source of melodies or assets.

Three original concept directions now provide a controlled selection gate. Each
preview is 48 seconds long and gives Lower Ruins, Bell Shaft, and Moon Roof
exactly 16 seconds. They are level-matched closely enough that preference is not
decided by loudness:

| Direction | Structure | Integrated | LRA | True peak |
| --- | --- | ---: | ---: | ---: |
| [A — Mended Lantern](evidence/music-directions/a-mended-lantern.webm) | Sparse Dorian plucks, thread brush, wood, restrained bells | -22.1 LUFS | 6.5 LU | -9.7 dBFS |
| [B — Crooked Procession](evidence/music-directions/b-crooked-procession.webm) | Five-beat wood/wire procession that sheds weight while climbing | -22.0 LUFS | 5.6 LU | -9.5 dBFS |
| [C — Breathing Reliquary](evidence/music-directions/c-breathing-reliquary.webm) | Pulse-free breaths, harmonic chambers, and distant glass | -22.0 LUFS | 6.3 LU | -9.7 dBFS |

The [comparison report](evidence/music-directions/music-directions.json)
records the provisional design-intent scorecard, timeline, signal hashes,
stream metadata, spectra, and provenance. The source is
[`scripts/qa/music-directions.mjs`](../../scripts/qa/music-directions.mjs):
mathematical oscillators and seeded noise written for Fallstack, with no
external assets. A second render produced identical PCM hashes for all three
directions. Maximum adjacent-sample deltas are `0.035–0.089`, below the
discontinuity guard, and every true peak remains below `-9.5 dBFS`.

These are concept previews, not production music. The provisional scores are an
authoring assessment rather than a listening approval. QR-004 remains at the
selection gate until the user reviews the three previews on the current Mac and
chooses a direction. Production integration must then prove adaptive
transitions, event ducking, mute/resume behavior, source cleanup, a ten-minute
capture, and in-context fatigue.
