# Final audio listening scorecard

Status: awaiting the selected music direction and a qualifying in-context
capture. Automated results must not fill or approve this record.

## Session record

| Field              | Value                                |
| ------------------ | ------------------------------------ |
| Commit             | Pending                              |
| Selected direction | Pending                              |
| Capture            | Pending                              |
| Capture duration   | Pending; must be at least 10 minutes |
| Browser/build      | Pending                              |
| Mac output device  | Pending                              |
| Listening level    | Pending                              |
| Reviewer/date      | Pending                              |

The qualifying capture is produced from the final master with:

```sh
npm run qa:audio-endurance -- docs/quality-reconstruction/evidence/final-audio-endurance --duration-seconds=600
```

The report must say `enduranceGateEligible: true`, include every planned
timeline action, and contain the three real keyboard launches, two production
fall detections, checkpoint and summit handlers, all three representative
visual zones, and observed Music/SFX Off/On UI states. Its LUFS, loudness range,
true peak, and spectrum are technical evidence only.

## Human review

Listen once continuously from start to finish on the current Mac output. Then
replay any doubtful transition with SFX on and off before recording the verdict.

| Criterion                                | Verdict (`Pass` / `Revise`) | Listening note with timestamp |
| ---------------------------------------- | --------------------------- | ----------------------------- |
| Tactile fit                              | Pending                     | Pending                       |
| Gameplay cue clarity                     | Pending                     | Pending                       |
| Repetition over the full session         | Pending                     | Pending                       |
| Fatigue over the full session            | Pending                     | Pending                       |
| Coziness                                 | Pending                     | Pending                       |
| Cursed-reliquary identity                | Pending                     | Pending                       |
| Lower Ruins coherence                    | Pending                     | Pending                       |
| Bell Shaft coherence                     | Pending                     | Pending                       |
| Moon Roof coherence                      | Pending                     | Pending                       |
| Zone-transition continuity               | Pending                     | Pending                       |
| Fall/checkpoint/summit coexistence       | Pending                     | Pending                       |
| Guide, Memory, mute, and resume behavior | Pending                     | Pending                       |

Approval requires a recorded verdict and concrete note for every row, no
unresolved `Revise` verdict, and a final explicit decision below.

## Decision

- Final verdict: Pending
- Approved by/date: Pending
- Required revisions: Pending
