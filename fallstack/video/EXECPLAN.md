# Fallstack pitch video ExecPlan

## Outcome

Render a polished 58-second, 1920×1080 pitch video from the actual Fallstack game board. The edit must make the shared mutation hook undeniable, show the three shipped visual themes and daily generated route, use smooth camera punches and match cuts, keep the app shell off-screen, and include readable gold subtitles plus an original rights-clear score.

## Non-negotiables

- Footage comes from the production build and real Phaser movement/collision.
- Only the tower board, in-world visuals, and trailer subtitles appear; no app dashboard, phone frame, talking head, or fake gameplay.
- Claims remain inside the shipped product contract: one community-wide daily board per subreddit installation, aggregate failure artifacts, clean-clear stabilization, a finite generated daily tower, three themes, and Tower Memory.
- The Cutaway Reliquary palette, materials, fonts, and collision silhouettes remain unchanged.
- Music must feel mature, cinematic, cool, and restrained. Any external cue needs explicit reusable licensing and recorded provenance.

## Milestones

### M0 — Capture contract

- Build the production client.
- Record a 1280×720 board-only full playthrough with one intentional opening fall.
- Archive the source video, event timeline, and board-only opening/summit stills under `video/public/generated/`.

Exit: the source contains a real fall, respawn, three visual themes, checkpoints, and summit, with no shell UI visible in selected shots.

### M1 — Edit and score

- Select truthful shots from the event timeline.
- Implement the 58-second Remotion composition at 30 fps.
- Add restrained camera zooms/pans, short cut accents, gold subtitles, and a final title lockup.
- Generate and normalize the original score, synchronizing section changes to the edit.

Exit: the composition previews without missing media and every subtitle claim is supported by the product.

### M2 — Render and verify

- Render H.264/AAC MP4 at 1920×1080.
- Verify exact duration, stream codecs, dimensions, frame rate, audio presence, and absence of black frames.
- Inspect representative frames from each section and create a contact sheet.
- Run the relevant app checks after changing the shared capture harness.

Exit: the final MP4 is reviewable, under one minute, and accompanied by reproducible capture/render commands.

## Progress

- [x] Repository/product/art-direction context read.
- [x] Pitch claim set and 58-second structure selected.
- [x] M0 source capture complete: production build, intentional real fall, 153-jump summit playthrough, and board-only stills captured.
- [x] M1 edit and score complete: nine pitch beats, smooth board camera treatment, three themes, and normalized original score.
- [x] M2 final render and verification complete: 58.048-second 1920×1080 H.264/AAC master, zero detected black runs, and contact-sheet review passed.

## Revision 1 — Music and pacing

User review found the generated bell-led score juvenile and the one-clip-per-beat edit visually repetitive.

- [x] Replace the score with a licensed artist-made ambient-electronica cue; trim, fade, and loudness-normalize it for the edit.
- [x] Recut the first 54 seconds into 17 shorter actual-game clips, with two clips per concept beat and three distinct visual-theme clips in the daily-variety beat.
- [x] Replace the repeated gold flash with varied cut, whip, lift, and punch entrances.
- [x] Rerender and repeat media, contact-sheet, and repository validation.
