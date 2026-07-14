# Feedback Award Evidence Pass ExecPlan

## Outcome

Turn the existing Devvit feedback package into a current, generalizable, evidence-backed submission. Fallstack may provide a concrete reproduction, but each submitted finding must describe a platform-level developer problem, name its ownership boundary, disclose its evidence scope, and propose a verifiable improvement.

The canonical paste-ready answer remains [`feedback-form-submission.md`](feedback-form-submission.md). [`submission-evidence-audit.md`](submission-evidence-audit.md) is the claim gate. This plan records the new pass so current experiments are not confused with the earlier Ubuntu VM work.

## Scope rules

- Recheck time-sensitive claims against the current Devvit release, official documentation, templates, and installed CLI before strengthening them.
- Prefer experiments that close a material evidence gap or change a form answer; do not add volume for its own sake.
- Keep Devvit-owned, Reddit-host-owned, browser/OS-owned, dependency-owned, and Fallstack-owned observations separate.
- Use Fallstack only as a reproducible stateful Web app, not as the premise for every recommendation.
- Do not preserve cookies, iframe tokens, authenticated URLs, raw HARs, or internal infrastructure values.
- Do not create misleading public clears, summits, identities, or synthetic community state.
- A public support post or message requires user confirmation at the point of submission.

## Milestones

### M0 — Prior-work and claim audit

- Inventory every experiment, result, limitation, draft, and residual gap from the remote-agent pass.
- Compare the feedback package with the newer shared-board/Safari evidence on `master`.
- Classify each existing claim as current, stale, over-specific, under-supported, or ready.

Exit: the next experiments are chosen by their ability to change evidence quality, not by novelty.

### M1 — Current-contract revalidation on macOS arm64

- Record current Node, npm, Devvit CLI, installed project versions, CLI command surface, and authenticated installation read-back.
- Recheck the strongest documentation/schema/template contradictions against authoritative current sources.
- Reproduce the highest-impact clean-install and `@devvit/test` findings on macOS where safe and bounded.
- Record whether an earlier Ubuntu-only result generalizes, is Linux-specific, or has already been fixed.

Exit: no paste-ready criticism relies on a stale page or an unexplained VM-specific result.

### M2 — Real Reddit host gaps from this Mac

- Verify the installed playtest and authenticated Safari surface without extracting session data.
- Attempt the logged-out/private browsing path from this non-VM network; if Reddit blocks before the iframe, preserve only non-sensitive boundary evidence.
- Check Safari/WebKit inline-to-expanded behavior, input/focus, responsive host modes, API response correlation surface, and board revision/read-back.
- Exercise response-loss/retry only if it can use a normal game event, remain bounded, and avoid misleading achievements.

Exit: Safari and logged-out claims have direct Mac evidence or an explicit blocker; no browser result is mislabeled as a Devvit defect.

### M3 — General platform experiments

- Test only platform surfaces that are independent of Fallstack’s game design: template install/audit, test harness setup/context, config validation, log lifecycle/correlation, upload/package observability, and supported local iteration.
- For each new failure, capture command, environment, expected/actual behavior, ownership, impact, workaround, and acceptance criterion.
- Exclude one-off app bugs from the platform log.

Exit: each retained finding applies to a meaningful class of Devvit apps and has a maintainer-verifiable patch shape.

### M4 — Synthesis and consistency gate

- Update the platform log, evidence matrix, maintainer brief, submission audit, work log, and paste-ready answers only where evidence changed.
- Reduce Fallstack-centric detail in form answers while preserving one concrete proof example where it earns credibility.
- Re-evaluate ratings and priorities; do not inflate the community-support score without firsthand evidence.
- Run link/reference checks, Markdown diff checks, and relevant project-native validation for any code changes.

Exit: every form answer is concise, current, candid, actionable, and supported at the scope stated.

## Stop conditions

- Stop before posting to Reddit/Discord or submitting the feedback form until the user confirms the exact prepared message.
- Stop before bypassing Reddit access controls, inspecting credential values, or copying authenticated iframe URLs.
- Stop before adding dependencies to the Fallstack project; disposable experiments belong in temporary directories.
- Stop before deploying a new app version unless the current source/version relationship is verified and the experiment requires a remote build.
- Do not claim physical-mobile evidence from desktop responsive emulation or Safari desktop.

## Progress

- [x] M0 repository and prior-work inventory completed; earlier evidence package and newer Safari/shared-board proof classified.
- [x] M1 current macOS contract checks completed against stable 0.13.8.
- [x] M2 Mac host checks completed without upload or hosted writes; logged-out access blocker narrowed to private-subreddit topology.
- [x] M3 selected general platform experiments completed, including clean CLI/harness audits, candidate upgrades, changelog drift, and Safari bridge reproduction.
- [x] M4 submission and evidence package updated; form coverage, local references, Markdown diff, audit, type-check, lint, 110 tests, and production build validated.
