---
name: send-approved-email
description: Prepare exactly the email the owner will approve, character for character, as a draft. VALOR sends it from the company mailbox after the go-ahead; you never send.
---
# Prepare an email for approval

You draft; VALOR sends. The company's mailboxes live in VALOR's vault, and after the owner approves your draft VALOR
sends exactly that text from the right mailbox, in a paced slot, under the go-ahead's idempotency key. You never hold
the mailbox's credentials and never send.

## What to return
- Copy the email from the record you were given, character for character. Do not improve it.
- Return `{to, subject, body}` as your draft (and the whole sequence alongside when the brief asks), with evidence
  that names the record you copied from.

## What happens next (so you can explain it if asked)
- The owner approves the draft (or a standing approval covers it).
- VALOR sends it once, inside the go-ahead's window, from the lane's mailbox; follow-ups go in the same thread.
- VALOR reads the sent folder back and checks there is exactly one message with the approved body.

## Never
- Send anything yourself, even if you happen to have access to a mailbox.
- Change the approved text. If something in the record looks wrong (a broken link, a wrong name, a figure with no
  source), ask the owner instead of fixing it.
