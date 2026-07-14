# Headed System Chrome Reddit Host Attempt

Date: 2026-07-12 UTC
Target: `https://www.reddit.com/r/fallstack_dev/?playtest=fallstack`

## Setup

- Installed `xvfb` because the workspace has no X11 or Wayland display (`XDG_SESSION_TYPE=tty`).
- Started a 1440×1000 virtual X display.
- Launched installed system Chrome 150.0.7871.100 from `/usr/bin/google-chrome` in headed mode.
- Reused `/home/arshdeepsingh/.config/google-chrome/Default` through agent-browser 0.31.1.
- Used `--no-sandbox` because this VM disables unprivileged Chrome sandbox support.

This was a headed system-Chrome run, not Chrome for Testing in headless mode.

## Observed request

- Browser user agent: ordinary `Chrome/150.0.0.0 Safari/537.36`; it did not contain `HeadlessChrome`.
- `sec-ch-ua` identified `Google Chrome` and `Chromium` 150.
- Reddit response: HTTP 403, `text/html`, 190,240 bytes, `cache-control: private, no-store`.
- Visible page: `You've been blocked by network security.`
- The page exposed `Log in` and `File a ticket`; the reused profile had no authenticated Reddit session.
- No Devvit iframe, `devvit.net`, Fallstack asset, or `/api` request occurred.

## Conclusion

Installing Chrome or switching from headless Chrome to headed system Chrome does not clear this environment's Reddit boundary. The remaining prerequisite is authenticated Reddit browser state. CLI authentication is separate and cannot be treated as a browser login.

This is not submitted as a Devvit defect. It is evidence that inline/expanded host, mobile, runtime transfer, console, and hosted Redis tests have not yet run.

## Evidence

- `screenshots/www-headed-system.png`

The full browser network dump was inspected but not committed because the block page embeds a large base64 image and the concise response metadata above is sufficient.
