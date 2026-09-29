# Worklog

## API design

- `GET /api/capacity?from=&to=` returns `{from, to, weeks: [{start,end}], people: [{id, name, weeklyHours, allocations: {weekStart: hours}}]}`. Allocations keyed by ISO week-start (Monday) so the frontend can render sparse data without a dense matrix.
- Every person is returned even with zero allocations (capacity row still matters).
- Weeks snap to Monday. `from`/`to` are validated (ISO date, from <= to, max 2 years).
- Allocation math: `SUM(hours_per_day)` over rows overlapping the week, prorated by workdays (Mon-Fri) in the overlap vs the assignment's total workdays, so multi-week assignments split fairly. Rounded to 2dp.

## Data observations

- Every logical assignment (person+project+date-range) exists as 15 rows: 14 at `hours_per_day = h` and 1 at exactly `2h`. Summing all rows as literal assignments gives allocations of ~1-12h/wk against 20-40h capacity; the only visible over-allocation in the default range is Eli Nakamura (0h capacity, 4h allocated). Decided to sum all rows as-is per the schema's wording; noted the pattern instead of second-guessing the seed.
- Default range (2025-12-29..2026-01-16) is mostly sparse (weeks 2-3 have ~3-6 people); neighbouring weeks have ~300. Deliberate; grid navigation makes it explorable.

## Decisions

- Optimistic update on PATCH weekly hours: apply locally, rollback on failure, toast with dismiss + retry holding the desired value.
- Proration counts Mon-Fri workdays only.

## Verification

- `GET /api/capacity` returns 500 people, 3 weeks for the default range; Ana: 8h (w/c 2025-12-29), 6h (w/c 2026-01-12); Eli: 4h at 0 capacity.
- PATCH: 200 on success, 400 on bad body/range, 404 on unknown id.

## Frontend

- Grid loads via fetch on mount/range change; loading + error/retry states; sticky person column; prev/next week buttons and from/to date inputs; over-allocation cells tinted red with a ▲ badge.
- Editing weekly hours: click the h/w button → inline input (Enter/blur commits, Esc cancels). Optimistic update; on PATCH failure roll back and show a dismissable toast with Retry (re-sends the desired value). Validation errors get a dismiss-only toast.
- 500 rows render fine as a plain table; noted for production: virtualization / pagination for a few-thousand-person roster (not built).
- Tests: 9 passing (7 unit for date/format/parse helpers in `capacity.test.ts`, 2 for grid render + failed-save rollback in `CapacityGrid.test.tsx`). `npx tsc --noEmit` clean.

## Verification (frontend)

- Headless Edge dump of http://localhost:3000 shows the rendered grid: people rows, week headers, over-allocation cell (Eli 4/0), no stuck loading state.

## Notes to self

- docker.exe not on PATH in shell: `C:\Users\dylan\AppData\Local\Programs\DockerDesktop\resources\bin\docker.exe` + `docker-credential-desktop.exe` on PATH fixes `compose up --build`.
- Worklog: keep short entries, append-only.
