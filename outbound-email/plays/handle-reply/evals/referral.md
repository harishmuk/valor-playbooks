---
id: referral
step: triage
inputs:
  event: { message_id: eval-referral, from: "sam@example.test", subject: "Re: our note", text: "Not me, talk to Priya at priya@example.test, she runs finance." }
  steps: { load: { output: { opt_out_rule: false } } }
reference: { label: referral }
compare: [label]
source: hand_written
---
A pointer to someone else, with their email, is a referral.
