---
id: meeting-time
step: triage
inputs:
  event: { message_id: eval-meeting-time, from: "kim@example.test", subject: "Re: our note", text: "Yes, let's do 2026-12-08T15:00:00Z." }
  steps: { load: { output: { opt_out_rule: false } } }
reference: { label: meeting_time }
compare: [label]
source: hand_written
---
A specific time they name or accept is meeting_time, with the time in ISO form.
