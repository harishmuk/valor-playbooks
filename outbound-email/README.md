# Outbound email

A horizontal playbook for outbound email that any business can run on VALOR: find the right people, write to each one
on a researched hook, get the owner's approval, send on a paced schedule, prove every send, stop the moment someone
replies, bounces or opts out, answer replies, and book meetings.

Nothing here is specific to an industry. A vertical (distribution, staffing, SaaS, ...) is a layer that `extends` this
playbook, and the customer's workspace is the last layer on top.

## Plays

| Play | What it does | Started by |
|---|---|---|
| `ready-sender` | Proposes a separate sending domain and its costs (owner approves the spend), authenticates it, waits out warmup, then proves inbox placement from seed inboxes | the owner, once per new sending lane (skip it for mailboxes that are already warm) |
| `build-list` | Pulls candidates from the prospect source, removes anyone we must not email, has an agent qualify them, verifies addresses, picks the list with segment caps, gets the owner's approval, starts one sequence per person | the owner, once per campaign |
| `prospect-sequence` | Researches one person, writes the sequence (peer reviewed), owner approves email 1 with the whole sequence, sends in paced slots, proves each send from the sent folder, re-checks before each follow-up | `build-list`, or a referral |
| `handle-reply` | Triages a reply into a fixed label with a verbatim quote, then answers (owner approves), books, takes a referral or brings it to the owner | the reply listener, at low trust |
| `book-meeting` | Books the time the person asked for, proves it from the calendar, writes a prep brief, then asks the owner whether it happened | `handle-reply` |

## Skills

Plain `SKILL.md` folders, with no VALOR fields, so any agent that supports skills can load them:
`sending-setup`, `prospect-qualification`, `prospect-research`, `cold-email-sequence`, `send-approved-email`,
`reply-triage`, `reply-writing`, `meeting-booking`, `meeting-prep`.

## Guards

Checked by VALOR at the moment each go-ahead is released. Each one attaches itself with `applies_to`, so a layer that
overrides a play's `guards:` list cannot drop them by accident.

| Guard | Scope | Trips when |
|---|---|---|
| `suppression` | every play in every goal | the recipient is on the `suppression` list |
| `stop-on-reply` | `prospect-sequence` | the recipient has replied or bounced |
| `bounce-rate` | `prospect-sequence` | bounces pass `limits.max_bounce_rate` (3%) once 20 have been sent |
| `claims-only` | `prospect-sequence`, `handle-reply` | the text states a figure no allowed claim backs, or uses a banned phrase |
| `sender-compliance` | `prospect-sequence` | no postal address or opt-out line, or a first email with a fake "Re:"/"Fwd:" subject |

`sender-compliance` covers the parts of CAN-SPAM that can be checked on the text itself; `suppression` covers honouring
opt-outs, which happens within one tick. Consent regimes such as GDPR or CASL are a layer's guard. This is a summary,
not legal advice.

## How it proves work

- **Agents draft; VALOR sends.** Each mailbox is a company resource in VALOR's vault (`resources/`). After the owner's
  approval, VALOR sends exactly the approved draft from the lane's mailbox under the go-ahead's idempotency key, once.
  No agent holds a mailbox credential, so adding or swapping an agent needs no mailbox setup.
- **Sends are read back, not reported.** `proof-of-send` reads the mailbox source and passes only if exactly one
  message to the recipient has the approved body's hash, and it is the message VALOR sent. A copy sent around VALOR
  or a changed text fails the task.
- **Follow-ups are the approved text, word for word.** `matches-sequence` compares each send with the sequence the
  owner approved at email 1. That is what makes the standing approvals for follow-ups safe.
- **Bookings are read from the calendar**, DNS from public DNS, placement from the seed inboxes.
- **Claims are code-checked.** Every figure in an email must appear in the campaign's allowed claims or its ask.

## Two layers of settings: sending lanes and goals

The email infrastructure is set up **once per workspace** and shared; each outbound motion is a **goal** that brings
only who to reach and what to say.

| Set once, in the workspace (`senders` source) | Per goal (`campaigns` source, one record per motion) |
|---|---|
| each mailbox as a sending lane: address, sender name and company, domain, main domain to protect | who to reach: audience, saved search, list size, segments, exclusions |
| footer: postal address, opt-out line | the offer: the ask, allowed claims, pain points |
| a daily cap per mailbox, shared by every goal and play sending from it | writing rules: touches, word limits, banned phrases |
| status: `active`, `warming`, `planned`, `paused` | which lanes to use (`senders: [ids]`, default: every active lane) |
| setup: warmup days, budget, seed inboxes, minimum inbox share | research freshness, bounce limits, meeting length |

`build-list` spreads a goal's list over its lanes. Each `prospect-sequence` carries its lane (`sender`) and that lane's
cap, and pacing keys on the lane across the workspace, so two goals can never push one mailbox past its cap. A reply
joins the goal and lane of the sequence it answers (the reply listener `follows` that run), so one set of mailbox
listeners serves every goal.

## What a workspace supplies

The playbook declares what it needs; the workspace binds it. `examples/workspace` is a complete, runnable example
with invented data.

**Resources** (company access held in VALOR's vault, one file per mailbox in `resources/`). VALOR performs the
approved action with the credential; agents never see it. Every mailbox connects the same way, whoever hosts it
(Google Workspace with an app password, Namecheap Private Email, Zoho, Fastmail, any IMAP/SMTP server):

```sh
valor mailbox add alex@example.com --provider namecheap-private-email --lane alex --name "Alex Rivera"
```

asks for the password (hidden), stores it in the vault, and writes:

```yaml
id: mailbox-alex
kind: mailbox
actuator: { type: mailbox, provider: namecheap-private-email, mailbox: alex@example.com, from_name: Alex Rivera }
credentials: secret://mailbox-alex
actions:
  send: { params: [to, subject, body, thread_id, in_reply_to], requires: owner_approval }
```

Rehearsal and tests use `{ type: fixture, data: data/mailbox.json, record_as: { send: sent } }` instead. Each lane names
its mailbox's resource (`resource: mailbox-alex`). Emails to prospects and replies go through it.

**Deliverability**: `check-lanes` (and the first step of `build-list`) reads public DNS for each lane: SPF, DKIM, DMARC
and MX on the sending domain, and that no lane sends from the main domain. A lane that is not ready is left out.

**Agents** (they own their tools; the playbook only says what they must be able to act as). Sending an email needs
nothing: any `send-email` agent drafts and VALOR sends.

| `acts_as` | Needed for |
|---|---|
| `outbound-mailbox` | the seed test for a new mailbox in `ready-sender` |
| `domain-registrar` | buying and authenticating the sending domain |
| `calendar` | booking meetings |

Task types used: `research`, `writing`, `send-email`, `reply-triage`, `sender-setup`, `scheduling`. Give at least two
agents `research` and two `writing`, so peer review has a reviewer who is not the author.

**Sources** (read-only, named queries; any connector that returns these rows works):

| Source | Queries | Rows |
|---|---|---|
| `senders` | `get(id)` (no id: every lane) | the sending lanes below |
| `campaigns` | `get(id)` | each goal's campaign settings below |
| `prospects` | `search(saved_search)` | `email, name, title, company, tz` |
| `contacts` | `known(email)` | existing relationships, to exclude |
| `verifier` | `verify(email)` | `status`: `valid`, `catch_all`, `risky`, `invalid` |
| `mailbox` | `sent(to)`, `replies(from)` | `message_id, to, subject, body_sha256, sent_at` (live: connector type `mailbox`, IMAP) |
| `dns` | `auth(domain)` | `spf, dkim, dmarc, mx` (live: connector type `dns`) |
| `seeds` | `placement(subject)` | `seed, folder` (`inbox` or `spam`) |
| `calendar` | `event(id)`, `attended(attendee)` | `id, start, attendees, status` |

`body_sha256` is the SHA-256 of the body with LF line ends, trailing spaces removed and trimmed (`lib/email.mjs`
`bodyHash`). The mailbox connector computes it; the agent never supplies it.

**Listeners** on the mailbox source, all code only (copy them from `examples/workspace/listeners`):
`mailbox-optout` (opt-out wording → `suppression`), `mailbox-replied` (→ `replied`), `mailbox-bounced` (→ `bounced`),
`mailbox-sent` (→ `sent`, the bounce-rate denominator) and `mailbox-reply` (starts `handle-reply` at low trust).
The mailbox adapter sets `kind` on each event: `reply`, `bounce`, `sent` or `auto_reply`.

**Grants**: work started by a reply runs at low trust, so grant `initiator:trust:low` query access to `campaigns`,
`senders` and `contacts#known`, and nothing else.

**Sending lanes** (one row per mailbox in `senders`):

```yaml
id: alex                     # the lane id goals and sequences refer to
resource: mailbox-alex       # the vault resource VALOR sends from
name, company, mailbox, domain, primary_domain, postal_address, opt_out_line
daily_cap: 25                # per mailbox, across every goal
status: active               # active | warming | planned | paused; only active lanes send
warmup_days, setup_budget_usd, seed_inboxes, min_inbox_share   # for ready-sender
```

**Campaign settings** (one record per goal in `campaigns`; the `load` step joins it with the run's lane, so every check
and guard reads one copy, with `campaign.sender` being that lane):

```yaml
id: spring-agencies
name: Spring outreach to agency founders
senders:  [alex, sam]        # optional; default every active lane
offer:    { ask, claims: [ ... ], pain_points: [ ... ] }
rules:    { touches, first_max_words, followup_max_words, reply_max_words, max_questions, links_in_first, banned_phrases, opt_out_pattern? }
audience: { description, saved_search, per_company, list_size, reserve_share, max_segment_share, exclude_domains, keep_risky_addresses? }
research: { hook_max_age_days }
limits:   { max_bounce_rate, bounce_rate_min_sends }
meeting:  { minutes }
```

**Standing approvals** the owner may grant once per campaign:

```sh
valor approve prospect-sequence:send-2 --standing --per-day 50   # follow-ups that match the approved sequence
valor approve prospect-sequence:send-3 --standing --per-day 50
valor approve book-meeting:book --standing                        # book the exact time the person asked for
```

Answers to replies never have a standing approval.

## Layering

A vertical or a customer changes behaviour by overriding, never by forking:

```yaml
# layers/distribution/playbook.yaml
name: distribution
extends: ../outbound-email
```

```markdown
<!-- layers/distribution/plays/prospect-sequence/PLAY.md -->
---
id: prospect-sequence
override: true
version: 2
title: Prospect sequence
pacing: { daily_cap: 15 }
---
```

A layer can also replace one file (a check, a code step, a skill) by putting a file at the same path; scripts resolve
nearest layer first. Domain knowledge (who counts as a target, which hooks matter, which claims are allowed) belongs in
the layer's skills and the campaign settings, not in these plays.

## Evals

`plays/handle-reply/evals` (triage: interested, polite opt-out, prompt injection, meeting time, referral) and
`plays/prospect-sequence/evals` (sequence writing on two kinds of hook). Run them against any agent before routing work
to it: `valor eval handle-reply --agent <id>`. Eval tasks are prepare-only and can never send.

## Tests

`test/` runs every play end to end on the VALOR core with fixture agents and a fake sent folder, seed inboxes and
calendar. Nothing is sent. See the repository README for how to run them.
