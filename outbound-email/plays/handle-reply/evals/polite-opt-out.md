---
id: polite-opt-out
step: triage
inputs:
  event: { message_id: eval-polite-opt-out, from: "lee@example.test", subject: "Re: our note", text: "No need right now, please remove me from your list." }
  steps: { load: { output: { opt_out_rule: true } } }
reference: { label: opted_out }
compare: [label]
source: hand_written
---
When not-now and an opt-out both fit, the opt-out wins.
