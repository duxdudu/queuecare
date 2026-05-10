# QueueCare

A clinic appointment and queue management system built for a QA Engineering technical assessment.

---

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 18 or higher | `node --version` to check |
| npm | 9 or higher | Comes with Node.js |
| Newman | 6 or higher | For running API tests from the terminal |
| Playwright browsers | Chromium | Installed via `npx playwright install` |
| MongoDB | Atlas (cloud) | Connection string is pre-configured in `Backend/.env` |
| Browser | Any modern browser | For manual use of the app |

---

## Environment Variables

Both `.env` files are included in the repo and pre-configured. No changes are needed to run the project locally.

### Backend — `Backend/.env`

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port the Express server listens on |
| `MONGODB_URI` | *(Atlas URI)* | MongoDB connection string |
| `JWT_SECRET` | `queuecare_secret_2024` | Secret used to sign and verify JWTs |
| `CLIENT_URL` | `http://localhost:5173` | React app origin, used for CORS |

### Frontend — `Frontend/.env`

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | Base URL of the Express API |

If you change `PORT` in the backend `.env`, update `VITE_API_URL` and `CLIENT_URL` to match.

---

## Install Dependencies

Run these once after cloning.

```bash
# Backend
cd Backend
npm install

# Frontend
cd ../Frontend
npm install
```

---

## Start the Application

You need two terminals running at the same time.

**Terminal 1 — Backend:**

```bash
cd Backend
npm run dev
```

The API will be available at `http://localhost:5000`.

**Terminal 2 — Frontend:**

```bash
cd Frontend
npm run dev
```

The app will be available at `http://localhost:5173`. Open that URL in your browser.

Both servers must be running before you run any tests.

---

## Default Test Credentials

These three accounts are used by both the API tests and the UI tests. Register them once before running any test suite.

| Role | Email | Password |
|---|---|---|
| Patient | `patient@test.com` | `Password123` |
| Staff | `staff@test.com` | `Password123` |
| Second Patient | `patient2@test.com` | `Password123` |

**Register all three accounts** by running these commands with the backend server running:

```bash
# Patient
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Patient\",\"email\":\"patient@test.com\",\"password\":\"Password123\",\"role\":\"patient\"}"

# Staff
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Test Staff\",\"email\":\"staff@test.com\",\"password\":\"Password123\",\"role\":\"staff\"}"

# Second Patient
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Patient Two\",\"email\":\"patient2@test.com\",\"password\":\"Password123\",\"role\":\"patient\"}"
```

Each command returns `201 Created` on first run, or `409 Conflict` if the account already exists — both are fine.

On Windows (PowerShell), use this form instead:

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" `
  -Method POST -ContentType "application/json" `
  -Body '{"name":"Test Patient","email":"patient@test.com","password":"Password123","role":"patient"}'
```

---

## Run API Tests (Newman)

### Install Newman

```bash
npm install -g newman
```

### Run the full suite

From the project root, with the backend server running:

```bash
newman run tests/api/QueueCare.postman_collection.json \
  --environment tests/api/QueueCare.postman_environment.json
```

On Windows:

```powershell
newman run tests/api/QueueCare.postman_collection.json --environment tests/api/QueueCare.postman_environment.json
```

**What to expect:** 33 requests, ~68 assertions. There will be failures — see `TEST_REPORT.md` for a full explanation of each one.

### Run a single folder

```bash
newman run tests/api/QueueCare.postman_collection.json \
  --environment tests/api/QueueCare.postman_environment.json \
  --folder "Auth - Negative"
```

Available folders: `Setup`, `Auth - Negative`, `Appointments - Happy Path`, `Appointments - Negative`, `Appointments - Edge Cases`, `Queue`

### Run via Postman (manual)

1. Open Postman desktop
2. Import `tests/api/QueueCare.postman_collection.json`
3. Import `tests/api/QueueCare.postman_environment.json`
4. Select the **QueueCare Environment** from the environment dropdown
5. Open the collection and click **Run collection**

---

## Run UI Tests (Playwright)

The frontend dev server must be running on port 5173 before running UI tests. The backend must also be running.

### Install Playwright browsers (first time only)

```bash
cd Frontend
npx playwright install chromium
```

### Run the full UI test suite

```bash
cd Frontend
npx playwright test
```

### Run with a visible browser (headed mode)

```bash
cd Frontend
npx playwright test --headed
```

### Run a single test file

```bash
cd Frontend
npx playwright test tests/ui/appointments.spec.js
```

### View the HTML report after a run

```bash
cd Frontend
npx playwright show-report
```

**What to expect:** ~15 scenarios across 5 groups. Tests require the three test accounts to exist in the database (see Default Test Credentials above).

---

## Project Structure

```
queuecare/
├── Backend/
│   ├── src/
│   │   ├── routes/         # auth.js, appointments.js, queue.js
│   │   ├── middleware/     # authenticate.js, requireRole.js
│   │   ├── models/         # User.js, Appointment.js
│   │   ├── lib/            # db.js, auth.js
│   │   └── app.js
│   ├── .env
│   └── package.json
│
├── Frontend/
│   ├── src/
│   │   ├── pages/          # Login, Register, Dashboard, NewAppointment,
│   │   │                   # AppointmentDetail, EditAppointment, QueueView
│   │   ├── components/     # Layout.jsx, AppointmentCard.jsx
│   │   └── lib/            # api.js, AuthContext.jsx
│   ├── tests/
│   │   └── ui/
│   │       └── appointments.spec.js
│   ├── .env
│   ├── playwright.config.js
│   └── package.json
│
├── tests/
│   └── api/
│       ├── QueueCare.postman_collection.json
│       └── QueueCare.postman_environment.json
│
├── README.md
└── TEST_REPORT.md
```

---

## API Reference

### Auth

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | None | Register a new user |
| POST | `/api/auth/login` | None | Login, sets httpOnly cookie |
| POST | `/api/auth/logout` | Cookie | Clears the auth cookie |

### Appointments

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/appointments` | Patient | Create an appointment |
| GET | `/api/appointments` | Any | List appointments (filtered by role) |
| GET | `/api/appointments/:id` | Any | Get a single appointment |
| PUT | `/api/appointments/:id` | Patient | Update own appointment |
| DELETE | `/api/appointments/:id` | Patient | Cancel own appointment |
| PATCH | `/api/appointments/:id/serve` | Staff | Mark appointment as served |

### Queue

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/queue/today` | Any | Today's queue, sorted by queue number. Accepts optional `?date=YYYY-MM-DD` |
