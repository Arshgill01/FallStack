# AGENTS.md

Engineering guidance for Fallstack agents.

## Read First

Before non-trivial planning or editing, read:

1. `PRODUCT.md` for the product thesis, audience, brand, and anti-references.
2. `fallstack_concept_log.md`, using the "Settled Grill Decisions" section as canonical design history.
3. `fallstack/AGENTS.md` for current Devvit Web, server, and client API rules.
4. Relevant source, tests, package manifests, and config before making changes.

The old standalone mockups are reference material only:

- `fallstack-mockup(3).html` contains useful analog-charge physics, zones, mutation logic, and visual exploration.
- `fallstack-mockup(4).html` contains superseded tier-jump logic, but some UI feedback ideas remain useful.

If a subdirectory has its own `AGENTS.md`, follow the more local file for work inside that directory.

## Product Invariants

Fallstack is a shared community mutation game expressed through a compact precision climber. It must not collapse into a generic hard platformer.

Every feature should strengthen at least one of:

- visible shared mutation
- physical climb feel
- daily return anticipation
- Reddit-native community discussion
- mobile-first polish
- actionable Devvit platform evidence

The tower is the hero. Keep overlays sparse, compact, and readable.

## First Viewport

The first playable viewport must prove the hook without a tutorial wall:

- Show that today's tower already contains community failure.
- Place readable artifacts near the starting climb.
- Explain at least one artifact in place, for example: "14 falls made this foothold."
- Put the player near a jump where an artifact visibly matters.
- After the first fall or clean clear, show concrete feedback about what changed.
- Keep controls copy compact: "Arrows move · Hold Space · Release to leap."

If a new player can describe the first 10 seconds only as a platformer, the implementation is missing the product.

## Gameplay Rules

Desktop controls:

- Left/Right Arrow keys move or face.
- Hold Space to charge.
- Release Space to jump.
- Arrows nudge the arc mid-flight without becoming full air control.

Mobile controls:

- Fixed Left, Jump, Right buttons.
- Hold Jump to charge and release to leap.
- Controls must be thumb-sized and must not hide critical jumps.

Movement:

- Use the analog charge model from the current implementation and mockup reference.
- Keep one global movement model across all themes.
- Tune against playability, not only numerical reachability.

Fall and checkpoint behavior:

- A run ends when the player falls below the current zone recovery line.
- Minor bonks do not end the run.
- A fall records one mutation event and respawns at the latest checkpoint.
- Reaching a zone boundary records a clean clear and advances the respawn point.

Mutation behavior:

- Store aggregate counters, not individual fall objects.
- Derive visible artifacts and zone status from counters.
- Cap visible artifacts per zone so the tower stays readable.
- Failure should help, but repeated failure should distort.
- Positive achievements may name users; failures should stay aggregate or anonymous.

## Architecture

Maintain the three-layer split:

| Layer | Owns | Must Not Own |
| --- | --- | --- |
| Pure game logic | Tower generation, mutation thresholds, artifact derivation, scoring summaries, validation | Rendering, input, persistence |
| Phaser client | Movement, collision, camera, rendering, local event emission | Redis, Reddit API, persistent authority |
| Devvit Web shell/server | `/api` calls, persistence, contribution caps, authenticated context, post lifecycle | Physics, collision, tower rendering |

Pure game logic must remain testable without launching Phaser or Devvit.

Phaser emits structured events such as falls, clears, and summits. The shell/server validates and persists those events.

## Devvit Rules

- Use Devvit Web entrypoints from `devvit.json`.
- Keep the inline entrypoint lightweight; load Phaser only in the expanded game entrypoint.
- Client code calls server endpoints under `/api`.
- Server code constructs Redis keys from validated date/seed, zone IDs, and authenticated context.
- Never trust client-supplied usernames, user IDs, Redis keys, or display text.
- Batch persistence by attempt or event, not per frame.
- Do not use Blocks APIs, `@devvit/public-api` post UI, `Devvit.addCustomPostType()`, `devvit.yaml`, legacy `useWebView`, or postMessage state bridges.

When Devvit behavior fails or surprises you, document the real failure only when there is evidence: command, environment, expected result, actual result, reproduction steps, severity, and workaround if known. Prefer precise entries in `fallstack/docs/devvit-feedback-log.md` over redundant process logs.

## Engineering Workflow

- Read relevant code and tests before editing.
- Prefer existing utilities, conventions, and source structure.
- Keep changes focused on the requested problem or discovered root cause.
- Remove dead code only after verifying it is obsolete.
- Do not introduce paid services, heavy dependencies, infrastructure changes, production configuration changes, or authentication changes without explicit approval.
- Commit after major verified checkpoints with intentional messages.
- Do not create one massive commit for unrelated work.
- Preserve user changes in the worktree. Never revert unrelated changes.

Verification is part of completion:

- Start with targeted project-native checks.
- Expand to broader checks when the change affects shared behavior, gameplay, persistence, or user-facing workflows.
- Do not claim validation passed unless the command actually succeeded.
- If tooling is missing, reasonably try to install or activate the documented toolchain before giving up.
- If validation remains blocked, report exact commands, exact blockers, and residual risk.

Current useful commands from `fallstack/`:

- `npm run type-check`
- `npm run lint`
- `npm test`
- `npm run build`

## UX And Visual Direction

Target: compact cursed diorama. Tactile, damaged, vertical, legible.

Use the current washi, indigo, and persimmon direction unless there is strong evidence a narrower change is objectively better. Do not replace the UI with a generic redesign.

Prioritize:

- strong silhouettes for platforms and artifacts
- shape differences, not color alone, for collision semantics
- readable mobile layout and contrast
- reduced-motion support
- concise feedback copy
- popups that do not obscure critical jumps
- audio feedback that is compact and tactile

Avoid:

- generic pixel-art fantasy
- neon-gradient template styling
- heavy card stacks
- desktop-first layouts
- Reddit/karma/Snoo theming as identity
- long tutorials
- dashboard-with-a-game-in-it layouts

## Tower Quality

Generated towers must remain finite, fair, and finishable.

- Every chunk or generated segment needs a default clear path without artifacts.
- Helpful artifacts may create alternatives but cannot be required.
- Cursed artifacts may make a route harder but cannot block the only path.
- Validate platform bounds and reachability in pure tests.
- Prefer playability evidence over broad procedural variety.

Difficulty targets:

- First fall should be likely within 10-20 seconds.
- First visible mutation feedback should happen within 30 seconds.
- First checkpoint should be reachable by an average player within 60-90 seconds.
- Later zones may demand mastery, but should not become nearly unwinnable.

## Future Engineering Phases

Only add to this section for work too large to complete cleanly in the current pass. Do not partially implement these unless the user asks.

1. Phaser scene decomposition:
   Split the monolithic game scene into focused modules for physics/input, camera/layout, tower rendering, artifact rendering, and event publishing. Preserve behavior with screenshot and gameplay smoke coverage before and after.

2. Reachability and difficulty simulator:
   Add deterministic validation that evaluates generated ledge sequences against the actual movement constants, including horizontal/vertical margins and checkpoint transitions. Use it to reject awkward or nearly unwinnable daily towers.

3. Devvit persistence hardening:
   Audit Redis writes for race behavior, idempotency, stale seeds, anonymous users, and duplicate tabs. Add server tests or a local Redis-compatible harness if Devvit tooling supports it.

4. Art direction asset pass:
   Replace or refine procedural placeholder motifs only with a coherent asset direction that improves readability and identity. Do not add mediocre decorative assets for volume.

## Definition Of Done

A task is complete only when:

- the requested work is implemented
- behavior and architecture still match the product invariants
- relevant validation has run and passed, or the exact blocker is documented
- important risks are disclosed
- no obvious required implementation step remains
