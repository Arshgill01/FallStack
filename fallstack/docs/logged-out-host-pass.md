# Logged-out Reddit Host Pass

Date: 2026-07-12 UTC  
Browser: headed Google Chrome 150, incognito window  
Target: `r/fallstack_dev/?playtest=fallstack`

## Purpose

Test the real logged-out Reddit → Devvit Web path and, if the iframe loaded, inspect Fallstack's `loid`/anonymous server context without reading, copying, or modifying the authenticated profile's credentials.

## Method

- Stop the authenticated Chrome instance.
- Launch the same installed Chrome binary with `--incognito` and the dedicated QA profile.
- Keep CDP localhost-only and navigate directly to the playtest subreddit.
- Wait eight seconds, capture the rendered boundary, and inspect whether any Devvit iframe target exists.

Incognito isolates the browsing session from the profile's authenticated cookies; no cookie or session-store API was accessed.

## Result

Reddit rendered its network-security block page:

> You've been blocked by network security.

The page instructed the visitor to log in or use a developer token. The subreddit feed and Devvit iframe never loaded, so no Fallstack endpoint or `loid` context could be exercised.

This reproduces the earlier logged-out boundary in a stronger comparison: the same VM, system Chrome installation, and persistent browser profile successfully load the real app when authenticated, while an incognito/logged-out window is blocked before application code. It remains Reddit access/anti-abuse behavior, not evidence of a Devvit iframe or Fallstack defect.

## Impact and safe interpretation

- Real anonymous/`loid` host QA is unavailable from this VM without a Reddit-supported developer-token browsing workflow or a different allowed network/device.
- CLI authentication does not create a logged-out browser session and should not be repurposed by copying reusable credentials into the page.
- Local request-context fixtures remain necessary for deterministic anonymous-route tests; this strengthens the `@devvit/test` request-context recommendation without turning the Reddit block into Devvit criticism.

## Evidence

- `docs/playtest-evidence/2026-07-12-authenticated-host/screenshots/v15-incognito-host.png`

Chrome and Xvfb were stopped after capture. No VNC, noVNC, or CDP port remained open.
