# Phase 24 — Devvit Compliance & App Listing

> Check Devvit platform requirements, policy constraints, iframe behavior, app listing assets, and submission readiness.

---

## Context

The hackathon requires a Devvit Web game using Interactive Posts, an app listing on developer.reddit.com, and a public demo post. This phase makes the build fit the platform and prepares listing material. Some final posting may require the human account owner.

---

## What This Phase Builds

### Platform Compliance Check

Verify:

- App uses Devvit Web / Interactive Posts.
- Webview assets are bundled correctly.
- No blocked external resources.
- No NSFW, gambling, real-money mechanics, or policy-sensitive content.
- No user-generated unsafe text is displayed through the game state.
- Permissions requested are minimal.

### Iframe Behavior

Test:

- keyboard focus
- mobile touch input
- audio unlock/mute
- viewport sizing
- reload behavior
- post height constraints

Do this inside an actual Devvit preview or test subreddit post, not only standalone browser.

### App Listing Draft

Prepare:

- Title: `Fallstack` or `Fallstack: Cursed Tower`.
- Short description emphasizing shared mutation.
- Category selection appropriate for game.
- Screenshots:
  - first viewport with 37 failed climbs and artifacts
  - fall mutation feedback
  - result card or stabilized zone
- Demo post link placeholder.

### Submission Notes

Document anything the human must do:

- developer.reddit.com listing submission
- public demo post creation
- Devpost submission upload
- video upload if required

---

## Key Technical Considerations

- Do not add Reddit/Snoo/karma theming to "look Reddit-y." The Reddit-y part is community mutation.
- Keep screenshots self-explanatory.
- App listing copy should be concise and concrete.
- Maintain `docs/devvit-feedback-log.md` with platform findings.

---

## How to Know It's Working

- Devvit upload/deploy path succeeds.
- Test post runs the game in Reddit.
- Mobile and desktop both work in the real post iframe.
- Listing copy and screenshots are ready.
- Any human-only submission steps are clearly documented.

