---
id: new-hire
step: write
inputs:
  campaign: spring-agencies
  email: lee@example.test
  name: Lee Chen
  company: Brightfold
  steps:
    load:
      output:
        campaign:
          id: spring-agencies
          name: Spring outreach to agency founders
          sender:
            name: Alex Rivera
            company: Northwind Ledger
            mailbox: alex@northwindledger-mail.test
            primary_domain: northwindledger.test
            postal_address: Northwind Ledger, 100 Example Street, Springfield, IL 62701
            warmup_days: 14
            setup_budget_usd: 80
            seed_inboxes:
            - seed1@example.test
            - seed2@example.test
            - seed3@example.test
            - seed4@example.test
            - seed5@example.test
            min_inbox_share: 0.8
          offer:
            ask: a 20-minute call next month
            claims:
            - We close the books for agencies by the 5th business day of each month.
            - Clients cut month-end time by 40% on average in their first quarter.
            - One flat monthly fee, starting at $900.
            pain_points:
            - late-close
            - cash-visibility
            - contractor-payments
            - project-margins
          rules:
            touches: 3
            first_max_words: 120
            followup_max_words: 80
            reply_max_words: 120
            max_questions: 1
            links_in_first: false
            banned_phrases:
            - transform
            - revolutionize
            - leverage
            - quick question
            - circle back
            - AI-powered
            opt_out_line: Not relevant? Reply "no" and I won't write again.
          audience:
            description: Independent creative and marketing agencies in the US with 10 to 200 staff, run by a founder or managing partner.
            saved_search: agency-founders-us
            per_company: 1
            list_size: 4
            reserve_share: 0.25
            max_segment_share: 0.5
            exclude_domains:
            - northwindledger.test
          research:
            hook_max_age_days: 365
          limits:
            max_bounce_rate: 0.03
            bounce_rate_min_sends: 20
          meeting:
            minutes: 30
    research:
      output:
        id: R-eval-2
        verdict: qualified
        hook:
          fact: Brightfold is hiring its first finance manager.
          source_url: https://example.test/jobs
          source_date: '2026-11-02'
          quote: Brightfold is hiring a Finance Manager.
        pain_points:
        - cash-visibility
reference:
  based_on_research: R-eval-2
compare:
- based_on_research
source: hand_written
---
A hiring signal: do not claim to replace the hire; offer to help while they hire. Scored by the play's own checks plus the reference fields; the rest is for a peer or the owner to read.
