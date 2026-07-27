# Tower quality record

## Current evidence

The deterministic pure tests remain the authority for generation invariants:
route platforms stay within the 480 px logical world, every generated segment
has an artifact-free default path, and sampled consecutive landings remain
reachable under the global movement constants. The camera visibility
regression samples 160 seeds at 320 and 375 px and exposes at least 40 px of
each next usable landing after player-width inset.

The production-browser replay is a complementary integration signal. It uses
the real Phaser movement, collisions, checkpoints, camera, and generated daily
route rather than replacing them with teleports.

## Complete route proof

The 2026-07-27 local-practice replay at 375×812 completed:

- 155 non-obstacle route platforms;
- 11 clean zone clears;
- 158 controlled jumps in 170 seconds;
- an intentional opening fall and mutation cycle;
- five recovered non-advancing fall outcomes;
- the Event Horizon connector and one emitted summit event;
- final `lastPlatformId: "summit"` and `summitSent: true`.

The run captured the opening, every zone transition, and Tower Memory at the
summit. It produced no page exception. The expected static-server `/api` 404
kept the session in local practice, so this result does not claim shared Redis
or authenticated Reddit authority.

Evidence:

- [Replay report](evidence/full-playthrough-fixed/playthrough.json)
- [Opening viewport](evidence/full-playthrough-fixed/screenshots/00-opening.png)
- [Summit result](evidence/full-playthrough-fixed/screenshots/99-summit.png)

## Interpretation

The earlier replay stalls were caused by the QA controller: stale support
labels, speculative reverse wall bounces, and air correction aimed at the
ascending rather than descending platform-height intersection. The tower and
movement model were not changed to make the proof pass.

This closes the current binary finishability gap for the captured route. It
does not approve difficulty pacing, first-fall timing, average-player
checkpoint timing, every date/seed, or subjective landing feel. Those need a
larger deterministic corpus and human play evidence.
