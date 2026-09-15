# Phase 5 — Student frontend, first increment

This increment adds student registration, role-aware login, a responsive dashboard,
branch/subject/chapter catalogue filters, title search, pagination and test details.
Filters are stored in the URL and retained when returning from details or logging in
through a protected deep link. Empty, loading, error and retry states are included.

## Run locally

Use Node.js compatible with the locked Vite version (Node 22.12+ recommended).
Install client and server dependencies with `npm ci` in each directory.
Configure server environment locally with `MONGO_URI`, `JWT_SECRET`, and optionally
`PORT=5000`. Set client `VITE_API_URL` if the API is not at
`http://localhost:5000/api`. Never include real environment values in commits.
Run `npm run dev` in each directory, then open the Vite URL and `/register`.
Registration uses the existing backend and returns to login after success.
Admin accounts still land at `/admin/dashboard`.

## API contract

`GET /api/student/catalogue` requires a valid active account. It returns active
branches, subjects under those branches, chapters under those subjects, and
published tests under those chapters. Test totals are aggregated from active,
published questions only. No question text, correct answers or solutions are
returned. IDs and parent references are serialized as strings.

The existing `/api/tests` and `/api/questions` GET routes now require an admin
account because they return drafts and/or answer keys for content management.
The admin frontend already supplies its bearer token. Any other consumers of
these formerly public endpoints must migrate to the student catalogue contract.

The first-release catalogue is fetched once per student-layout mount; filters
and 12-card pagination run locally. Refresh to see subsequently published changes.
At larger catalogue sizes, move filtering and pagination to the backend.

## Verification

- `npm --prefix client run build`
- `npm --prefix client run lint` (five pre-existing warnings in admin files)
- `node --test server/tests/studentCatalogue.test.js`

Backend tests use isolated model stubs and a local HTTP server. They do not load
`.env` or connect to a live database. Validate a real student registration and
published catalogue against your development MongoDB before release.

Browser interaction/visual checks were attempted but could not run because Chromium
was unavailable and its download timed out. They remain a release check.

## Next increment

Timed attempts are not implemented in this increment. Test detail pages explicitly
say attempts are coming soon. Add an Attempt model and server-authoritative
start/deadline, answer saving, submission and scoring before enabling Start Test.
Then implement the question palette, MCQ/MSQ/NAT inputs, timer, marked-for-review,
attempted/remaining counts, resume behaviour and results. No fake progress,
leaderboard or scores are shown in this increment.

## Existing repository issue

The baseline commit tracks `server/.env` and server dependencies. This change does
not copy their contents into new files. Remove them from tracking separately and
rotate any real exposed credentials; removing a file does not erase Git history.
