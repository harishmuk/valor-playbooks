---
id: bounce-rate
description: Stop sequence sends when bounces pass the campaign's limit (default 3% once 20 emails have gone out), to protect the sending domain.
applies_to: { plays: [prospect-sequence] }
on_trip: pause_play
approved_by: owner
---
Reads two ledger lists kept by the mailbox listeners: `sent` (every recipient the sent folder shows) and `bounced`
(every address a bounce notice names). The limit is `limits.max_bounce_rate` in the campaign settings.
