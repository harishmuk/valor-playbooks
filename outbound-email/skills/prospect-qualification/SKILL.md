---
name: prospect-qualification
description: Judge a batch of candidate companies against a written audience definition and pick the right person at each qualified one.
---
# Prospect qualification

For each company in the batch:
1. Read the audience definition you were given. It is the only test; do not add your own.
2. Decide one verdict: `qualified`, `not_a_fit`, `out_of_size`, `out_of_region` or `other`.
3. Back it with one source you opened (company site, filing, reputable directory) and a one-line reason.
4. For a qualified company, choose people only from that company's candidates, no more than the per-company limit.
   Prefer the person who owns the problem the offer solves; say why in one line.
5. Give a `fit` from 0 to 1 for qualified companies, and a `segment` from the campaign's list if it has one.

Return every company in the batch, including the ones that fail. Never invent a person or an address.
