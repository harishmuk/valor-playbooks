---
id: book-meeting
version: 1
title: Book the meeting
description: Book a time the person asked for, prove the invite from the calendar, prepare the owner, and confirm the meeting happened.
inputs: { required: [campaign, email, meeting_time] }
scope: { sources: [campaigns, senders, calendar] }
steps:
  - id: load
    kind: code
    run: steps/load.mjs

  - id: book
    kind: agent
    title: "Book {{inputs.meeting_time}} with {{inputs.email}}"
    task_type: scheduling
    skills: [meeting-booking]
    requires_acts_as: [calendar]
    brief: |
      {{inputs.email}} asked to meet at {{inputs.meeting_time}}. Prepare the invite from {{steps.load.output.campaign.sender.name}}'s calendar:
      that time, {{steps.load.output.campaign.meeting.minutes}} minutes, with a video link, and a one-line confirmation for the thread.
      Book nothing yet. After the go-ahead, create the event with the go-ahead's idempotency key in its description and report the event id.
    done_when: "The calendar shows one event at the agreed time with the person among the attendees, and no clash."
    approval: { action: "book {{inputs.meeting_time}} with {{inputs.email}}", idempotency_key: "{{inputs.campaign}}:{{inputs.email}}:meeting:{{inputs.meeting_time}}" }
    checks:
      - { id: event, kind: read_back }
      - { id: booking, kind: code, run: checks/booking.mjs, phase: act }
    output: { kind: pointer, system: calendar, read_back: { source: calendar, query: event, params: { id: "{{pointer.id}}" } } }

  - id: prep
    kind: agent
    title: "Prepare a brief for the meeting with {{inputs.email}}"
    task_type: research
    skills: [meeting-prep]
    brief: |
      Write a one-page brief for the meeting with {{inputs.email}} at {{inputs.meeting_time}}: who they are, why they replied,
      what they said (quote it), and two questions worth asking. Use the research and reply records on this person.
    done_when: "A brief with who, why now, what they said with a quote, and two questions, each fact with its source."
    verify: { mode: peer }
    checks:
      - { id: brief, kind: code, run: checks/brief.mjs }
    output: { kind: record, type: meeting-brief }

  - { id: meeting-end, kind: code, run: steps/meeting-end.mjs }
  - { id: after-meeting, kind: wait, until: "{{steps.meeting-end.output.check_at}}" }

  - id: confirm
    kind: approval
    ask: "Did the meeting with {{inputs.email}} at {{inputs.meeting_time}} happen? Approve if it was held; note no-show or moved."
    due: 3d

standing_approvals:
  - { id: requested-time, step: book, description: "Book the exact time the person asked for, on the owner's calendar, when it is free" }

outcome: { kind: meeting_held, source: calendar, query: attended, params: { attendee: "{{inputs.email}}" }, window: 7d, every: 1d }
---
# Book the meeting

Started by **Handle a reply** when triage labels a message `meeting_time`. The owner can grant `requested-time` once so
that booking a time the person asked for needs no separate approval; any other time comes to the inbox.

The booking is proven from the calendar (`calendar.event`), not from what the agent says: one event at the agreed time
with the person among the attendees. After the meeting, the owner confirms it happened, and the play's outcome reads the
calendar's `attended` query, which is what a goal's "meetings held" metric counts.
