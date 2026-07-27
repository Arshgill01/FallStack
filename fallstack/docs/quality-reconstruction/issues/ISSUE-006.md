# ISSUE-006 — legacy mute overrides an explicit SFX preference

## Classification

- Severity: Medium
- Workstream: Audio preferences
- Ownership: Client preference migration
- Baseline: `7c4e06f`
- Reproducibility: 100% with new `false` plus legacy `true`
- Current state: Fixed and browser-regressed

## Observation

Startup ORed `fallstack:gameplay-muted` with the old combined
`fallstack:muted` key. Because the legacy key remained, a user who explicitly
turned SFX on could reload into SFX Off again.

## Ranked hypotheses and probes

1. Legacy state always wins the OR expression. Exercise all key combinations.
2. The migration is not one-time. Reload twice and inspect stored keys.
3. Music state is coupled indirectly. Verify all four Music/SFX combinations.

## Regression seam

`npm run qa:audio-lifecycle` starts with explicit SFX `false` plus legacy
`true`, reloads, and checks UI state and storage.

## Fix and result

An explicit current key now wins. Persistence removes the legacy key, making
the migration one-time. The
[lifecycle report](../evidence/audio-lifecycle-fix/audio-lifecycle.json)
finishes with SFX On and no legacy key. Commit: `e7a4af2`.

## Residual risk

The contract covers browser local storage. Authenticated settings are not
persisted server-side by design.
