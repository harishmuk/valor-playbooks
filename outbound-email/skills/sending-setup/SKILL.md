---
name: sending-setup
description: Propose, buy and authenticate a separate domain and mailbox for outbound email, so outreach never touches the main domain's reputation. Warmup is the warmup provider's job.
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
- Not yours: the owner connects the mailbox to the workspace's warmup provider, and VALOR's mailbox-health play holds
  the mailbox until its health score clears the threshold.
