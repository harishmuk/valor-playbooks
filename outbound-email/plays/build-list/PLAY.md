---
id: build-list
version: 1
title: Build the target list
description: Pull candidates from the prospect source, remove anyone we must not email, have an agent qualify them against the audience, verify addresses, pick the list with segment caps, get the owner's approval, then start one Prospect sequence per person.
inputs: { required: [campaign] }
scope: { sources: [campaigns, prospects, contacts, verifier] }
steps:
  - id: load
    kind: code
    run: steps/load.mjs

  - id: pull
    kind: code
    run: steps/pull.mjs

  - id: qualify
    kind: agent
    title: "Qualify {{steps.pull.output.count}} candidates for {{steps.load.output.campaign.name}}"
    task_type: research
    skills: [prospect-qualification]
    brief: |
      Qualify each candidate company in steps.pull.output.candidates against the audience:
      {{steps.load.output.campaign.audience.description}}
      Give every company a verdict from the fixed set with a one-line reason and a source URL. For each qualified company, pick
      at most {{steps.load.output.campaign.audience.per_company}} person(s) from its candidates and say why that person.
    done_when: "Every candidate company has a verdict from {qualified, not_a_fit, out_of_size, out_of_region, other}, a reason and a source; qualified companies have their chosen people, within the per-company limit."
    verify: { mode: peer }
    checks:
      - { id: qualification, kind: code, run: checks/qualification.mjs }
    output: { kind: record, type: qualification, schema: schemas/qualification.json }
    expected_duration: 90m

  - id: verify-emails
    kind: code
    run: steps/verify-emails.mjs

  - id: select
    kind: code
    run: steps/select.mjs

  - id: approve-list
    kind: approval
    ask: "Approve the list for {{steps.load.output.campaign.name}}: {{steps.select.output.summary}}"
    due: 3d

  - id: start
    kind: children
    play: prospect-sequence
    for_each: steps.select.output.prospects
    inputs: { campaign: "{{inputs.campaign}}" }
    wait: none
---
# Build the target list

The list is code, except the one judgment step. `pull` reads the prospect source's saved search named in the campaign,
`qualify` is the agent's judgment against the audience, `verify-emails` asks the verifier source about every chosen
address, and `select` ranks by the agent's fit score, caps any one segment and keeps reserves. The owner approves the list
once; then one **Prospect sequence** run starts per person, each needing approval at its first email.

Who must not be emailed is removed twice: here, before anyone spends effort on them, and again by guards at every send.
