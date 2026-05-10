# QueueCare

QueueCare is a clinic appointment and queue management system. Patients book appointments and get a queue number. Staff see the full queue and mark patients as served. Built as a QA Engineering technical assessment.

---

## Project Structure

```
queuecare/
├── backend/          # Node.js + Express REST API
├── frontend/         # React + Vite web app
├── tests/
│   ├── api/          # Postman collection and environment file
│   └── ui/           # Playwright end-to-end tests
├── README.md
└── TEST_REPORT.md
```

Note: `node_modules/` folders are gitignored. They get created when you run `npm install` in each folder.

---

## What You Need Before Starting

Make sure you have these installed on your machine:

| Tool | Minimum Version | How to check |
|---|---|---|
| Node.js | 18 | `node --version` |
| npm | 9 | `npm --version` |
| Newman | 6 | `newman --version` |

MongoDB is already set up on Atlas. The connection string is in `backend/.env` — you don't need to install anything for the database.

---

## Environment Variables

Both `.env` files are already in the repo and ready to use. You don't need to change anything to run the project locally.

**backend/.env**

| Variable | Value | What it does |
|---|---|---|
| `PORT` | `5000` | The port the API runs on |
| `MONGODB_URI` | Atlas connection string | Connects to the cloud database |
| `JWT_SECRET` | `queuecare_secret_2024` | Signs and verifies login tokens |
| `CLIENT_URL` | `http://localhost:5173` | Tells the API which frontend origin to allow |

**frontend/.env**

| Variable | Value | What it does |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5000` | The URL the frontend uses to talk to the API |

---

## Installation

Run these commands once after cloning the repo. Do them in order.

```bash
# Install backend packages
cd backend
npm install

# Install frontend packages
cd ../frontend
npm install

# Go back to the root and install the Playwright test runner
cd ..
npm install

# Download the Chromium browser that Playwright uses for UI tests
npx playwright install chromium
```

---

## Running the App

You need two terminals open at the same time — one for the backend, one for the frontend.

**Terminal 1 — start the API:**
```bash
cd backend
npm run dev
```
The API will be running at `http://localhost:5000`

**Terminal 2 — start the web app:**
```bash
cd frontend
npm run dev
```
The app will be running at `http://localhost:5173`

Open `http://localhost:5173` in your browser. Keep both terminals running while you use the app or run tests.

---

## Test Accounts

Three accounts are needed to run the tests. You only need to create them once. The backend must be running when you do this.

| Role | Email | Password |
|---|---|---|
| Patient | `patient@test.com` | `Password123` |
| Staff | `staff@test.com` | `Password123` |
| Second Patient | `patient2@test.com` | `Password123` |

**Mac / Linux — run these in your terminal:**

```bash
curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Patient","email":"patient@test.com","password":"Password123","role":"patient"}'

curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Staff","email":"staff@test.com","password":"Password123","role":"staff"}'

curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Patient Two","email":"patient2@test.com","password":"Password123","role":"patient"}'
```

**Windows PowerShell:**

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Test Patient","email":"patient@test.com","password":"Password123","role":"patient"}'

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Test Staff","email":"staff@test.com","password":"Password123","role":"staff"}'

Invoke-RestMethod -Uri "http://localhost:5000/api/auth/register" -Method POST `
  -ContentType "application/json" `
  -Body '{"name":"Patient Two","email":"patient2@test.com","password":"Password123","role":"patient"}'
```

Each command returns `201 Created` the first time. If you run it again it returns `409 Conflict` because the account already exists — that's fine, just move on.

---

## Running the API Tests

The API tests use Newman (the command-line runner for Postman). The backend must be running.

**Install Newman if you haven't already:**
```bash
npm install -g newman
```

**Run the full test suite from the project root:**
```bash
newman run tests/api/QueueCare.postman_collection.json \
  --environment tests/api/QueueCare.postman_environment.json
```

Windows PowerShell:
```powershell
newman run tests/api/QueueCare.postman_collection.json --environment tests/api/QueueCare.postman_environment.json
```

Or use the shortcut:
```bash
npm run test:api
```

**What to expect:** 33 requests run, around 68–70 assertions checked. There will be some failures — they are real bugs that were found during testing. See `TEST_REPORT.md` for the full explanation.

**Run just one folder if you want to focus on a specific area:**
```bash
newman run tests/api/QueueCare.postman_collection.json \
  --environment tests/api/QueueCare.postman_environment.json \
  --folder "Auth - Negative"
```

The available folders are: `Setup`, `Auth - Negative`, `Appointments - Happy Path`, `Appointments - Negative`, `Appointments - Edge Cases`, `Queue`

**Run manually in Postman:**
1. Open Postman
2. Click Import and select `tests/api/QueueCare.postman_collection.json`
3. Import `tests/api/QueueCare.postman_environment.json` the same way
4. Select **QueueCare Environment** from the environment dropdown (top right)
5. Open the collection and click **Run collection**

---

## Running the UI Tests

The UI tests use Playwright and run in a headless Chromium browser. Both the backend and frontend must be running before you start these.

**Run all 16 UI tests from the project root:**
```bash
npm run test:ui
```

Or directly:
```bash
npx playwright test --config frontend/playwright.config.js
```

**Watch the browser while tests run:**
```bash
npx playwright test --config frontend/playwright.config.js --headed
```

**Open the HTML report after a run:**
```bash
npx playwright show-report
```

**What to expect:** 16 tests across 5 groups. All should pass. The tests cover login, creating appointments, cancelling, role-based dashboard views, and the appointment detail page.

---

## API Endpoints

### Auth

| Method | Path | Who can call it | What it does |
|---|---|---|---|
| POST | `/api/auth/register` | Anyone | Create a new account |
| POST | `/api/auth/login` | Anyone | Log in, sets a session cookie |
| POST | `/api/auth/logout` | Logged-in users | Log out, clears the cookie |

### Appointments

| Method | Path | Who can call it | What it does |
|---|---|---|---|
| POST | `/api/appointments` | Patients only | Book a new appointment |
| GET | `/api/appointments` | Logged-in users | List appointments (patients see their own, staff see all) |
| GET | `/api/appointments/:id` | Logged-in users | Get one appointment by ID |
| PUT | `/api/appointments/:id` | Patients only | Update their own pending appointment |
| DELETE | `/api/appointments/:id` | Patients only | Cancel their own appointment |
| PATCH | `/api/appointments/:id/serve` | Staff only | Mark a patient as served |

### Queue

| Method | Path | Who can call it | What it does |
|---|---|---|---|
| GET | `/api/queue/today` | Logged-in users | Get today's full queue sorted by queue number. Add `?date=YYYY-MM-DD` to query a specific date |

---

## Deployment

**Live backend:** `https://queuecare-2.onrender.com`  
**Live frontend:** `https://queuecares.netlify.app`

---

### How They Are Connected

The frontend calls the backend using `VITE_API_URL`. The backend allows requests from the frontend using `CLIENT_URL` in the CORS config. Both are set as environment variables on their respective platforms.

| Platform | Service | Environment Variable | Value |
|---|---|---|---|
| Netlify | Frontend | `VITE_API_URL` | `https://queuecare-2.onrender.com` |
| Render | Backend | `CLIENT_URL` | `https://queuecares.netlify.app` |

---

### Render — Backend Environment Variables

Go to your Render service → **Environment** and make sure these are set:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `MONGODB_URI` | The Atlas connection string from `backend/.env` |
| `JWT_SECRET` | The JWT secret from `backend/.env` |
| `CLIENT_URL` | `https://queuecares.netlify.app` |

After saving, Render will redeploy automatically.

---

### Netlify — Frontend Environment Variables

Go to your Netlify site → **Site configuration → Environment variables** and make sure this is set:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://queuecare-2.onrender.com` |

After saving, trigger a new deploy from **Deploys → Trigger deploy**.

---

### Netlify — Build Settings

| Setting | Value |
|---|---|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `frontend/dist` |

---

### Why Cookies Work in Production

The frontend (Netlify) and backend (Render) are on different domains. For cookies to work cross-domain, the backend sets them with `secure: true` and `sameSite: 'none'` in production. Locally it uses `sameSite: 'lax'` and `secure: false` so they work without HTTPS.

---

### Run API Tests Against the Live Backend

```bash
newman run tests/api/QueueCare.postman_collection.json \
  --environment tests/api/QueueCare.postman_environment.production.json
```

> The free Render tier sleeps after 15 minutes of inactivity. The first request after a sleep takes about 60 seconds. Just wait and retry.
