# First-Viewport Comprehension Test

This is the human release gate for M4. Screenshots, automated assertions, and familiarity with the project cannot pass it.

## Acceptance statement

Five first-time participants, without hearing the Fallstack pitch, can each explain:

1. **shared scope:** people in this Reddit community are changing the same daily tower;
2. **earlier cause:** earlier climbers' aggregate falls created or changed the visible object at a named site;
3. **personal next consequence:** their fall changed that site, or was capped/unavailable, and they can say what the next threshold will do.

All five participants must pass all three points. A majority is insufficient.

## Setup

- Use the current installed playtest: `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`.
- Record the installed app version and exact product-code commit before starting. Do not reuse a historical candidate identifier.
- Use at least three phone-sized sessions; the remaining sessions may use desktop.
- Use participants who have not read the product pitch, plans, Figma file, or prior test notes.
- Do not name participants or record Reddit usernames in this document.
- Start from the opening viewport. Do not point at labels, explain artifacts, or define “community.”

## Script

Say only:

> Open this post. Look at it for ten seconds, then tell me what you think is happening.

After ten seconds, ask these neutral prompts in order:

1. “Who, if anyone, is sharing or changing this tower?”
2. “Why is that object near the first jump there?”
3. “What do you expect your next fall to change?”

Then let the participant play without coaching until the first fall receipt appears. Ask:

4. “What changed, and what happens next at that place?”

Do not correct an answer during the session. Stop after the participant answers the fourth prompt.

## Scoring rubric

| Point | Pass | Fail examples |
| --- | --- | --- |
| Shared scope | Names the subreddit/community or other players in this community, one shared tower, and today/daily scope | “It is my level,” “random online players” without shared-board understanding, or cross-Reddit/global claim |
| Earlier cause | Connects earlier players' falls to the visible named-site foothold/artifact | Calls it ordinary level geometry, a collectible, decoration, or manually placed item |
| Personal next consequence | Uses the receipt to identify counted/capped/unavailable state, the same site, and the stated next threshold effect | Says only “my score went up,” expects an immediate arbitrary object, or believes a failed write changed shared state |

Count paraphrases as correct; do not require product vocabulary. Record the participant's words before assigning pass/fail.

## Result record

Use the blank [`../submission-closeout/comprehension-evidence.md`](../submission-closeout/comprehension-evidence.md) sheet. Do not prefill answers from automated runs, project contributors, or agent interpretation.

| Participant | Device / viewport | Verbatim first description | Scope | Earlier cause | Personal next consequence | Pass |
| --- | --- | --- | --- | --- | --- | --- |
| P1 |  |  |  |  |  |  |
| P2 |  |  |  |  |  |  |
| P3 |  |  |  |  |  |  |
| P4 |  |  |  |  |  |  |
| P5 |  |  |  |  |  |  |

Record alongside the table:

- app/playtest version;
- UTC test date;
- opening and first-receipt captures for the tested build;
- any moderator deviation from the script;
- exact confusing phrase or hidden visual when a point fails.

## Failure loop

If any participant fails any point:

1. Mark M4 still open; do not reinterpret the response as a pass.
2. Classify the failure as scope, spatial cause, receipt consequence, visibility, or vocabulary.
3. Change the smallest relevant Figma/runtime element.
4. Re-run browser checks at 375×812 and 1280×800.
5. Repeat this test with five fresh first-time participants.
