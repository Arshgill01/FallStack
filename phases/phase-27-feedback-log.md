# Phase 27 — Devvit Platform Feedback Log

> Establish and maintain the developer platform feedback log — documenting bugs, friction, documentation gaps, and praise encountered during Devvit development. This is a parallel deliverable for the Feedback Award track.

---

## Context

The Reddit Games & Puzzles Hackathon includes a Feedback Award — a separate prize track that rewards high-quality platform feedback. This is independent of the game's quality: a mediocre game with excellent feedback can win this award, and a great game with no feedback can't.

This phase establishes the feedback log file and the process for populating it. Unlike most phases, this one doesn't produce a feature — it produces a document. And unlike most phases, it's not done when one thing is built. Entries should be added throughout the entire development process, starting from the first Devvit interaction.

The audience is the Devvit team at Reddit. Write for engineers and PMs who can act on the feedback. They don't need hand-holding, but they do need specificity.

---

## What This Phase Builds

### The Feedback Log File

Create `docs/devvit-feedback-log.md` with a structured format for entries.

#### Entry Structure

Each entry should include:

```markdown
### [Short descriptive title]

- **Date:** YYYY-MM-DD
- **Environment:** macOS [version], [browser] [version], Node [version], Devvit CLI [version]
- **Severity:** [blocker | confusing | rough-edge | docs-gap | feature-request | praise]
- **Task attempted:** What you were trying to do
- **Steps:**
  1. Exact command or UI path
  2. Step by step
  3. To reproduce
- **Expected result:** What should have happened
- **Actual result:** What actually happened
- **Workaround:** How you got past it (if applicable)
- **Evidence:** [screenshot / console log / video link]
```

#### Severity Levels

| Severity | Meaning | Example |
|---|---|---|
| Blocker | Prevents progress entirely | CLI crashes on `devvit upload`, no workaround |
| Confusing | Works but misleading or unclear | Error message says "invalid config" but the config is valid |
| Rough edge | Minor friction, easy to work around | `devvit logs` requires re-auth every session |
| Docs gap | Documentation missing or wrong | Redis API docs don't mention rate limits |
| Feature request | Something that would help but doesn't exist | "Wish I could preview webview locally without deploying" |
| Praise | Something that worked well | "Hot reload on `devvit playtest` saved hours of iteration time" |

### Intentional Test Scenarios

Don't just log problems you stumble into. Deliberately test paths that are likely to produce useful feedback:

**Happy paths:**
- Install Devvit CLI from scratch
- Create a new app project
- Create an interactive post
- Play the game in the post
- Verify state persists across page reloads
- Deploy to a real subreddit

**Common wrong paths:**
- Incorrect `devvit.json` configuration
- Missing permissions in app config
- Uploading with syntax errors in code
- Deploying without being logged in

**Edge cases:**
- Interrupted deploy (kill the process mid-upload)
- Mobile reload mid-game (does the webview recover?)
- Duplicate tabs with the same post open
- Rapid input during state transitions
- Reinstall loops (uninstall → reinstall → does state persist?)
- Very large Redis values (approaching quota limits)
- Concurrent mutations from multiple users

**Platform strengths:**
- What's surprisingly smooth or well-designed
- What saves time compared to other platforms
- What documentation is particularly clear
- What error messages are helpful

### Quality Bar for Entries

Every entry should be:

- **Actionable.** Someone at Reddit can read this and know what to do. Not "the CLI is bad" but "the CLI exits with code 1 and no error message when the network is unreachable."
- **Specific.** Exact steps, exact error, exact expectation. Include versions, OS, browser.
- **Reproducible.** Not "it felt slow" but "loading state took 4.2 seconds on Pixel 6 with 3G throttling in Chrome DevTools."
- **Fair.** Separate bugs from feature requests from suggestions. A missing feature isn't a bug. A confusing error isn't a blocker (unless it actually blocks).
- **Evidenced.** Screenshots, console logs, screen recordings when they add clarity. Not every entry needs a screenshot, but every non-trivial one benefits from one.

### Ongoing Process

This phase establishes the log. It does not fill it. Entries should be added throughout all phases:

- **Phase 01–03 (scaffold, Phaser, Redis):** First impressions of Devvit tooling, setup friction, documentation quality
- **Phase 04–08 (physics, zones, mutations):** Webview behavior, Redis patterns, state management
- **Phase 09–15 (artifacts, checkpoints, sound):** Asset loading, performance, mobile webview quirks
- **Phase 16–24 (polish, mobile, deploy):** Deployment pipeline, app listing, production behavior
- **Phase 25–30 (tuning, QA, submission):** Final edge cases, submission process

The best feedback comes from real development work, not from dedicated "feedback testing" sessions. Log issues as you encounter them.

---

## Key Technical Considerations

- **The Feedback Award is a separate prize track.** High-quality feedback can win independently of game quality. This is worth investing in even if the game is rough.

- **Start logging from the moment Devvit work begins.** First impressions are the most valuable feedback — they capture the new-developer experience that the Devvit team needs to understand. Don't wait until "things are working" to start logging.

- **Include positive feedback.** Praise entries are genuinely useful to the Devvit team. They tell the team what to keep, what to invest in, what's working. A log that's 100% complaints is less useful than one that's 70% issues and 30% praise.

- **Format for the Devvit team.** They're the audience. They're engineers. They want specifics, not narratives. An entry that takes 30 seconds to read and gives them a clear reproduction path is more valuable than a 500-word essay about your feelings.

- **Keep entries concise but complete.** The template helps. Fill it in. Don't write around it.

- **Version your environment.** Devvit CLI behavior can change between versions. Always note the CLI version, Node version, OS, and browser. This helps Reddit triage whether an issue is version-specific.

---

## How to Know It's Working

- `docs/devvit-feedback-log.md` exists and has a clear structure.
- Entries cover a range of severities — not just blockers, not just praise.
- Happy paths, edge cases, and pain points are all represented.
- Each entry has enough detail that a Reddit engineer could reproduce the issue or understand the praise without asking follow-up questions.
- Platform strengths are documented alongside issues — the log is balanced, not a complaint file.
- Entries are added incrementally throughout development, not all dumped in at the end.
- The log is polished enough to submit for the Feedback Award — it reads like a professional bug report collection, not a dev diary.
