---
id: stop-on-reply
description: No sequence email goes to someone who has replied or whose address bounced.
applies_to: { plays: [prospect-sequence] }
on_trip: block
approved_by: owner
---
The sequence re-checks before each follow-up; this guard catches a reply that lands between the draft and the send slot.
Replies themselves are answered by the handle-reply play, which this guard does not cover.
