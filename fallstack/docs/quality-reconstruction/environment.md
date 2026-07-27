# Workstation feedback-loop evidence

## Workstation

| Item | Result |
| --- | --- |
| OS | macOS 15.7.3 (`24G419`) |
| Architecture | arm64 |
| Memory | 8 GiB |
| Workspace free disk | 21 GiB at probe time |
| Node | 22.21.0 |
| npm | 10.9.4 |
| Playwright | 1.61.1 |
| Devvit CLI | 0.13.7 |
| Python | 3.12 installation available |
| FFmpeg / FFprobe | `/opt/homebrew/bin/ffmpeg`, `/opt/homebrew/bin/ffprobe` |
| Installed browsers | Playwright Chromium and WebKit launch successfully |
| Dependency footprint | `node_modules` 493 MiB; Playwright browsers 1.3 GiB; `dist` 23 MiB |

## Audio

Detected outputs:

- External Headphones: stereo, 48 kHz, default output.
- MacBook Air Speakers: stereo, 44.1 kHz.
- Multi-Output Device: stereo, 48 kHz, default system output.

Detected AVFoundation capture inputs are only the MacBook Air and iPhone
microphones. FFmpeg does not expose the system mix as an audio input. Recording
the room/microphone would add hardware and ambient noise and would not be a
deterministic representation of the game's final master bus.

Gate 0 action completed:

- A QA-only `MediaStreamAudioDestinationNode` fans out from the game's final
  compressed/analyser output when the page has `?qa=audio`.
- Normal `AudioContext.destination` playback remains connected.
- `npm run qa:audio` records the master, verifies non-silent peak/RMS, probes the
  artifact with FFprobe, and saves structured event timestamps beside it.
- The baseline artifact is 5.82 seconds of stereo Opus at 48 kHz.
- FFmpeg measured `-29.1 LUFS` integrated, `0.9 LU` range, and `-14.3 dBFS`
  true peak.

## Browser and host

- Headless Chromium runtime passed touch movement, repeated movement,
  touch-driven fall, grounded respawn, post-respawn input, release-to-leap, and
  reduced-motion checks.
- Headless WebKit passed the same lifecycle when run alone.
- One WebKit run timed out while Chromium, WebKit, and the shared-session browser
  competed concurrently. Current hypothesis: resource scheduling made the
  engine-specific long touch sequence exceed its 30-second wait. Repeated
  isolated runs are required before changing code or timeout values.
- Signed-in Safari opened
  `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`.
- Today's inline post loaded and expanded into the current game.
- The expanded accessibility tree exposed Fallstack, the community fall tally,
  Guide, Memory, the current Lower Ruins mechanic, charge progress, and all three
  touch controls.
- Guide exposed independent `Music On` and `SFX On` states. Music toggled Off
  and back On, returning to the starting preference.
- No browser credentials, tokens, profile contents, or signed request values
  were copied into repository evidence.

## Local verification

The clean install and current project checks pass. The known build chunk warning
remains. `npm ci` also reports 42 transitive audit findings; dependency/security
triage is a separate evidence task and no automatic force-upgrade is authorized.
