---
name: send-approved-email
description: Send exactly the email the owner approved, once, from your own mailbox, inside the go-ahead's window, and report the message id.
---
# Send an approved email

## Draft phase (before any go-ahead)
- Copy the email from the record you were given, character for character. Do not improve it.
- Return `{to, subject, body}` (and the whole sequence alongside when asked). **Send nothing.**

## After the go-ahead
- Send once, from the mailbox named in the brief, between the go-ahead's start and end.
- Put the go-ahead's idempotency key in a header (for example `X-Valor-Key`) so a retry can see it was already sent.
- Follow-ups go as replies in the same thread.
- Report a pointer `{id: <message id>, to}` and evidence `{kind: "message_id", value, idempotency_key, acted_at}`.

## Never
- Send before the go-ahead, after it expires, or twice. If you are unsure whether it went, check your sent folder and
  report what is there; do not resend.
- Send anything that differs from the approved text. If something looks wrong, ask instead.
