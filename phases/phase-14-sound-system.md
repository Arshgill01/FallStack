# Phase 14 — Sound Effects & Audio Feedback

> Add audio feedback for key game moments — jump charge, launch, landing, fall, mutation events, checkpoint clear, and cursed zone ambiance. Sound makes the game feel physical and alive.

---

## Context

The game is playable but silent. Every action — charging a jump, landing on a ledge, falling into the void — happens without audio feedback. Sound is what makes a game feel physical. Without it, jumps feel floaty, landings feel weightless, and mutations happen without ceremony.

The aesthetic established in PRODUCT.md and the mockups is washi paper, indigo ink, stone, and iron. Sounds should match: wooden, papery, organic, tactile. Not chiptune. Not sci-fi. Think the sound of a stone placed on a Go board, a paper fan snapping open, a temple bell struck lightly.

Audio in a Reddit post iframe has specific constraints. Browsers block audio playback until a user interaction event (click or touch). Reddit posts appearing in feeds should not auto-play sound — that's hostile UX. Sound must be opt-in or at least instantly mutable.

---

## What This Phase Builds

### Sound Effects Catalog

Each game moment gets a corresponding sound. These are short, quiet, and tactile:

| Event | Sound Character | Notes |
|-------|----------------|-------|
| **Jump charge** | Rising tone — tension building | Pitch ascends as charge fills. Could be an oscillator sweep or a short ascending sample. |
| **Jump release/launch** | Percussive pop or breathy whoosh | Sharp onset, fast decay. Signals commitment — the jump is committed. |
| **Landing (Ruins)** | Stone thud | Low, muted impact. Like dropping a pebble on flagstone. |
| **Landing (Bell)** | Metallic clink | Higher pitch, slight ring. Iron on iron. |
| **Landing (Moon)** | Soft crystalline chime | Light, ethereal. Glass on glass. |
| **Fall/death** | Impact + mutation chime | Two-part: a thud (you hit the ground) then a brief ascending chime (your fall was counted — something changed). |
| **Mutation feedback** | Subtle notification tone | When an artifact threshold is crossed or a new artifact spawns. Brief, not alarming. |
| **Checkpoint clear** | Satisfying completion tone | Resolving chord or a clean bell strike. Signals accomplishment. |
| **Cursed zone ambiance** | Subtle low texture | Optional. A quiet hum or crackle that plays while in a cursed zone. Not oppressive — just atmospheric. |
| **UI button press** | Soft click | For control bar buttons. Barely audible. Confirms the press registered. |

### Audio Implementation

**Procedural audio is strongly preferred** for v1. Reasons:

- No asset files to load, bundle, or manage in the webview.
- Tiny footprint — oscillator tones and noise bursts are generated at runtime.
- Easy to parameterize — the jump charge tone is just a frequency sweep, landing sounds are filtered noise bursts with different center frequencies per zone theme.

Use the **Web Audio API** directly or through Phaser's audio system, whichever integrates more cleanly. If Phaser's audio has iframe-specific issues (and it might), fall back to raw Web Audio API — it's well-supported and gives full control.

If procedural audio proves too limited for some sounds (the checkpoint clear tone, for instance, might want a richer timbre), use **tiny audio samples** (< 50KB total across all sounds). These load in the webview alongside the game. Prefer formats with broad support: MP3 or OGG.

A reasonable approach:

```
SoundManager
├── audioContext: AudioContext (created on first user interaction)
├── muted: boolean (from localStorage)
├── play(soundId: string, params?: object): void
├── sounds: Map<string, SoundGenerator>
│   ├── jumpCharge: OscillatorSweep(startHz, endHz, duration)
│   ├── jumpLaunch: NoiseImpact(attack, decay, filterFreq)
│   ├── landRuins: FilteredNoise(lowFreq, shortDecay)
│   ├── landBell: OscillatorPing(highFreq, mediumDecay, slight ring)
│   ├── landMoon: OscillatorChime(veryHighFreq, longDecay, shimmer)
│   ├── fall: CompositeSound(impact + delayedChime)
│   ├── mutation: OscillatorPing(midFreq, shortDecay)
│   ├── checkpoint: ChordTone(resolve frequencies)
│   └── uiClick: NoiseClick(veryShort, filtered)
└── unlock(): void  // called on first touch/click
```

### Mute Toggle

- A mute button lives in the header area or as a small icon in the game UI.
- Mute state persists in `localStorage` under a key like `fallstack:muted`.
- When muted, no sounds play. The AudioContext can be suspended to save resources.
- Default state: **unmuted** but sounds are quiet enough that they're not intrusive. If Reddit's iframe policies require it, default to muted instead.
- The mute toggle should be accessible without pausing gameplay — a single tap to toggle.

### Audio Context Lifecycle

- Create the `AudioContext` lazily on the first user interaction (touchstart or click on any game element).
- If the context is in a `suspended` state (common on mobile), call `audioContext.resume()` on interaction.
- When the game is not visible (tab switched, scrolled out of view), consider suspending the context to save battery.
- On unmute after being muted, resume the context.

### Volume Levels

All sounds should be **quiet and tactile**. They confirm actions — they don't demand attention. A player in a quiet room should hear them comfortably. A player in a noisy environment won't miss gameplay information if they can't hear them.

No background music loop for v1. The game's audio identity is built from its interaction sounds, not from a soundtrack.

---

## Key Technical Considerations

- **Browser autoplay policy**: audio will not play until a user gesture (click/touch) has occurred in the document. The first touch on any control button is the natural place to initialize/resume the AudioContext. This should be invisible to the player.
- **Iframe audio**: the Devvit webview runs in an iframe. Web Audio API works in iframes, but verify that the `AudioContext` constructor isn't blocked by any iframe sandbox attributes. If it is, the game silently degrades to no audio.
- **Phaser integration**: if using Phaser's audio system, it manages its own AudioContext. Don't create a second one — either use Phaser's or bypass it entirely. Two AudioContexts waste resources.
- **Sound aesthetic consistency**: every sound should feel like it belongs in the same world as the washi paper backgrounds and indigo ink. Test sounds against the visual style. If a sound feels like it came from a different game, it's wrong.
- **Charge sound sync**: the jump charge sound must start on press and stop on release. If the player releases mid-charge, the sound cuts cleanly — no lingering tail. This requires either stopping an oscillator node or using a gain envelope that the release event triggers.
- **Surface-dependent landing**: the game knows which zone the player is in. Pass the zone theme to the sound system so it plays the correct landing sound. This is a simple parameter, not a complex system.

---

## How to Know It's Working

- Pressing and holding jump produces an audible rising tone that tracks the charge meter.
- Releasing jump plays a crisp launch pop. The charge sound stops immediately.
- Landing on a Ruins ledge sounds different from landing on a Bell ledge, which sounds different from landing on a Moon ledge. Each has character.
- Falling produces a two-part sound: impact, then a brief mutation chime — you know your fall counted.
- Crossing an artifact threshold plays a subtle notification. Not alarming, just acknowledging.
- Clearing a checkpoint plays a satisfying tone that feels like completion.
- The mute button toggles all sound. Refreshing the page remembers the mute state.
- Sounds are quiet and organic. They feel like stone, paper, and iron — not like a retro arcade.
- Playing without sound (muted) doesn't feel like you're missing critical information — sound enhances, doesn't carry.
