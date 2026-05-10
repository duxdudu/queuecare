# Test Report — QueueCare

**Date:** 2026-05-10
**Newman:** 6.2.2 — 33 requests, 73 assertions
**Playwright:** 1.59.1 — 16 tests, 5 groups

---

## What I Built

QueueCare has two parts: a backend API and a frontend web app.

The **backend** is a Node.js and Express REST API running on port 5000. It uses MongoDB Atlas through Mongoose for storage, and JWT tokens stored in httpOnly cookies for authentication. There are three route files — auth (register, login, logout), appointments (create, read, update, cancel, mark served), and queue (today's queue). Two middleware layers handle authentication and role enforcement.

The **frontend** is a React 19 app built with Vite, running on port 5173. It has seven pages: Login, Register, Dashboard, New Appointment, Appointment Detail, Edit Appointment, and Queue View. The app shows different things depending on your role — patients see only their own appointments and can create, edit, and cancel them. Staff see everyone's appointments and can mark patients as served.

A few decisions worth mentioning:

- Dates are stored as UTC midnight in MongoDB. This means the queue query always gets the right day regardless of what timezone the server is in.
- The JWT token comes back in both the cookie (for the browser) and the response body (for Newman, since it can't read httpOnly cookies the same way a browser does).
- Queue numbers are assigned by counting how many appointments already exist on that calendar day, then adding 1.
- Login state is kept in sessionStorage through a React context. When the page loads, the app reads from sessionStorage to restore the session.

---

## What I Tested

### API Tests — Newman

I wrote 33 requests split across 5 folders.

| Folder | What it covers |
|---|---|
| Setup | Registers 3 users, logs them all in, saves their tokens, creates one appointment for the serve test |
| Auth - Negative | Wrong password, email that doesn't exist, missing fields, no token, invalid token |
| Appointments - Happy Path | Create, list as patient, list as staff, get by ID, update, mark as served |
| Appointments - Negative | Missing fields, one patient trying to read another's appointment, patient trying to mark served, ID that doesn't exist |
| Appointments - Edge Cases | Past date, duplicate same day, bad date format, update to past date, cancel, cancel again, serve again, rebook after cancel |
| Queue | Today's queue with a date param, checks it's an array and sorted by queue number |

**Things I didn't test and why:**

- Updating a served appointment — I assumed the cancelled-status check covered all finished states. It doesn't. That became BUG-1.
- Cancelling a served appointment — same assumption. That became BUG-2.
- Sending a malformed ID like `not-a-valid-id` — I assumed Mongoose would return a clean 404. It returns a 500 with an internal error message. That became BUG-3.
- Sending spaces as the reason or doctor — I tested empty strings but not strings that are only whitespace. The check passes them through, Mongoose trims them to empty, and throws a validation error that leaks as a 500. That became BUG-4.
- Whether the queue number is correct after a cancellation — I checked that rebooking works, but not that the number assigned is right. It's inflated. That became BUG-5.
- Two requests hitting the same endpoint at the same time — the queue number logic is not atomic, so two simultaneous bookings on the same day could get the same number. I didn't test this.

### UI Tests — Playwright

I wrote 16 tests across 5 groups, all running headless in Chromium.

| Group | What it covers |
|---|---|
| Login Flow | Correct login, wrong password, email that doesn't exist, empty form submit |
| Create Appointment | Successful booking, queue number shows on dashboard, missing each required field, past date |
| Cancel Appointment | Cancel a pending appointment and see the status change, cancel button disabled on already-cancelled cards |
| Dashboard Role Views | Patient sees "My Appointments" and the create button, staff sees "All Appointments", unauthenticated user gets redirected to login |
| Appointment Detail | Clicking View goes to the right URL and shows the queue number |

**Things I didn't test in the UI:**

- The edit appointment page — the frontend hides the Edit button for served and cancelled appointments, so the real risk is at the API level. That's covered by Newman.
- The staff queue view — it needs an appointment booked for today's exact date to show anything, which is fragile to automate without a data setup script.
- The register page — it's a simple form and the API already validates everything.
- Logging out — low risk of breaking.
- Firefox and Safari — Chromium only.

---

## What I Automated vs What I Left Manual

I automated everything that can run reliably on any machine without needing specific data to already exist in the database. Newman covers the full API contract. Playwright covers the core patient flows that are most likely to break when the frontend changes.

I left these as manual checks:

- The register flow — straightforward, low risk.
- The staff queue view — needs today's date to have an appointment, which is time-dependent.
- The edit appointment UI — the backend risk is already covered by Newman.
- Anything that needs two browser sessions open at the same time.

---

## Bugs Found

All of these were confirmed by running Newman and by making direct HTTP calls with Node's http module. Nothing here is a guess — each one has a real HTTP response to back it up.

---

### BUG-1 — A patient can edit an appointment after it's been served

**Severity:** High
**Endpoint:** PUT /api/appointments/:id
**What happened:** HTTP 200 — the appointment was changed even though it was already served

The update handler blocks changes to cancelled appointments but has no check for served ones. So a patient can call PUT on a served appointment and the server saves the change. That means a patient can alter a completed medical record.

```
Staff marks appointment as served  →  200 OK
Patient sends PUT with new reason  →  200 OK  (should be 409)
```

The code in `backend/src/routes/appointments.js`:
```js
if (appointment.status === 'cancelled') {
  return res.status(409).json({ message: 'Cannot update a cancelled appointment' });
}
// nothing here checks for 'served'
```

The fix is one line — add the same check for `served` right after the cancelled one.

---

### BUG-2 — A patient can cancel an appointment after it's been served

**Severity:** High
**Endpoint:** DELETE /api/appointments/:id
**What happened:** HTTP 200 — the served appointment was set back to cancelled

The cancel handler checks if the appointment is already cancelled, but not if it's served. So a patient can call DELETE on a served appointment and the server changes its status to cancelled — wiping out the served record entirely.

```
Staff marks appointment as served   →  200 OK
Patient sends DELETE                →  200 OK  (should be 409)
Final status: cancelled             (served record gone)
```

Same fix as BUG-1 — add a check for `served` before the status gets changed.

---

### BUG-3 — Sending a bad ID returns a 500 with an internal error message

**Severity:** Medium
**Endpoint:** GET /api/appointments/:id (same problem on PUT, DELETE, and PATCH /serve)
**What happened:** HTTP 500 with a raw Mongoose error exposed to the caller

```
GET /api/appointments/not-a-valid-id
→ 500
{"error":"Cast to ObjectId failed for value \"not-a-valid-id\"..."}
```

When `findById` gets a string that isn't a valid MongoDB ObjectId, Mongoose throws a CastError. That error falls through to the generic catch block and becomes a 500 with internal details visible to anyone making the request.

The fix is to check `mongoose.Types.ObjectId.isValid(req.params.id)` at the top of each handler and return a clean 400 if it fails.

---

### BUG-4 — Sending spaces as reason or doctor returns a 500

**Severity:** Medium
**Endpoint:** POST /api/appointments
**What happened:** HTTP 500 with a raw Mongoose validation error

```
POST /api/appointments
body: { "date": "2026-07-01", "reason": "   ", "doctor": "   " }
→ 500
{"error":"Appointment validation failed: reason: Path `reason` is required..."}
```

The route checks `if (!reason)` — but a string of spaces is truthy, so it passes. The Mongoose schema has `trim: true`, which strips the spaces before saving, leaving an empty string. That fails the required check and throws a validation error that leaks out as a 500.

The fix is to trim the value before checking it: `!reason?.trim()` instead of `!reason`.

---

### BUG-5 — Queue numbers count cancelled appointments

**Severity:** Medium
**Endpoint:** POST /api/appointments (queue number assignment)
**What happened:** queueNumber: 2 when only one active appointment exists on that day

```
Patient A books on date X  →  queueNumber: 1
Patient A cancels it
Patient B books on date X  →  queueNumber: 2  (should be 1)
```

The query that counts appointments to assign the next queue number doesn't filter out cancelled ones. So if a day has 10 cancellations and one active booking, that patient gets queue number 11.

The fix is to add `status: { $ne: 'cancelled' }` to the countDocuments query.

---

### BUG-6 — The "No Token" test passes alone but fails in the full suite

**Severity:** Medium (this is a test infrastructure bug, not an app bug)
**Test:** Auth - Negative / No Token — GET /api/appointments
**What happened:** HTTP 200 in the full run, HTTP 401 when run alone

Newman keeps a cookie jar across all requests in a run. The Login steps in Setup store the token cookie. When the "No Token" test runs later without setting a Cookie header, Newman automatically sends the stored cookie anyway. The server sees a valid token and returns 200.

The server is doing the right thing. The test collection needs a pre-request script on that test to clear the cookie:
```js
pm.request.headers.upsert({ key: 'Cookie', value: '' });
```

---

### BUG-7 — Some error responses use "message" instead of "error"

**Severity:** Low
**Affected:** POST /api/appointments, PUT /api/appointments/:id
**What happened:** business rule errors return a different key than everything else

Most error responses across the API look like this:
```json
{ "error": "All fields are required" }
```

But several responses in appointments.js use `message` instead:
```json
{ "message": "You already have an appointment on this day" }
{ "message": "Appointment date cannot be in the past" }
{ "message": "Cannot update a cancelled appointment" }
```

This caused one Newman assertion to fail and means any frontend code that reads `err.error` will silently miss these errors.

The fix is to change all of these to use `error` as the key.

---

### BUG-8 — The login form lets you submit with empty fields

**Severity:** Low (UI)
**Page:** /login
**What happened:** clicking Login with nothing filled in sends a request to the API

The email and password inputs don't have the `required` attribute. So clicking submit with empty fields skips browser validation, sends empty values to the API, and shows the server's error message instead. The browser should catch this before any request is made.

The fix is to add `required` to both inputs in `frontend/src/pages/Login.jsx`.

---

## Bug Summary

| # | Bug | Severity | Where | Proof |
|---|-----|----------|-------|-------|
| 1 | Patient can edit a served appointment | High | PUT /api/appointments/:id | HTTP 200 → should be 409 |
| 2 | Patient can cancel a served appointment | High | DELETE /api/appointments/:id | HTTP 200 → should be 409 |
| 3 | Bad ID returns 500 with internal error | Medium | GET/PUT/DELETE /api/appointments/:id | HTTP 500 → should be 400 |
| 4 | Whitespace fields return 500 | Medium | POST /api/appointments | HTTP 500 → should be 400 |
| 5 | Queue numbers count cancelled appointments | Medium | POST /api/appointments | queueNumber 2 → should be 1 |
| 6 | Newman cookie jar breaks "No Token" test | Medium | Test collection | HTTP 200 → should be 401 |
| 7 | Inconsistent error key in responses | Low | POST/PUT /api/appointments | `message` → should be `error` |
| 8 | Login form missing required attributes | Low | frontend/src/pages/Login.jsx | Empty submit hits the API |

---

## What I Would Fix First

These are all small changes — most are one or two lines:

1. Add a `served` check to the PUT handler — same pattern as the cancelled check already there
2. Add a `served` check to the DELETE handler — same thing
3. Add `mongoose.Types.ObjectId.isValid()` before every `findById` call
4. Change `!reason` to `!reason?.trim()` in the POST handler
5. Add `status: { $ne: 'cancelled' }` to the queue number count query
6. Change all `message` keys in appointments.js to `error`
7. Add `required` to the login form inputs

For the test collection:
- Add a pre-request script to the "No Token" test to clear the cookie
- Use a timestamp-based date in the "Create Appointment" test so re-runs don't hit a duplicate-day conflict that breaks 20+ downstream tests

## What I Would Do With More Time

- Write a data seeding script so the Newman suite can run against a clean database every time without manual cleanup
- Test concurrent requests — two patients booking on the same day at the same time could get the same queue number because the count-then-insert logic isn't atomic
- Add Playwright tests for the edit appointment page, the staff queue view, and the register page
- Add max length validation to the backend — right now you can send a 10,000-character reason and it saves without complaint
- Fix the session handling — right now if you close the browser tab and reopen it, you get logged out even though the JWT cookie is still valid
