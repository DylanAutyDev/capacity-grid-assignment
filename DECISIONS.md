# Decisions

Yours to write, not your AI's. Short is good — bullets are fine, and half a page is
plenty. We read this first.

## What did the spec not tell you?

There are things this brief doesn't specify. Which ones did you hit, what did you decide,
and why?

- Zero capacity entries like Eli will show as over-capacity immediately
- Week definition isn't clearly defined, I've gone with a Monday-Sunday approach and ISO week numbering so the week of 29 Dec 2025 shows as week 1 for the year as it leads into 2026


## What did you notice that looked wrong?

Anything in the output that didn't match what you expected. Whether you fixed it or left
it, we want to know you saw it.

- There was a 15 row duplication in the seed data, instead of fixing or deduping the data, I decided to retain this instead. This was detected by my agentic workflow
- Floating point drift, initially results were rounded per row. This was solved by rounding once on the final sum of the data instead

## What did the AI get wrong that you caught?

One concrete example. Every real session has one.

- Edge case processing of date range, I solved this by detering from greater than to range and providing a one-click solver
- Failed saves originally would roll back the optimistic update with no recovery path. Manager would need to re-enter this to update the value. Solved this by adding a retry option directly to the notice to allow state retention


## What would you do differently with a week?

- Add more filtering tooling to allow quicker identification of both under/over capacity entires 
- - Worth noting I did add a name filter and the ability to only show the over capacity entries
- Improve performance issues noticed when editing capacity in a large date range
- Dedup data if possible with high confidence, requires more investigation
- Further improvements to the grid visuals, although this is a good start I think we could do better visually
