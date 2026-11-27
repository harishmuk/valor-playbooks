---
id: ready-sender
version: 1
title: Set up a new sending mailbox
description: Buy and authenticate a separate sending domain and mailbox (owner approves the spend), then connect it to VALOR and the warmup provider. From there mailbox-health holds it until it is warm, so the main domain's reputation is never at risk.
inputs: { required: [sender] }
scope: { sources: [campaigns, senders, dns] }
steps:
  - id: load
    kind: code
    run: steps/load.mjs

  - id: buy
    kind: agent
    title: "Propose and buy the sending domain for {{steps.load.output.campaign.sender.name}}"
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
    ask: "Connect {{steps.buy.output.mailbox}}: run `valor mailbox add {{steps.buy.output.mailbox}} --provider <provider> --lane {{inputs.sender}}`, add it to the warmup provider, confirm the lane's postal address, and set the lane active. mailbox-health holds it until it is warm."
---
# Set up a new sending mailbox

Cold email from a new domain lands in spam unless the domain is authenticated and warmed, and a bad run can damage the
domain it comes from. This play keeps outreach off the main domain and proves the new one works before anything is sent.

Spending is draft, approve, then go: the agent proposes the domain and costs, the owner approves, then the agent buys with
its own registrar account and shows a receipt. DNS is checked by VALOR from public DNS, not taken from the agent.

Warmup is not a wait inside this play: the warmup provider warms the mailbox, and `mailbox-health` keeps the lane held
until its health score clears the threshold, then releases it. A mailbox that is already warm skips this play: connect
it with `valor mailbox add` and `mailbox-health` clears it on its next run.
