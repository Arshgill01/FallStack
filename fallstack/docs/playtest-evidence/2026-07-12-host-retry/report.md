# Reddit Host Retry Evidence

Date: 2026-07-12 UTC
Target: `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`
Browser: agent-browser 0.31.1, Chrome for Testing 150.0.7871.115

## Purpose

Retry real Reddit-host inspection using the VM's existing Google Chrome profile, then distinguish browser setup, authentication, Reddit access, and Devvit iframe behavior.

## Result

- The local profile required Chrome's documented `--no-sandbox` VM workaround before the browser could launch. This is environment-owned.
- The profile did not contain an authenticated Reddit session; the returned page exposed a `Log in` link.
- `www.reddit.com/r/fallstack_dev/?playtest=fallstack` returned HTTP 403 with a 190,240-byte HTML response.
- `old.reddit.com/r/fallstack_dev/?playtest=fallstack` independently returned HTTP 403 with the `whoa there, pardner!` page.
- Both responses arrived before any Devvit iframe or `devvit.net` request appeared. No Fallstack client console, network, inline, expanded, or `/api` behavior was observable.
- `npx devvit whoami` remained authenticated as the app owner, but current official documentation treats that token as CLI-managed authentication. The CLI has no browser-session handoff command.
- A read-only attempt to use the CLI credential against Reddit's OAuth listing endpoint returned the same 403 HTML. No write was attempted and no credential was printed or persisted in the repository.

## Ownership and submission use

This strengthens the access-boundary evidence but is **not** a Devvit defect. It remains excluded from the platform criticism. The required next step is a logged-in human Reddit browser session, or a newly documented supported browser automation flow.

## Evidence

- `screenshots/www-profile.png`
- `screenshots/old-profile.png`

The network status and response metadata were captured from the browser's request log. The raw request dump was not committed because it was dominated by embedded block-page image data and added no diagnostic value.
