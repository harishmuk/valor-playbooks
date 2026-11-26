---
name: sending-setup
description: Set up, authenticate, warm up and test a separate domain and mailbox for outbound email, so outreach never touches the main domain's reputation.
---
# Sending setup

## Propose
- Pick a domain close to the brand but separate from the main one (for example `get<brand>.com` or `<brand>hq.com`).
  Never a subdomain of the main domain.
- One mailbox on it with a real person's name, matching the sender in the campaign.
- List every cost as `{item, usd, period}`: domain, mailbox seat, warmup service. Buy nothing before the go-ahead.

## Authenticate
- SPF: `v=spf1 include:<mail provider> ~all`
- DKIM: generate the key in the mail provider, publish the selector.
- DMARC: start at `v=DMARC1; p=none; rua=mailto:<reports address>`; tighten after 30 clean days.
- MX for the provider, so replies and bounces arrive.

## Warm up
- Ramp from about 5 to 40 emails a day over 14 days with your warmup tool. No campaign email during warmup.

## Seed test
- One realistic email (plain text, the real footer) to every seed inbox, with a subject used nowhere else.
- Report the subject as the pointer. Do not report placement yourself: it is read from the seed inboxes.
