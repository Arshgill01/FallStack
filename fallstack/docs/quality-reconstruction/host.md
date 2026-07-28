# Hosted Reddit and Safari record

## 2026-07-27 signed-in Safari baseline

URL:

`https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`

Observed:

- Safari reached the public test community through the existing signed-in
  profile.
- Today's Fallstack daily post rendered in the subreddit feed.
- The inline splash exposed the community-shaped opening and expansion action.
- Expansion opened the current game in Reddit's modal.
- The expanded app exposed the community fall tally, Guide, Memory, Lower Ruins
  mechanic state, charge meter, and Left/Jump/Right controls.
- Guide exposed Music and SFX independently as On.
- Music toggled Off and returned On; SFX remained On.
- The session was kept read-only with respect to shared gameplay state.

Boundary:

This proves the current host path, signed-in session, inline-to-expanded
transition, and control exposure. It does not yet prove the latest uninstalled
local source, current post-`da850d9` audio quality, hosted fall persistence, or
the fixes that will follow from this reconstruction.

Sensitive session/profile data was not copied into repository evidence.

## 2026-07-28 checkpoint deployment

Source checkpoint:

- Commit `fc5f822`
- Devvit version `0.0.26`
- Test community `r/fallstack_dev`

Deployment and read-back:

- The user explicitly authorized uploading and installing the current
  checkpoint to the Reddit test community.
- `npm run lint`, `npm test`, and `npm run build` passed before upload. The test
  run passed all 153 tests; the build retained the known expanded Phaser chunk
  warning.
- `npm exec -- devvit upload --version 0.0.26` completed successfully.
- `npm exec -- devvit install fallstack_dev fallstack@0.0.26` upgraded the
  community from `0.0.25` to `0.0.26`.
- `npm exec -- devvit list installs fallstack_dev` read back
  `fallstack (v0.0.26)`.

Hosted observation:

- The existing signed-in Safari profile opened the 2026-07-28 daily post.
- The inline splash rendered the current opening-scar summary and expanded
  successfully.
- The expanded WebView URL identified version `0.0.26`.
- The hosted mobile presentation rendered the Washi Pilgrim, Lower Ruins,
  Guide, Memory, community tally, charge meter, and fixed Left/Jump/Right
  controls.
- Later user review correctly established that the left visual boundary was
  still absent. The earlier observation must not be treated as proof of
  symmetric mobile rails.
- The session remained read-only with respect to gameplay: no control was
  pressed and no fall, clear, or mutation was produced.

Boundary:

This proves that the authorized checkpoint is installed and can load through
the signed-in Reddit host path. It does not prove the requested two-sided mobile
frame; hosted `0.0.26` failed that visual requirement. It is a
playtest-community install, not a public app-directory production publish. It
does not replace physical-device testing, human gameplay judgment, or the
still-open music and SFX listening decisions.

Sensitive signed-request and profile data was not copied into repository
evidence.

## 2026-07-28 mobile rail correction

Source checkpoint:

- Commit `57d6f2f`
- Devvit version `0.0.27`
- Test community `r/fallstack_dev`

Deployment and read-back:

- `npm exec -- devvit upload --version 0.0.27` completed successfully.
- `npm exec -- devvit install fallstack_dev fallstack@0.0.27` upgraded the
  community from `0.0.26` to `0.0.27`.
- `npm exec -- devvit list installs fallstack_dev` read back
  `fallstack (v0.0.27)`.

Hosted observation:

- After a full Reddit page refresh, the signed-in Safari session expanded the
  daily post into the `0.0.27` WebView.
- The exact hosted `0.0.27` WebView was then inspected at a 360×800 mobile
  viewport. Its rail layer covered the full tower frame from x=`0…360`, with
  12 px indigo borders and gold inner lines on both sides.
- The hosted screenshot visibly shows both rails for the entire playable board.
  A separate 286 px narrow-frame screenshot also keeps both rails visible.
- No gameplay control was pressed, so this observation produced no fall, clear,
  or shared mutation.

Boundary:

This closes the hosted visual check that `0.0.26` failed. It proves version
identity and two-sided mobile board framing for the deployed WebView; it does
not replace a physical-device test or a hosted gameplay/persistence run.

Sensitive signed-request and profile data was not copied into repository
evidence.
