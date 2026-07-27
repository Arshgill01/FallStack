# Tower quality record

## Current evidence

The deterministic pure tests remain the authority for generation invariants:
route platforms stay within the 480 px logical world, every generated segment
has an artifact-free default path, and sampled consecutive landings remain
reachable under the global movement constants. The camera visibility
regression samples 160 seeds at 320 and 375 px and exposes at least 40 px of
each next usable landing after player-width inset.

The reproducible
[`tower-corpus.json`](evidence/tower-seed-corpus/tower-corpus.json) rolls those
contracts into one report over every 2026 daily seed:

- 365 generated towers and 56,220 consecutive route transitions;
- 13,140 derived impact sites and 365 every-hazard-active layouts;
- 153–158 route platforms per seed;
- first checkpoint at route jump 12 or 13;
- maximum centre-to-centre step of 258 px against 260 px declared horizontal
  reach, and maximum rise of 165 px against 165 px declared vertical reach;
- at least 42 px of the intended landing visible at 320 px and 69.5 px at
  375 px;
- zero bounds, reachability, hazard-route, or visibility failures.

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

This closes the generator's representative bounds/reachability gate and the
current route's binary finishability gap. The automated replay reaches its
intentional first fall at 2.2 seconds and first checkpoint at 14.9 seconds, but
that controller timing is not an average-player claim. Subjective difficulty,
the 10–20 second human first-fall target, 60–90 second average-player
checkpoint target, and landing feel remain human-play judgments rather than
facts inferred from the static corpus.
