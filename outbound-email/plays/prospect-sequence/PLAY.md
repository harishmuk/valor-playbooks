---
id: prospect-sequence
version: 1
title: Prospect sequence
description: Research one person, write a short sequence, get it approved once, send it on a paced schedule, prove every send from the sent folder, and stop as soon as they reply, bounce or opt out.
inputs: { required: [campaign, email, sender] }
scope: { sources: [campaigns, senders, contacts, mailbox] }
steps:
  - id: load
    kind: code
    run: steps/load.mjs

  - id: research
    kind: agent
    title: "Research {{inputs.name}} at {{inputs.company}}"
    when: { all: [{ field: steps.load.output.ok, op: eq, value: true }] }
    task_type: research
    skills: [prospect-research]
    brief: |
      Research {{inputs.name}} ({{inputs.title}}) at {{inputs.company}} <{{inputs.email}}> for the campaign "{{steps.load.output.campaign.name}}".
      Confirm they still fit the audience: {{steps.load.output.campaign.audience.description}}
      Find one recent, specific, verifiable hook that ties to what we offer, and pick the pain points it makes likely from the campaign's list.
      If they no longer fit, return verdict "disqualify" with the reason. Write no email.
    done_when: "Verdict qualified with one hook (fact, source URL, source date within the campaign's freshness window, quoted sentence) and one or two pain points from the allowed list; or verdict disqualify with a reason."
    checks:
      - { id: research, kind: code, run: checks/research.mjs }
    output: { kind: record, type: research, schema: schemas/research.json }
    expected_duration: 45m

  - id: write
    kind: agent
    title: "Write the sequence for {{inputs.name}}"
    when: { all: [{ field: steps.research.output.verdict, op: eq, value: qualified }] }
    task_type: writing
    skills: [cold-email-sequence]
    brief: |
      Write the email sequence to {{inputs.name}} ({{inputs.title}}, {{inputs.company}}) from {{steps.load.output.campaign.sender.name}}.
      Build it on the hook in the research record {{steps.research.output.id}}. Follow the campaign's rules exactly: word limits, banned phrases,
      the footer, and make no claim that is not in the campaign's allowed claims. One ask: {{steps.load.output.campaign.offer.ask}}
    done_when: "One email per touch in the campaign's sequence, each inside its word limit, plain text, every figure backed by an allowed claim, the footer with postal address and opt-out line, and the hook traceable to the research record. A peer agrees it was written for this person and is true to the research."
    verify: { mode: peer }
    checks:
      - { id: sequence-rules, kind: code, run: checks/sequence.mjs }
    output: { kind: record, type: sequence, schema: schemas/sequence.json }
    expected_duration: 30m

  - id: send-1
    kind: agent
    title: "Send email 1 to {{inputs.email}}"
    task_type: send-email
    skills: [send-approved-email]
    brief: |
      Prepare email 1 of sequence {{steps.write.output.id}} for {{inputs.email}} exactly as written: same subject, same body.
      Return it as your draft (to, subject, body) with the whole sequence alongside, so the approval covers the sequence.
      You send nothing: once the owner approves, VALOR sends it from {{steps.load.output.campaign.sender.mailbox}} in a paced slot.
    done_when: "The sent folder shows exactly one message to the recipient whose body matches the approved text."
    approval: { action: "send email 1 of the sequence to {{inputs.email}}", idempotency_key: "{{inputs.campaign}}:{{inputs.email}}:1", paced: true,
      act: { resource: "{{inputs.steps.load.output.campaign.sender.resource}}", action: send, params: { to: "{{draft.to}}", subject: "{{draft.subject}}", body: "{{draft.body}}" } } }
    checks:
      - { id: matches-sequence, kind: code, run: checks/matches-sequence.mjs }
      - { id: sent, kind: read_back }
      - { id: proof-of-send, kind: code, run: checks/proof-of-send.mjs, phase: act }
    output: { kind: pointer, system: mailbox, read_back: { source: mailbox, query: sent, params: { to: "{{inputs.email}}" } } }
    risk: medium

  - { id: wait-1, kind: wait, for: 3d }
  - { id: recheck-1, kind: code, run: steps/recheck.mjs }

  - id: send-2
    kind: agent
    title: "Send email 2 to {{inputs.email}}"
    when: { all: [{ field: steps.recheck-1.output.go, op: eq, value: true }, { field: steps.write.output.emails.1.body, op: exists }] }
    task_type: send-email
    skills: [send-approved-email]
    brief: |
      Prepare email 2 of the approved sequence {{steps.write.output.id}} for {{inputs.email}}, word for word (to, subject, body).
      You send nothing: VALOR sends it in the same thread from the lane's mailbox once it is approved.
    done_when: "The sent folder shows exactly one copy of email 2 to the recipient, matching the approved text."
    approval: { action: "send email 2 of the approved sequence to {{inputs.email}}", idempotency_key: "{{inputs.campaign}}:{{inputs.email}}:2", paced: true,
      act: { resource: "{{inputs.steps.load.output.campaign.sender.resource}}", action: send, params: { to: "{{draft.to}}", subject: "{{draft.subject}}", body: "{{draft.body}}", thread_id: "{{inputs.steps.send-1.output.pointer.thread_id}}" } } }
    checks:
      - { id: matches-sequence, kind: code, run: checks/matches-sequence.mjs }
      - { id: sent, kind: read_back }
      - { id: proof-of-send, kind: code, run: checks/proof-of-send.mjs, phase: act }
    output: { kind: pointer, system: mailbox, read_back: { source: mailbox, query: sent, params: { to: "{{inputs.email}}" } } }
    risk: medium

  - { id: wait-2, kind: wait, for: 4d }
  - { id: recheck-2, kind: code, run: steps/recheck.mjs }

  - id: send-3
    kind: agent
    title: "Send email 3 to {{inputs.email}}"
    when: { all: [{ field: steps.recheck-2.output.go, op: eq, value: true }, { field: steps.write.output.emails.2.body, op: exists }] }
    task_type: send-email
    skills: [send-approved-email]
    brief: |
      Prepare email 3, the last, of the approved sequence {{steps.write.output.id}} for {{inputs.email}}, word for word (to, subject, body).
      You send nothing: VALOR sends it in the same thread from the lane's mailbox once it is approved.
    done_when: "The sent folder shows exactly one copy of email 3 to the recipient, matching the approved text."
    approval: { action: "send email 3 of the approved sequence to {{inputs.email}}", idempotency_key: "{{inputs.campaign}}:{{inputs.email}}:3", paced: true,
      act: { resource: "{{inputs.steps.load.output.campaign.sender.resource}}", action: send, params: { to: "{{draft.to}}", subject: "{{draft.subject}}", body: "{{draft.body}}", thread_id: "{{inputs.steps.send-1.output.pointer.thread_id}}" } } }
    checks:
      - { id: matches-sequence, kind: code, run: checks/matches-sequence.mjs }
      - { id: sent, kind: read_back }
      - { id: proof-of-send, kind: code, run: checks/proof-of-send.mjs, phase: act }
    output: { kind: pointer, system: mailbox, read_back: { source: mailbox, query: sent, params: { to: "{{inputs.email}}" } } }
    risk: medium

standing_approvals:
  - { id: approved-sequence-2, step: send-2, description: "Send follow-up 2 when it matches, word for word, a sequence the owner already approved at email 1" }
  - { id: approved-sequence-3, step: send-3, description: "Send follow-up 3 when it matches, word for word, a sequence the owner already approved at email 1" }

pacing:
  # one cap per mailbox, shared by every goal and play sending from it; the lane's daily_cap comes in with the prospect
  key: "sender:{{inputs.sender}}"
  scope: workspace
  daily_cap: "{{inputs.sender_daily_cap}}"
  windows: [{ days: [1, 2, 3, 4, 5], from: "08:00", to: "11:00" }]
  tz: "{{inputs.tz}}"

guards: [suppression, stop-on-reply, bounce-rate, claims-only, sender-compliance]

outcome: { kind: replied, source: mailbox, query: replies, params: { from: "{{inputs.email}}" }, window: 21d, every: 1d }
---
# Prospect sequence

One run per person. The run is the unit that gets credit for a reply, a meeting or a deal.

**Draft, approve once, then go.** The owner approves email 1 with the whole sequence beside it, usually in a batch with the
rest of the day's drafts. Follow-ups go out under the play's standing approvals, which the owner grants once per campaign:

```sh
valor approve prospect-sequence:send-2 --standing --per-day 50
valor approve prospect-sequence:send-3 --standing --per-day 50
```

A standing approval here is safe because of `matches-sequence`: a follow-up passes only if it is, word for word, an email
of the sequence approved at email 1. Without the standing approvals, every follow-up comes to the inbox as its own batch.

**Proof, not claims.** A send counts only when VALOR reads the sent folder (`mailbox.sent`) and finds exactly one message
to that person whose body hash matches the approved text. A different text, a second copy or a send before the go-ahead
fails the task, and the last one is a contract breach on the agent's scorecard.

**Stopping.** Before each follow-up, `recheck` reads the ledger lists that the workspace's mailbox listeners keep
(`replied`, `bounced`, `suppression`). Any hit skips the rest of the sequence. The `stop-on-reply` and `suppression`
guards check again at the moment of the go-ahead.

Pacing: 25 first-touch and follow-up go-aheads a day per campaign, 08:00 to 11:00 on weekdays in the recipient's
time zone (`tz` input, UTC if missing). A layer or the workspace overrides `pacing` and the `wait` lengths.
