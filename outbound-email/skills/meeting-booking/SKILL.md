---
name: meeting-booking
description: Book a meeting at the time a person asked for on the owner's calendar, with a video link, and confirm it in the thread.
---
# Meeting booking

- Draft: the event (title, start, length, attendees, video link) and a one-line confirmation. Book nothing yet.
- After the go-ahead: create the event at exactly the agreed time with the person as an attendee, put the idempotency key
  in the description, send the confirmation in the same thread, and report the event id as the pointer.
- If the time is no longer free, ask; do not pick another time yourself.
