---
id: claims-only
description: Nothing goes out that states a figure the campaign's allowed claims do not back, or uses a banned phrase.
applies_to: { plays: [prospect-sequence, handle-reply] }
on_trip: block
approved_by: owner
---
The writing step's checks already enforce this. The guard runs again on the exact text being released, so an edit
made after the checks, or a layer that loosened a check, still cannot put an unsupported claim in front of a customer.
