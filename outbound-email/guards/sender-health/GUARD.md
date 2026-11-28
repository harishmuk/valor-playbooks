---
id: sender-health
description: An approved email waits while the mailbox it goes from is held by mailbox-health (warming, under its health threshold), and goes when the mailbox is cleared.
on_trip: hold
approved_by: owner
---
Reads the `held-senders` list that `mailbox-health` keeps in the ledger. Holding is not blocking: nothing is lost,
the owner is not asked again, and the send takes the next paced slot after the mailbox is cleared.
