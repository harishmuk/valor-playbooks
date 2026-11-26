# Outbound email

A horizontal playbook for outbound email that any business can run on VALOR: find the right people, write to each one
on a researched hook, get the owner's approval, send on a paced schedule, prove every send, stop the moment someone
replies, bounces or opts out, answer replies, and book meetings.

Nothing here is specific to an industry. A vertical (distribution, staffing, SaaS, ...) is a layer that `extends` this
playbook, and the customer's workspace is the last layer on top.

## Plays

| Play | What it does | Started by |
|---|---|---|
| `ready-sender` | Proposes a separate sending domain and its costs (owner approves the spend), authenticates it, waits out warmup, then proves inbox placement from seed inboxes | the owner, once per sending domain |
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

- **Sends are read back, not reported.** `proof-of-send` reads the mailbox source and passes only if exactly one
  message to the recipient has the approved body's hash, and the agent's reported message id is that message. A second
  copy, a changed text or a send before the go-ahead fails the task.
- **Follow-ups are the approved text, word for word.** `matches-sequence` compares each send with the sequence the
  owner approved at email 1. That is what makes the standing approvals for follow-ups safe.
- **Bookings are read from the calendar**, DNS from public DNS, placement from the seed inboxes.
- **Claims are code-checked.** Every figure in an email must appear in the campaign's allowed claims or its ask.

## What a workspace supplies

The playbook declares what it needs; the workspace binds it. `examples/workspace` is a complete, runnable example
with invented data.

**Agents** (they own their tools; the playbook only says what they must be able to act as):

| `acts_as` | Needed for |
|---|---|
| `outbound-mailbox` | every send (`send-email` tasks), the seed test |
| `domain-registrar` | buying and authenticating the sending domain |
| `calendar` | booking meetings |

Task types used: `research`, `writing`, `send-email`, `reply-triage`, `sender-setup`, `scheduling`. Give at least two
agents `research` and two `writing`, so peer review has a reviewer who is not the author.

**Sources** (read-only, named queries; any connector that returns these rows works):

| Source | Queries | Rows |
|---|---|---|
| `campaigns` | `get(id)` | the campaign settings below |
| `prospects` | `search(saved_search)` | `email, name, title, company, tz` |
| `contacts` | `known(email)` | existing relationships, to exclude |
| `verifier` | `verify(email)` | `status`: `valid`, `catch_all`, `risky`, `invalid` |
| `mailbox` | `sent(to)`, `replies(from)` | `message_id, to, subject, body_sha256, sent_at` |
| `dns` | `auth(domain)` | `spf, dkim, dmarc, mx` |
| `seeds` | `placement(subject)` | `seed, folder` (`inbox` or `spam`) |
| `calendar` | `event(id)`, `attended(attendee)` | `id, start, attendees, status` |

`body_sha256` is the SHA-256 of the body with LF line ends, trailing spaces removed and trimmed (`lib/email.mjs`
`bodyHash`). The mailbox connector computes it; the agent never supplies it.

**Listeners** on the mailbox source, all code only (copy them from `examples/workspace/listeners`):
`mailbox-optout` (opt-out wording → `suppression`), `mailbox-replied` (→ `replied`), `mailbox-bounced` (→ `bounced`),
`mailbox-sent` (→ `sent`, the bounce-rate denominator) and `mailbox-reply` (starts `handle-reply` at low trust).
The mailbox adapter sets `kind` on each event: `reply`, `bounce`, `sent` or `auto_reply`.

**Grants**: work started by a reply runs at low trust, so grant `initiator:trust:low` query access to `campaigns` and
`contacts#known`, and nothing else.

**Campaign settings** (one record in `campaigns`; every check and guard reads this one copy):

```yaml
id: spring-agencies
name: Spring outreach to agency founders
sender:   { name, company, mailbox, primary_domain, postal_address, warmup_days, setup_budget_usd, seed_inboxes, min_inbox_share }
offer:    { ask, claims: [ ... ], pain_points: [ ... ] }
rules:    { touches, first_max_words, followup_max_words, reply_max_words, max_questions, links_in_first, banned_phrases, opt_out_line, opt_out_pattern? }
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
