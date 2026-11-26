---
id: interested
step: triage
inputs:
  event: { message_id: eval-interested, from: "dana@example.test", subject: "Re: our note", text: "Sounds good, tell me more about how this works." }
  steps: { load: { output: { opt_out_rule: false } } }
reference: { label: interested }
compare: [label]
source: hand_written
---
A plain yes is interested, not a meeting time.
