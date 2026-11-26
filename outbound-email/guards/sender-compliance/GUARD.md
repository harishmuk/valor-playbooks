---
id: sender-compliance
description: Every commercial email carries the sender's postal address and a working opt-out line, and a first email never fakes a reply or forward.
applies_to: { plays: [prospect-sequence] }
on_trip: block
approved_by: owner
---
These are the parts of CAN-SPAM that can be checked in code on the text itself: a valid physical postal address, a clear
way to opt out, and no deceptive subject line. Honest From headers are the sending agent's job with its own mailbox, and
honouring opt-outs is the `suppression` guard. Other jurisdictions (for example GDPR or CASL consent rules) are layers:
a layer adds its own guard rather than changing this one. This is a summary, not legal advice.
