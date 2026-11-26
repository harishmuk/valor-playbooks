---
id: ready-sender
version: 1
title: Ready the sending domain
description: Set up a separate, authenticated sending domain and mailbox, warm it up, and prove inbox placement before any outreach, so the main domain's reputation is never at risk.
inputs: { required: [campaign] }
scope: { sources: [campaigns, dns, seeds] }
steps:
  - id: load
    kind: code
    run: steps/load.mjs

  - id: buy
    kind: agent
    title: "Propose and buy the sending domain for {{steps.load.output.campaign.name}}"
    task_type: sender-setup
    skills: [sending-setup]
    requires_acts_as: [domain-registrar]
    brief: |
      Propose a sending domain and mailbox for {{steps.load.output.campaign.sender.name}}, separate from the main domain
      {{steps.load.output.campaign.sender.primary_domain}}, with every cost (item, amount, period). Buy nothing yet.
      After the go-ahead, register the domain and open the mailbox with your own accounts, and report the order or receipt id.
    done_when: "A proposal on a domain other than the main one with every cost listed, then, after the go-ahead, a receipt or order id for it."
    approval: { action: "buy {{steps.load.output.campaign.sender.name}}'s sending domain and mailbox" }
    checks:
      - { id: plan, kind: code, run: checks/plan.mjs }
      - { id: receipt, kind: evidence, kinds: [order_id, receipt] }
    output: { kind: record, type: sender-plan, schema: schemas/sender-plan.json }

  - id: authenticate
    kind: agent
    title: "Authenticate {{steps.buy.output.domain}}"
    task_type: sender-setup
    skills: [sending-setup]
    requires_acts_as: [domain-registrar]
    brief: |
      Publish SPF, DKIM and DMARC (policy none with reports, to start) and MX for {{steps.buy.output.domain}}, then return
      a pointer {"id": "{{steps.buy.output.domain}}"}. VALOR checks public DNS itself.
    done_when: "Public DNS shows SPF, a resolving DKIM selector, a DMARC record and MX for the domain."
    checks:
      - { id: dns-read, kind: read_back }
      - { id: dns-auth, kind: code, run: checks/dns-auth.mjs }
    output: { kind: pointer, system: dns, read_back: { source: dns, query: auth, params: { domain: "{{inputs.steps.buy.output.domain}}" } } }

  - id: connect
    kind: approval
    ask: "Connect {{steps.buy.output.mailbox}} to VALOR as a read-only source (sent folder and inbox), and confirm the postal address in the campaign settings is the one to print in every footer."

  - { id: warmup-plan, kind: code, run: steps/warmup-plan.mjs }
  - { id: warmup, kind: wait, until: "{{steps.warmup-plan.output.until}}" }

  - id: seed-test
    kind: agent
    title: "Seed test {{steps.buy.output.mailbox}}"
    task_type: sender-setup
    skills: [sending-setup]
    requires_acts_as: [outbound-mailbox]
    brief: |
      Send one realistic sample email from {{steps.buy.output.mailbox}} to each address in the campaign's seed list, with a unique subject.
      Return a pointer {"id": "<the subject>", "subject": "<the subject>"}. VALOR reads the seed inboxes itself.
    done_when: "At least the campaign's minimum share of seed inboxes received the sample in the inbox, not spam."
    checks:
      - { id: seeds-read, kind: read_back }
      - { id: placement, kind: code, run: checks/placement.mjs }
    output: { kind: pointer, system: seeds, read_back: { source: seeds, query: placement, params: { subject: "{{pointer.subject}}" } } }
---
# Ready the sending domain

Cold email from a new domain lands in spam unless the domain is authenticated and warmed, and a bad run can damage the
domain it comes from. This play keeps outreach off the main domain and proves the new one works before anything is sent.

Spending is draft, approve, then go: the agent proposes the domain and costs, the owner approves, then the agent buys with
its own registrar account and shows a receipt. DNS and inbox placement are checked by VALOR from public DNS and the seed
inboxes, not taken from the agent. A failing check goes back to the agent as rework with the failing record named.

Warmup length is `sender.warmup_days` in the campaign (14 by default); the agent runs warmup with its own tools.
