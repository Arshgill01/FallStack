# Phase 30 — Final QA & Bug Fixing

> Run the final systematic pass across gameplay, mobile, persistence, accessibility, Devvit compliance, and submission assets.

---

## Context

This is the last chance to catch regressions before the July 15, 2026 6:00 PM PDT deadline. Do not add new systems here. Fix blockers and high-impact polish issues only.

---

## QA Matrix

### First 10 Seconds

- Headline visible.
- Shared artifacts visible.
- Origin label readable.
- Controls hint compact.
- First jump is available immediately.
- First fall gives concrete feedback.

### Core Gameplay

- Desktop controls work.
- Mobile controls work with multi-touch.
- Analog charge feels correct.
- Air nudging does not become flight.
- Falls respawn at the latest checkpoint.
- Summit can be reached on the known-good seed.

### Mutation

- Failure buckets classify correctly.
- Redis counters increment.
- Caps are enforced server-side.
- Artifacts derive from counters.
- Seeded state merges with real contributions.
- Stabilization clears work.

### UI and Accessibility

- Text fits on mobile.
- No HUD/control overlap.
- Reduced motion works.
- Mute toggle works.
- Focus indicators exist.
- Mutation banners use polite live regions.

### Devvit

- Upload/deploy succeeds.
- Test post loads in Reddit.
- Reload preserves state.
- No blocked-resource errors.
- No excessive network calls.

### Submission

- App listing assets prepared.
- Demo post live or human step documented.
- Demo video ready.
- Feedback log complete enough for award track.

---

## Bug Triage Rules

Fix immediately:

- game cannot load
- controls broken
- persistence broken
- first fall feedback absent
- mobile unusable
- seeded demo state missing
- summit/checkpoint impossible on known-good seed

Defer:

- extra chunk variety
- cosmetic-only improvements
- broader leaderboards
- alternate modes
- nonessential audio polish

---

## Validation Commands

Use the project-native commands once the scaffold exists, for example:

```bash
npm test
npm run typecheck
npm run lint
npm run build
devvit upload
```

Record exact commands and outcomes in the final handoff.

---

## How to Know It's Working

- The judged path works on desktop and mobile.
- The first viewport and first fall prove shared mutation.
- The tower remains finishable.
- Devvit post loads without errors.
- Submission assets are complete.
- Remaining issues are documented with severity and workaround.

