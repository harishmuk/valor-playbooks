---
id: mailbox-health
version: 1
title: Keep mailboxes healthy
description: Reads every sending mailbox's health from the workspace's warmup and deliverability provider. A mailbox at or above its threshold is cleared to send; one under it is held (no new prospects, queued sends wait) and VALOR starts its warmup. Code only; run daily as a standing goal.
scope: { sources: [senders, deliverability] }
steps:
  - id: judge
    kind: code
    run: steps/judge.mjs
---
# Keep mailboxes healthy

Sending reputation is a property of each mailbox, so it is checked per mailbox, every day, by code:

| Health | What happens |
|---|---|
| score at or above `min_health_score` (lane, default 90), spam rate at or under `max_spam_rate` (default 3%), not blocked | cleared: `build-list` may give it prospects and its approved sends go out |
| anything else | held: on the `held-senders` list, so no new prospects; its queued sends wait (guard `sender-health`); VALOR starts warmup |

Warmup is never turned off: it keeps running while a mailbox sends, which is what holds its reputation. A held
mailbox comes back on its own the first day its health is good again.

The workspace binds two things:

- a `deliverability` source with query `health(mailbox)` returning `{ mailbox, score, warmup, spam_rate, blocked,
  blocked_reason, connected }`. Reference adapter: `{ type: smartlead }` with the API key in the vault;
- a `warmup` resource with action `start_warmup` (`requires: grant`), and a grant
  `{ principal: "play:mailbox-health", resource: "resource:warmup#start_warmup", role: act }`.

Start it daily with a listener on a clock source (`connector: { type: clock }`, query `daily: { every: 1d }`), polled
every tick: see `examples/workspace/listeners/daily-mailbox-health.yaml`.
