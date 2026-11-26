---
id: suppression
description: Never email anyone on the suppression list (opt-outs, complaints, do-not-contact). Applies to every play in every goal.
on_trip: block
approved_by: owner
---
The `suppression` list is kept in the ledger by the workspace's listeners: the opt-out listener on the sending mailbox,
and any import of the owner's do-not-contact list. Checked at the moment each go-ahead is released, whatever play or
goal it came from. Opt-outs take effect within one tick, well inside CAN-SPAM's ten business days.
