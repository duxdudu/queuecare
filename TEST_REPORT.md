# TEST_REPORT.md — QueueCare

**Date:** 2026-05-10  
**Newman version:** 6.2.2  
**Playwright version:** 1.59.1  
**Collection:** QueueCare API Tests — 33 requests, 73 assertions  

---

## What I Built

QueueCare is a full-stack clinic queue management system with two separate servers.

**Backend** — Node.js + Express REST API on port 5000. MongoDB Atlas via Mongoose. JWT authentication stored in `httpOnly` cookies. Three route files: `auth` (register, login, logout), `appointments` (create, read, update, cancel, serve), `queue` (today's queue). Two middleware layers: `authenticate` (verifies the JWT cookie) and `requireRole` (enforces patient vs staff access).

**Frontend** — React 19 + Vite SPA on port 5173. Seven pages: Login, Register, Dashboard, NewAppointment, AppointmentDetail, EditAppointment, QueueView. Role-based rendering throughout — patients see only their own appointments and can create, edit, and cancel; staff see all appointments and can mark them served from both the Dashboard and the QueueView.

**Key architectural decisions:**

- Dates are stored as UTC midnight in MongoDB. A helper `parseUTCDate()` converts the `YYYY-MM-DD` string from the client before saving, so queue queries always agree on which calendar day an appointment belongs to regardless of server timezone.
- The JWT is returned in both the `httpOnly` cookie (used by the browser) and the response body (used by Newman, which cannot read cookies set by the server the same way a browser does).
- Queue numbers are assigned by counting all appointments on the same calendar day at the moment of creation, then adding 1.
- Auth state is stored in `sessionStorage` via a React context. On page load the app reads from `sessionStorage` to restore the session without a server round-trip.

---

## What I Tested

### API — Postman / Newman

33 requests across 5 folders.

| Folder | What it covers |
|---|---|
| Setup | Register 3 users (patient, staff, second patient), login all 3, capture tokens into environment variables, seed one appointment for the serve test |
| Auth - Negative | Wrong password → 401, non-existent email → 401, missing fields → 400, no token → 401, invalid token → 401 |
| Appointments - Happy Path | Create appointment, list as patient (own only), list as staff (all), get by ID, update reason and doctor, staff marks served |
| Appointments - Negative | Missing required fields, cross-patient read access → 403, patient tries to mark served → 403, non-existent ID → 404 |
| Appointments - Edge Cases | Past date rejected, duplicate same day rejected, invalid date format rejected, update to past date rejected, cancel, cancel-already-cancelled, serve-already-served, rebook after cancel |
| Queue | GET /api/queue/today with `?date=` param, response is array, sorted by queueNumber ascending |

**What I skipped and why:**

- `PUT /api/appointments/:id` against a `served` appointment — I assumed the `cancelled` guard in the same handler covered all terminal states. It does not. This became BUG-1.
- Malformed ObjectId strings as `:id` — I assumed Mongoose would return a clean 404. It returns a raw 500. This became BUG-2.
- Whitespace-only strings for `reason` and `doctor` — I tested empty strings but not `"   "`. The falsy check passes whitespace, Mongoose trims it to `""` and throws a validation error that leaks as a 500. This became BUG-3.
- Queue number value after a cancel-then-rebook — I tested that the rebook succeeds (201) but not that the queue number assigned is correct. It is inflated. This became BUG-4.
- Concurrency — two simultaneous POSTs on the same day. The count-then-insert pattern is not atomic and would produce duplicate queue numbers under load. Not tested.

### UI — Playwright

~15 scenarios across 5 groups, all headless, Chromium only.

| Group | Scenarios |
|---|---|
| Login Flow | Valid credentials → dashboard, wrong password → error stays on login, non-existent email → error, empty form → browser validation blocks submit |
| Create Appointment | Valid submit → success banner → redirect to dashboard, queue number visible on card, missing date/reason/doctor → error, past date → error |
| Cancel Appointment | Cancel pending → status badge changes to cancelled, cancel button disabled on already-cancelled cards |
| Dashboard Role Views | Patient sees "My Appointments" heading + create button, staff sees "All Appointments" heading, unauthenticated access redirects to login |
| Appointment Detail | View link navigates to `/appointments/:id`, queue number visible on detail page |

**What I skipped:**

- Edit appointment UI flow — the frontend correctly hides the Edit button for served and cancelled appointments, so the real risk is at the API layer. That is covered by Newman. The UI test would not have caught BUG-1 because the button is never rendered for served appointments.
- Staff queue view (QueueView page) — the mark-served button requires a seeded appointment for today's exact date. That is time-dependent and fragile without a dedicated seeding script.
- Register page — straightforward form with no business logic beyond what the API already validates.
- Logout flow — low regression risk, skipped to keep the suite lean.
- Cross-browser — Chromium only. Firefox and WebKit not tested.

---

## What I Automated vs Manual

**Automated with Newman:** All 33 API scenarios. Newman runs in one command, produces a clear pass/fail per assertion, and is suitable for CI. It covers the full HTTP contract: status codes, response shape, role-based filtering, and business rule enforcement.

**Automated with Playwright:** Core patient flows — login, create, cancel, dashboard rendering, detail view. These are the highest-traffic paths and the ones most likely to break silently on a frontend change.

**Left as manual:**

- Register flow — no business logic beyond what the API validates; low regression risk.
- Staff queue view — requires a live appointment for today's date. Automating this reliably needs a seeding step that creates an appointment with today's date at test startup, which I did not build.
- Edit appointment UI — the backend risk is covered by Newman (BUG-1). The UI hides the edit button for non-pending appointments, so a UI test would only confirm the button is hidden, not that the API rejects the request.
- Any scenario requiring two simultaneous browser sessions (e.g. staff marks served while patient is on the detail page).

The line I drew: automate anything that runs cleanly on every code change without needing manual state setup or time-dependent data. Leave scenarios that require seeding, multi-session coordination, or today's date as documented manual checks.

---

## Bugs Found

All six bugs were confirmed by running Newman and by direct HTTP calls using Node's built-in `http` module. None were assumed — each has a reproduction step and an observed HTTP response.

---

### BUG-1 — Patient can edit a served appointment
**Severity:** High  
**Endpoint:** `PUT /api/appointments/:id`

The `PUT` handler checks for `cancelled` status and blocks the update. It has no equivalent check for `served`. A patient who owns a served appointment can call PUT and the server returns `200 OK` and saves the change — effectively letting a patient alter a completed medical record after the fact.

```
PATCH /api/appointments/:id/serve  →  200  (staff marks served)
PUT   /api/appointments/:id        →  200  (patient edits it — should be 409)
```

Root cause in `routes/appointments.js`:
```js
if (appointment.status === 'cancelled') {
  return res.status(409).json({ message: 'Cannot update a cancelled appointment' });
}
// no equivalent guard for 'served'
```

Fix: add one line — `if (appointment.status === 'served') return res.status(409).json(...)` — immediately after the cancelled check.

---

### BUG-2 — Invalid ObjectId returns 500 and leaks a Mongoose error message
**Severity:** Medium  
**Endpoint:** `GET /api/appointments/:id` (same issue on PUT, DELETE, PATCH /serve)

```
GET /api/appointments/not-a-valid-id
→  500 Internal Server Error
{"error":"Cast to ObjectId failed for value \"not-a-valid-id\" (type string) at path \"_id\" for model \"Appointment\""}
```

Mongoose throws a `CastError` when `findById` receives a string that is not a valid ObjectId. It falls through to the generic `catch` block and becomes a 500 with an internal Mongoose message exposed to the client.

Fix: add `if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(400).json({ error: 'Invalid appointment ID' })` at the top of each handler that uses `req.params.id`.

---

### BUG-3 — Whitespace-only `reason` or `doctor` returns 500
**Severity:** Medium  
**Endpoint:** `POST /api/appointments`

```
POST /api/appointments
body: { "date": "2026-07-01", "reason": "   ", "doctor": "   " }
→  500 Internal Server Error
{"error":"Appointment validation failed: reason: Path `reason` is required., doctor: Path `doctor` is required."}
```

The route validates `if (!reason)` — a string of spaces is truthy, so it passes. The Mongoose schema has `trim: true`, which collapses `"   "` to `""` at the database layer, triggering a required-field validation error. That error is never caught cleanly and becomes a 500 with a raw Mongoose message.

Fix: trim before the falsy check — `if (!date || !reason?.trim() || !doctor?.trim())` — so the route returns a clean `400` before touching the database.

---

### BUG-4 — Queue numbers are inflated by cancelled appointments
**Severity:** Medium  
**Endpoint:** `POST /api/appointments` (queue number assignment logic)

```
Patient A creates appointment on date X  →  queueNumber: 1
Patient A cancels it
Patient B creates appointment on date X  →  queueNumber: 2  (should be 1)
```

The `countDocuments` query that determines the next queue number counts all appointments on the day, including cancelled ones. A clinic day with 10 cancellations and 1 active booking would assign `queueNumber: 11` to the only patient in the room.

Root cause:
```js
const appointmentsOnDay = await Appointment.countDocuments({
  date: { $gte: startOfDay, $lte: endOfDay }
  // no status filter — cancelled appointments are counted
});
```

Fix: add `status: { $ne: 'cancelled' }` to the query.

---

### BUG-5 — Newman cookie jar causes the "No Token" test to return 200 instead of 401
**Severity:** Medium (test infrastructure bug, not an application bug)  
**Test:** `Auth - Negative / No Token — GET /api/appointments`

Newman maintains an internal cookie jar across requests in a run. The Login steps in the Setup folder set a `token` cookie. When the "No Token" test runs later with no explicit `Cookie` header, Newman silently re-sends the stored cookie. The server sees a valid token and returns `200 OK`. The test expects `401 Unauthorized`.

Proof: running the `Auth - Negative` folder in isolation passes all 5 tests including "No Token". Running the full collection fails it. The server is behaving correctly.

Fix: add a pre-request script to the "No Token" test that overrides the cookie header:
```js
pm.request.headers.upsert({ key: 'Cookie', value: '' });
```

---

### BUG-6 — Inconsistent error response key across endpoints
**Severity:** Low  
**Affected:** `POST /api/appointments`, `PUT /api/appointments/:id`

Most 4xx responses across the API use `{ "error": "..." }`. Several business-rule rejections in `appointments.js` use `{ "message": "..." }` instead:

```json
{ "message": "You already have an appointment on this day" }
{ "message": "Appointment date cannot be in the past" }
{ "message": "Cannot update a cancelled appointment" }
```

This caused one Newman assertion to fail on re-runs (the "Duplicate Same Day Rejected" test checks for `409` but the response key mismatch meant the assertion was reading the wrong field). It also means any frontend code that reads `err.error` uniformly will silently swallow these errors.

Fix: standardise all 4xx responses in `appointments.js` to use `error` as the key.

---

## What I Would Improve

**Fix immediately (all are one-line or two-line changes):**

1. Add a `served` status guard to `PUT /api/appointments/:id` — same pattern as the existing `cancelled` check
2. Add `mongoose.Types.ObjectId.isValid()` before every `findById` call — stops the 500 and the internal error leak
3. Trim fields before the falsy check in `POST /api/appointments` — `!reason?.trim()` instead of `!reason`
4. Add `status: { $ne: 'cancelled' }` to the queue number `countDocuments` query
5. Standardise all 4xx responses in `appointments.js` to use `error` as the key

**Fix the test collection:**

- Add a pre-request script to the "No Token" test to clear the cookie header (BUG-5 fix)
- Use a unique far-future date per run (e.g. based on a timestamp) for the "Create Appointment" test so re-runs do not hit a duplicate-day `409` that cascades into 20+ downstream failures

**Given more time:**

- Write a test-data seeding script that registers the three test accounts and clears appointment data before each Newman run, so the suite is fully repeatable without manual DB cleanup
- Add a concurrency test — two simultaneous `POST /api/appointments` requests for the same day should not produce the same queue number; the current count-then-insert is not atomic and would fail under any real load
- Add Playwright tests for the edit appointment flow, the staff QueueView mark-served button, and the register page
- Add input length validation to the backend — `reason`, `doctor`, and `name` fields currently have no maximum length; a 10,000-character reason string is accepted and stored without error
- Replace `sessionStorage` with a server-side session check on app load — currently closing the browser tab and reopening it silently logs the user out even though the JWT cookie is still valid
