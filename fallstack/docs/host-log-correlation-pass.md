# Hosted Request / Log Correlation Pass

Date: 2026-07-12 UTC  
Devvit CLI: 0.13.7  
Installed app: `fallstack` v0.0.15 on `r/fallstack_dev`

## Question

After a real browser action or `/api` failure, what identifier can a developer use to correlate the client response with Devvit CLI/runtime logs?

## CLI surface

`devvit logs --help` exposes:

- historical window via `--since`;
- JSON line output via `--json`;
- `--log-runtime`, described as including the executing runtime;
- timestamps and verbose mode.

It exposes no request ID, trace filter, route filter, or client/server correlation option.

Immediately after authenticated hosted init, validation, and two-tab requests, this command emitted no JSON record during a ten-second observation window:

```sh
devvit logs fallstack_dev fallstack \
  --since=30m --json --show-timestamps --log-runtime
```

Human mode printed the standard streaming banner but no automatic request record. Fallstack does not currently log each successful request, so silence is not represented as missing application logs. The finding is that the platform supplies no automatic browser↔runtime join key or request envelope through this surface.

## Browser response surface

From the authenticated expanded iframe, a fresh HTTP 200 `/api/init-game` response exposed these header names:

```text
accept-ranges
content-encoding
content-length
content-security-policy
content-type
date
report-to
strict-transport-security
vary
via
x-content-type-options
x-devvit-forbidden
x-envoy-upstream-service-time
x-reddit-backend
x-reddit-ct
x-reddit-duration
x-reddit-ingress-ip
x-reddit-pod-ip
x-reddit-response-code
x-xss-protection
```

There was no header name matching request, trace, correlation, ray, server timing, or an opaque request ID. Infrastructure header values that could identify internal hosts or addresses were deliberately not recorded.

## Impact

When a route intermittently fails only in Reddit's host, a developer can add their own UUID to application logs and responses, but they cannot join that identifier to platform ingress/runtime diagnostics unless Devvit propagates it. JSON lifecycle silence also makes it unclear whether automation is connected and merely has no matching application events.

This affects precisely the failures that are hardest to reproduce locally: response loss, duplicate tabs, cold-host timing spikes, and server exceptions.

## Recommendation

Provide an opt-in request-correlation contract:

1. attach an opaque request ID to every Devvit Web `/api` response;
2. expose the same ID in server context and structured runtime/error logs;
3. allow `devvit logs --request-id <id>` or a JSONL request/error envelope;
4. include installed app version, subreddit, runtime, route, status, and duration without exposing user identity or infrastructure addresses;
5. pair it with typed `connected`, reconnect, completion, and terminal-error records for machine-readable log consumers.

Acceptance criterion: a developer can copy one opaque ID from a failed browser response and retrieve the matching server/runtime record for the exact installed version.

This is an observability gap and recommendation, not evidence that Devvit dropped or mishandled the successful requests in this pass.
