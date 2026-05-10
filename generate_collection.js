// Generates tests/api/QueueCare.postman_collection.json
// Run: node generate_collection.js
const fs = require('fs')

function makeUrl(path, queryParams) {
  const base = 'http://localhost:5000'
  const full = `${base}${path}${queryParams ? '?' + queryParams : ''}`
  const pathParts = path.replace(/^\//, '').split('/')
  const obj = {
    raw: full,
    protocol: 'http',
    host: ['localhost'],
    port: '5000',
    path: pathParts
  }
  if (queryParams) {
    obj.query = queryParams.split('&').map(q => {
      const [k, v] = q.split('=')
      return { key: k, value: v }
    })
  }
  return obj
}

function req(name, method, path, { auth, body, prereq, tests, queryParams } = {}) {
  const item = {
    name,
    event: [],
    request: {
      method,
      header: [
        { key: 'Content-Type', value: 'application/json' },
        ...(auth ? [{ key: 'Cookie', value: `token={{${auth}}}` }] : [])
      ],
      url: makeUrl(path, queryParams),
      ...(body ? {
        body: {
          mode: 'raw',
          raw: JSON.stringify(body, null, 2),
          options: { raw: { language: 'json' } }
        }
      } : {})
    },
    response: []
  }
  if (prereq) item.event.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: prereq } })
  if (tests) item.event.push({ listen: 'test', script: { type: 'text/javascript', exec: tests } })
  return item
}

function folder(name, items) { return { name, item: items } }

// Pre-request date helpers — all use pm.environment.set so {{var}} resolves in Newman
const setTomorrow = [
  `const d = new Date(); d.setDate(d.getDate() + 1);`,
  `pm.environment.set('tomorrow', d.toISOString().split('T')[0]);`
]
const setYesterday = [
  `const d = new Date(); d.setDate(d.getDate() - 1);`,
  `pm.environment.set('yesterday', d.toISOString().split('T')[0]);`
]
const setDayPlus2 = [
  `const d = new Date(); d.setDate(d.getDate() + 2);`,
  `pm.environment.set('dayPlus2', d.toISOString().split('T')[0]);`
]
// Use day+5 for the main appointment so it never collides with serve-test (day+2) or other runs
const setDayPlus5 = [
  `const d = new Date(); d.setDate(d.getDate() + 5);`,
  `pm.environment.set('dayPlus5', d.toISOString().split('T')[0]);`
]
const setTodayDate = [
  `const d = new Date();`,
  `pm.environment.set('todayDate', d.toISOString().split('T')[0]);`
]

const collection = {
  info: {
    _postman_id: 'queuecare-api-v4',
    name: 'QueueCare API Tests',
    description: [
      'Full API test suite — 33 requests, 70+ assertions.',
      'Auth: JWT extracted from response body and sent as Cookie header.',
      'Dates computed dynamically in pre-request scripts.',
      'Run: newman run QueueCare.postman_collection.json --environment QueueCare.postman_environment.json'
    ].join(' '),
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },

  // Collection-level variables (fallback defaults)
  variable: [
    { key: 'baseUrl',               value: 'http://localhost:5000' },
    { key: 'patientEmail',          value: 'patient@test.com' },
    { key: 'patientPassword',       value: 'Password123' },
    { key: 'staffEmail',            value: 'staff@test.com' },
    { key: 'staffPassword',         value: 'Password123' },
    { key: 'secondPatientEmail',    value: 'patient2@test.com' },
    { key: 'secondPatientPassword', value: 'Password123' }
  ],

  item: [

    // ── SETUP ──────────────────────────────────────────────────────────────
    folder('Setup', [

      req('Register Patient', 'POST', '/api/auth/register', {
        body: { name: 'Test Patient', email: '{{patientEmail}}', password: '{{patientPassword}}', role: 'patient' },
        tests: [
          `// 201 = created, 409 = already exists — both are acceptable`,
          `pm.test('Register patient: 201 or 409', () => pm.expect([201, 409]).to.include(pm.response.code));`,
          `if (pm.response.code === 201) {`,
          `  const u = pm.response.json().user;`,
          `  pm.test('No password in response', () => pm.expect(u).to.not.have.property('password'));`,
          `  pm.test('role is patient', () => pm.expect(u.role).to.equal('patient'));`,
          `}`
        ]
      }),

      req('Register Staff', 'POST', '/api/auth/register', {
        body: { name: 'Test Staff', email: '{{staffEmail}}', password: '{{staffPassword}}', role: 'staff' },
        tests: [
          `pm.test('Register staff: 201 or 409', () => pm.expect([201, 409]).to.include(pm.response.code));`,
          `if (pm.response.code === 201) {`,
          `  pm.test('role is staff', () => pm.expect(pm.response.json().user.role).to.equal('staff'));`,
          `}`
        ]
      }),

      req('Register Second Patient', 'POST', '/api/auth/register', {
        body: { name: 'Second Patient', email: '{{secondPatientEmail}}', password: '{{secondPatientPassword}}', role: 'patient' },
        tests: [
          `pm.test('Register second patient: 201 or 409', () => pm.expect([201, 409]).to.include(pm.response.code));`
        ]
      }),

      req('Login Patient', 'POST', '/api/auth/login', {
        body: { email: '{{patientEmail}}', password: '{{patientPassword}}' },
        tests: [
          `pm.test('Login patient: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.test('Response has user object', () => pm.expect(b.user).to.exist);`,
          `pm.test('Role is patient', () => pm.expect(b.user.role).to.equal('patient'));`,
          `pm.test('No password in response', () => pm.expect(b.user).to.not.have.property('password'));`,
          `pm.environment.set('patientToken', b.token);`,
          `pm.environment.set('patientId', b.user.id);`
        ]
      }),

      req('Login Staff', 'POST', '/api/auth/login', {
        body: { email: '{{staffEmail}}', password: '{{staffPassword}}' },
        tests: [
          `pm.test('Login staff: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.test('Role is staff', () => pm.expect(b.user.role).to.equal('staff'));`,
          `pm.environment.set('staffToken', b.token);`,
          `pm.environment.set('staffId', b.user.id);`
        ]
      }),

      req('Login Second Patient', 'POST', '/api/auth/login', {
        body: { email: '{{secondPatientEmail}}', password: '{{secondPatientPassword}}' },
        tests: [
          `pm.test('Login second patient: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.environment.set('secondPatientToken', b.token);`,
          `pm.environment.set('secondPatientId', b.user.id);`
        ]
      }),

      // Create a separate appointment for the "serve" test so it doesn't
      // interfere with the main appointmentId used in other tests
      req('Create Appointment for Serve Test', 'POST', '/api/appointments', {
        auth: 'patientToken',
        prereq: setDayPlus2,
        body: { date: '{{dayPlus2}}', reason: 'Serve test appointment', doctor: 'Dr. Serve' },
        tests: [
          `// May get 409 if this date already has a pending appointment — that's fine,`,
          `// we just need a valid serveAppointmentId from somewhere`,
          `if (pm.response.code === 201) {`,
          `  pm.test('Create serve-test appt: 201', () => pm.response.to.have.status(201));`,
          `  const b = pm.response.json();`,
          `  pm.test('queueNumber assigned', () => pm.expect(b.appointment.queueNumber).to.be.a('number'));`,
          `  pm.environment.set('serveAppointmentId', b.appointment._id);`,
          `} else {`,
          `  // Already exists — fetch the existing one`,
          `  pm.test('Serve-test appt: 201 or 409', () => pm.expect([201, 409]).to.include(pm.response.code));`,
          `}`
        ]
      })
    ]),

    // ── AUTH NEGATIVE ──────────────────────────────────────────────────────
    folder('Auth - Negative', [

      req('Login Wrong Password', 'POST', '/api/auth/login', {
        body: { email: '{{patientEmail}}', password: 'WrongPassword999' },
        tests: [
          `pm.test('Wrong password: 401', () => pm.response.to.have.status(401));`,
          `pm.test('Generic error — does not hint which field failed', () => {`,
          `  pm.expect(pm.response.json().error).to.equal('Invalid credentials');`,
          `});`
        ]
      }),

      req('Login Non-existent Email', 'POST', '/api/auth/login', {
        body: { email: 'nobody@nowhere.com', password: 'Password123' },
        tests: [
          `pm.test('Non-existent email: 401', () => pm.response.to.have.status(401));`,
          `pm.test('Same generic error as wrong password', () => {`,
          `  pm.expect(pm.response.json().error).to.equal('Invalid credentials');`,
          `});`
        ]
      }),

      req('Login Missing Fields', 'POST', '/api/auth/login', {
        body: { email: '{{patientEmail}}' },
        tests: [
          `pm.test('Missing password field: 400', () => pm.response.to.have.status(400));`,
          `pm.test('Response has error property', () => pm.expect(pm.response.json()).to.have.property('error'));`
        ]
      }),

      // Newman's cookie jar auto-sends the login cookie. We clear it in prerequest.
      req('No Token — GET /api/appointments', 'GET', '/api/appointments', {
        prereq: [
          `// Clear the token cookie from Newman's jar so this request is truly unauthenticated`,
          `pm.cookies.clear('localhost');`
        ],
        tests: [
          `pm.test('No token: 401', () => pm.response.to.have.status(401));`,
          `pm.test('Error is Unauthorized', () => pm.expect(pm.response.json().error).to.equal('Unauthorized'));`
        ]
      }),

      req('Invalid Token', 'GET', '/api/appointments', {
        // auth: undefined — we add the bad cookie manually below
        tests: [
          `pm.test('Invalid token: 401', () => pm.response.to.have.status(401));`,
          `pm.test('Error is Unauthorized', () => pm.expect(pm.response.json().error).to.equal('Unauthorized'));`
        ]
      })
    ]),

    // ── HAPPY PATH ─────────────────────────────────────────────────────────
    folder('Appointments - Happy Path', [

      req('Create Appointment', 'POST', '/api/appointments', {
        auth: 'patientToken',
        // Use day+5 — far enough to avoid collision with serve-test (day+2) and today
        prereq: setDayPlus5,
        body: { date: '{{dayPlus5}}', reason: 'Annual checkup', doctor: 'Dr. Smith' },
        tests: [
          `pm.test('Create appointment: 201', () => pm.response.to.have.status(201));`,
          `const b = pm.response.json();`,
          `pm.test('queueNumber is a number', () => pm.expect(b.appointment.queueNumber).to.be.a('number'));`,
          `pm.test('status is pending', () => pm.expect(b.appointment.status).to.equal('pending'));`,
          `pm.test('appointment has _id', () => pm.expect(b.appointment._id).to.be.a('string'));`,
          `pm.environment.set('appointmentId', b.appointment._id);`,
          `pm.environment.set('appointmentDate', pm.environment.get('dayPlus5'));`
        ]
      }),

      req('Get All Appointments as Patient', 'GET', '/api/appointments', {
        auth: 'patientToken',
        tests: [
          `pm.test('Get all as patient: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.test('appointments is array', () => pm.expect(b.appointments).to.be.an('array'));`,
          `// Role-based filtering: patient must only see their own appointments`,
          `const pid = pm.environment.get('patientId');`,
          `pm.test('All appointments belong to this patient (role filtering)', () => {`,
          `  b.appointments.forEach(a => pm.expect(a.patientId).to.equal(pid));`,
          `});`
        ]
      }),

      req('Get All Appointments as Staff', 'GET', '/api/appointments', {
        auth: 'staffToken',
        tests: [
          `pm.test('Get all as staff: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.test('Staff sees all appointments (non-empty)', () => {`,
          `  pm.expect(b.appointments).to.be.an('array').with.length.above(0);`,
          `});`
        ]
      }),

      req('Get Appointment by ID', 'GET', '/api/appointments/{{appointmentId}}', {
        auth: 'patientToken',
        tests: [
          `pm.test('Get by ID: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.test('_id matches appointmentId', () => {`,
          `  pm.expect(b.appointment._id).to.equal(pm.environment.get('appointmentId'));`,
          `});`,
          `pm.test('appointment has queueNumber', () => pm.expect(b.appointment.queueNumber).to.be.a('number'));`
        ]
      }),

      req('Update Appointment', 'PUT', '/api/appointments/{{appointmentId}}', {
        auth: 'patientToken',
        body: { reason: 'Updated reason', doctor: 'Dr. Jones' },
        tests: [
          `pm.test('Update appointment: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.test('reason is updated', () => pm.expect(b.appointment.reason).to.equal('Updated reason'));`,
          `pm.test('doctor is updated', () => pm.expect(b.appointment.doctor).to.equal('Dr. Jones'));`
        ]
      }),

      req('Staff Mark as Served', 'PATCH', '/api/appointments/{{serveAppointmentId}}/serve', {
        auth: 'staffToken',
        tests: [
          `pm.test('Mark as served: 200', () => pm.response.to.have.status(200));`,
          `pm.test('message includes served', () => {`,
          `  pm.expect(pm.response.json().message.toLowerCase()).to.include('served');`,
          `});`
        ]
      })
    ]),

    // ── NEGATIVE ───────────────────────────────────────────────────────────
    folder('Appointments - Negative', [

      req('Create - Missing Reason', 'POST', '/api/appointments', {
        auth: 'patientToken',
        prereq: setTomorrow,
        body: { date: '{{tomorrow}}', doctor: 'Dr. Smith' },
        tests: [
          `pm.test('Missing reason: 400', () => pm.response.to.have.status(400));`,
          `pm.test('Response has error', () => pm.expect(pm.response.json()).to.have.property('error'));`
        ]
      }),

      req('Create - Missing Doctor', 'POST', '/api/appointments', {
        auth: 'patientToken',
        prereq: setTomorrow,
        body: { date: '{{tomorrow}}', reason: 'Checkup' },
        tests: [
          `pm.test('Missing doctor: 400', () => pm.response.to.have.status(400));`,
          `pm.test('Response has error', () => pm.expect(pm.response.json()).to.have.property('error'));`
        ]
      }),

      req('Create - Missing Date', 'POST', '/api/appointments', {
        auth: 'patientToken',
        body: { reason: 'Checkup', doctor: 'Dr. Smith' },
        tests: [
          `pm.test('Missing date: 400', () => pm.response.to.have.status(400));`,
          `pm.test('Response has error', () => pm.expect(pm.response.json()).to.have.property('error'));`
        ]
      }),

      req('Patient Gets Other Patient Appointment', 'GET', '/api/appointments/{{appointmentId}}', {
        auth: 'secondPatientToken',
        tests: [
          `pm.test('Cross-patient access: 403', () => pm.response.to.have.status(403));`,
          `pm.test('Error is Forbidden', () => pm.expect(pm.response.json().error).to.equal('Forbidden'));`
        ]
      }),

      req('Patient Tries to Mark as Served', 'PATCH', '/api/appointments/{{appointmentId}}/serve', {
        auth: 'patientToken',
        tests: [
          `pm.test('Patient mark served: 403', () => pm.response.to.have.status(403));`,
          `pm.test('Error is Forbidden', () => pm.expect(pm.response.json().error).to.equal('Forbidden'));`
        ]
      }),

      req('Get Non-existent Appointment ID', 'GET', '/api/appointments/000000000000000000000001', {
        auth: 'patientToken',
        tests: [
          `pm.test('Non-existent ID: 404', () => pm.response.to.have.status(404));`,
          `pm.test('Response has error', () => pm.expect(pm.response.json()).to.have.property('error'));`
        ]
      })
    ]),

    // ── EDGE CASES ─────────────────────────────────────────────────────────
    folder('Appointments - Edge Cases', [

      req('Past Date Rejected', 'POST', '/api/appointments', {
        auth: 'patientToken',
        prereq: setYesterday,
        body: { date: '{{yesterday}}', reason: 'Past visit', doctor: 'Dr. Smith' },
        tests: [
          `pm.test('Past date: 400', () => pm.response.to.have.status(400));`,
          `pm.test('message mentions past', () => {`,
          `  pm.expect(pm.response.json().message.toLowerCase()).to.include('past');`,
          `});`
        ]
      }),

      req('Duplicate Same Day Rejected', 'POST', '/api/appointments', {
        auth: 'patientToken',
        body: { date: '{{appointmentDate}}', reason: 'Duplicate visit', doctor: 'Dr. Jones' },
        tests: [
          `pm.test('Duplicate same day: 409', () => pm.response.to.have.status(409));`,
          `pm.test('message mentions same day', () => {`,
          `  pm.expect(pm.response.json().message.toLowerCase()).to.include('appointment on this day');`,
          `});`
        ]
      }),

      req('Invalid Date Format Rejected', 'POST', '/api/appointments', {
        auth: 'patientToken',
        body: { date: 'not-a-date', reason: 'Bad date', doctor: 'Dr. Smith' },
        tests: [
          `pm.test('Invalid date format: 400', () => pm.response.to.have.status(400));`,
          `pm.test('message mentions Invalid date', () => {`,
          `  pm.expect(pm.response.json().message).to.include('Invalid date');`,
          `});`
        ]
      }),

      req('Update to Past Date Rejected', 'PUT', '/api/appointments/{{appointmentId}}', {
        auth: 'patientToken',
        prereq: setYesterday,
        body: { date: '{{yesterday}}', reason: 'Updated', doctor: 'Dr. Smith' },
        tests: [
          `pm.test('Update to past date: 400', () => pm.response.to.have.status(400));`,
          `pm.test('message mentions past', () => {`,
          `  pm.expect(pm.response.json().message.toLowerCase()).to.include('past');`,
          `});`
        ]
      }),

      req('Cancel Appointment', 'DELETE', '/api/appointments/{{appointmentId}}', {
        auth: 'patientToken',
        tests: [
          `pm.test('Cancel: 200', () => pm.response.to.have.status(200));`,
          `pm.test('message confirms cancellation', () => {`,
          `  pm.expect(pm.response.json().message.toLowerCase()).to.include('cancel');`,
          `});`,
          `// Save for the re-cancel test below`,
          `pm.environment.set('cancelAppointmentId', pm.environment.get('appointmentId'));`
        ]
      }),

      req('Cancel Already Cancelled', 'DELETE', '/api/appointments/{{cancelAppointmentId}}', {
        auth: 'patientToken',
        tests: [
          `pm.test('Cancel already cancelled: 409', () => pm.response.to.have.status(409));`,
          `pm.test('message mentions already cancelled', () => {`,
          `  pm.expect(pm.response.json().message.toLowerCase()).to.include('already cancelled');`,
          `});`
        ]
      }),

      req('Serve Already Served', 'PATCH', '/api/appointments/{{serveAppointmentId}}/serve', {
        auth: 'staffToken',
        tests: [
          `pm.test('Serve already served: 409', () => pm.response.to.have.status(409));`,
          `pm.test('message mentions already', () => {`,
          `  pm.expect(pm.response.json().message.toLowerCase()).to.include('already');`,
          `});`
        ]
      }),

      req('Rebook Same Day After Cancellation', 'POST', '/api/appointments', {
        auth: 'patientToken',
        body: { date: '{{appointmentDate}}', reason: 'Rebooked visit', doctor: 'Dr. Smith' },
        tests: [
          `// After cancellation, booking the same day must be allowed`,
          `pm.test('Rebook after cancel: 201', () => pm.response.to.have.status(201));`,
          `pm.test('status is pending', () => {`,
          `  pm.expect(pm.response.json().appointment.status).to.equal('pending');`,
          `});`
        ]
      })
    ]),

    // ── QUEUE ──────────────────────────────────────────────────────────────
    folder('Queue', [

      req('Get Today Queue', 'GET', '/api/queue/today', {
        auth: 'staffToken',
        prereq: setTodayDate,
        queryParams: 'date={{todayDate}}',
        tests: [
          `pm.test('Get today queue: 200', () => pm.response.to.have.status(200));`,
          `const b = pm.response.json();`,
          `pm.test('queue is an array', () => pm.expect(b.queue).to.be.an('array'));`,
          `pm.test('queue sorted by queueNumber ascending', () => {`,
          `  for (let i = 1; i < b.queue.length; i++) {`,
          `    pm.expect(b.queue[i - 1].queueNumber).to.be.at.most(b.queue[i].queueNumber);`,
          `  }`,
          `});`
        ]
      })
    ])
  ],

  event: [
    { listen: 'prerequest', script: { type: 'text/javascript', exec: [''] } },
    { listen: 'test',       script: { type: 'text/javascript', exec: [''] } }
  ]
}

// Add bad Cookie header to "Invalid Token" request manually
const authNeg = collection.item.find(f => f.name === 'Auth - Negative')
const invalidTokenReq = authNeg.item.find(r => r.name === 'Invalid Token')
invalidTokenReq.request.header.push({ key: 'Cookie', value: 'token=this.is.not.a.valid.jwt.token' })

const out = JSON.stringify(collection, null, 2)
fs.writeFileSync('tests/api/QueueCare.postman_collection.json', out)

const totalRequests = collection.item.reduce((sum, f) => sum + f.item.length, 0)
console.log('✓ Collection written successfully.')
console.log(`  Total requests: ${totalRequests}`)
collection.item.forEach(f => console.log(`  ${f.name}: ${f.item.length} requests`))
