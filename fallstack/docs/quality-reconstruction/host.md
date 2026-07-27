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

