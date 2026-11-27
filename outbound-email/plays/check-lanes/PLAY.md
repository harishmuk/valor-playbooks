---
id: check-lanes
version: 1
title: Check the sending lanes
description: Reads public DNS for every sending lane a campaign may use (SPF, DKIM, DMARC, MX, and that no lane sends from the main domain) and reports which are ready. Code only; run it after connecting mailboxes or changing DNS.
inputs: { required: [campaign] }
scope: { sources: [campaigns, senders, dns] }
steps:
  - id: load
    kind: code
    run: steps/load.mjs
  - id: lanes
    kind: code
    run: steps/lanes.mjs
---
Run before a campaign starts, and whenever a mailbox or DNS changes. `build-list` runs the same check first and leaves
out any lane that is not ready.
