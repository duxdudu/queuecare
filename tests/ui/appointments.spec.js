// ─────────────────────────────────────────────────────────────────────────────
// QueueCare — UI Automation Suite
// File  : tests/ui/appointments.spec.js
// Runner: Playwright (headless Chromium)
//
// Test accounts (must exist in DB before running):
//   patient@test.com  / Password123  / role: patient
//   patient2@test.com / Password123  / role: patient
//   staff@test.com    / Password123  / role: staff
//
// Run from project root:
//   npx playwright test
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

async function loginAs(page, email, password) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}

function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

function getFutureDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOGIN FLOW
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login Flow', () => {
  test('valid credentials → redirect to dashboard', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')
    await expect(page).toHaveURL(/\/dashboard/)

    // Wait for the dashboard to finish loading — either list or empty state must appear
    await expect(
      page.locator('[data-testid="appointments-list"], [data-testid="empty-state"]').first()
    ).toBeVisible({ timeout: 10000 })
  })

  test('wrong password → error message visible, stays on login page', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill('patient@test.com')
    await page.getByTestId('login-password').fill('WrongPassword999')
    await page.getByTestId('login-submit').click()

    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('non-existent email → error message visible, stays on login page', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-email').fill('nobody@doesnotexist.com')
    await page.getByTestId('login-password').fill('Password123')
    await page.getByTestId('login-submit').click()

    await expect(page.getByTestId('login-error')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })

  test('empty form submission → stays on login page', async ({ page }) => {
    // NOTE: The login form has no required attributes on its inputs, so the
    // browser does NOT block submission. The form submits with empty fields,
    // the API returns 400, and the error banner appears.
    // This is a known UI bug — documented in TEST_REPORT.md.
    await page.goto('/login')
    await page.getByTestId('login-submit').click()

    // Page stays on /login regardless of whether browser or server blocked it
    await expect(page).toHaveURL(/\/login/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. CREATE APPOINTMENT
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Create Appointment', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')
    await page.goto('/appointments/new')
  })

  test('valid submission → success message shown, then redirects to dashboard', async ({ page }) => {
    // Large offset: 300-800 days out, avoids duplicate-day conflicts on re-runs
    const offset = 300 + (Math.floor(Date.now() / 1000) % 500)
    await page.getByTestId('appt-date').fill(getFutureDate(offset))
    await page.getByTestId('appt-reason').fill('Annual checkup')
    await page.getByTestId('appt-doctor').fill('Dr. Smith')
    await page.getByTestId('appt-submit').click()

    await expect(page.getByTestId('appt-success')).toBeVisible({ timeout: 8000 })
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('new appointment appears on dashboard with queue number', async ({ page }) => {
    const offset = 600 + (Math.floor(Date.now() / 1000) % 300)
    const uniqueDate = getFutureDate(offset)

    await page.getByTestId('appt-date').fill(uniqueDate)
    await page.getByTestId('appt-reason').fill('Queue number visibility test')
    await page.getByTestId('appt-doctor').fill('Dr. Queue')
    await page.getByTestId('appt-submit').click()

    await page.waitForURL(/\/dashboard/, { timeout: 10000 })

    const cards = page.getByTestId('appointment-card')
    await expect(cards.first()).toBeVisible()

    const queueNum = page.getByTestId('queue-number').first()
    await expect(queueNum).toBeVisible()
    await expect(queueNum).toContainText('Queue #')
  })

  test('missing date → error shown, stays on form', async ({ page }) => {
    await page.getByTestId('appt-reason').fill('No date test')
    await page.getByTestId('appt-doctor').fill('Dr. Smith')
    await page.getByTestId('appt-submit').click()

    await expect(page.getByTestId('appt-error')).toBeVisible()
    await expect(page).toHaveURL(/\/appointments\/new/)
  })

  test('missing reason → error shown, stays on form', async ({ page }) => {
    await page.getByTestId('appt-date').fill(getTomorrow())
    await page.getByTestId('appt-doctor').fill('Dr. Smith')
    await page.getByTestId('appt-submit').click()

    await expect(page.getByTestId('appt-error')).toBeVisible()
    await expect(page).toHaveURL(/\/appointments\/new/)
  })

  test('missing doctor → error shown, stays on form', async ({ page }) => {
    await page.getByTestId('appt-date').fill(getTomorrow())
    await page.getByTestId('appt-reason').fill('No doctor test')
    await page.getByTestId('appt-submit').click()

    await expect(page.getByTestId('appt-error')).toBeVisible()
    await expect(page).toHaveURL(/\/appointments\/new/)
  })

  test('past date → error shown, stays on form', async ({ page }) => {
    await page.getByTestId('appt-date').fill(getYesterday())
    await page.getByTestId('appt-reason').fill('Past date test')
    await page.getByTestId('appt-doctor').fill('Dr. Smith')
    await page.getByTestId('appt-submit').click()

    await expect(page.getByTestId('appt-error')).toBeVisible()
    await expect(page).toHaveURL(/\/appointments\/new/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. CANCEL APPOINTMENT
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Cancel Appointment', () => {
  async function createFreshAppointment(page) {
    await page.goto('/appointments/new')
    // Large offset: 300-800 days out, avoids duplicate-day conflicts on re-runs
    const offset = 300 + (Math.floor(Date.now() / 1000) % 500)
    const dateStr = getFutureDate(offset)
    await page.getByTestId('appt-date').fill(dateStr)
    await page.getByTestId('appt-reason').fill('Cancel flow test')
    await page.getByTestId('appt-doctor').fill('Dr. Cancel')
    await page.getByTestId('appt-submit').click()
    // Wait for success banner — confirms the API call succeeded
    await expect(page.getByTestId('appt-success')).toBeVisible({ timeout: 8000 })
    // Then wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    return dateStr
  }

  test('cancel a pending appointment → status changes to cancelled', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')
    await createFreshAppointment(page)

    // Wait for the appointments list to fully render
    await expect(page.getByTestId('appointments-list')).toBeVisible({ timeout: 8000 })

    // Count all cards, find the index of the first pending one
    const allCards = page.getByTestId('appointment-card')
    await expect(allCards.first()).toBeVisible({ timeout: 5000 })

    const cardCount = await allCards.count()
    let pendingIdx = -1
    for (let i = 0; i < cardCount; i++) {
      const statusText = await allCards.nth(i).getByTestId('appointment-status').textContent()
      if (statusText === 'pending') { pendingIdx = i; break }
    }
    expect(pendingIdx).toBeGreaterThanOrEqual(0)

    // Click cancel on that specific card by index — nth() is stable by position
    page.once('dialog', dialog => dialog.accept())
    await allCards.nth(pendingIdx).getByTestId('cancel-btn').click()

    // That same nth card's status must now be "cancelled"
    await expect(
      allCards.nth(pendingIdx).getByTestId('appointment-status')
    ).toHaveText('cancelled', { timeout: 8000 })
  })

  test('cancel button is disabled on already-cancelled appointments', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')
    await page.goto('/dashboard')

    const cancelledCard = page.getByTestId('appointment-card').filter({
      has: page.getByTestId('appointment-status').filter({ hasText: 'cancelled' })
    }).first()

    const count = await cancelledCard.count()
    if (count > 0) {
      await expect(cancelledCard.getByTestId('cancel-btn')).toBeDisabled()
    } else {
      test.info().annotations.push({ type: 'skip-reason', description: 'No cancelled appointments in DB' })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. DASHBOARD — ROLE-BASED VIEWS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard — Role-Based Views', () => {
  test('patient dashboard shows "My Appointments" title and create button', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')

    // Layout renders the title in a <span class="top-header-title">, not an <h1>
    await expect(page.locator('.top-header-title')).toHaveText('My Appointments')

    // Create appointment button in sidebar nav
    await expect(page.getByTestId('create-appointment-btn').first()).toBeVisible()
  })

  test('staff dashboard shows "All Appointments" title', async ({ page }) => {
    await loginAs(page, 'staff@test.com', 'Password123')

    await expect(page.locator('.top-header-title')).toHaveText('All Appointments')
  })

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. APPOINTMENT DETAIL
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Appointment Detail', () => {
  test('clicking View on a card navigates to detail page with queue number', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')

    // Dashboard already has appointments from previous tests — just wait for them
    await expect(
      page.locator('[data-testid="appointments-list"], [data-testid="empty-state"]').first()
    ).toBeVisible({ timeout: 10000 })

    // If somehow empty, create one
    const hasEmpty = await page.getByTestId('empty-state').isVisible().catch(() => false)
    if (hasEmpty) {
      await page.goto('/appointments/new')
      const offset = 400 + (Math.floor(Date.now() / 1000) % 300)
      await page.getByTestId('appt-date').fill(getFutureDate(offset))
      await page.getByTestId('appt-reason').fill('Detail view test')
      await page.getByTestId('appt-doctor').fill('Dr. Detail')
      await page.getByTestId('appt-submit').click()
      await page.waitForURL(/\/dashboard/, { timeout: 15000 })
    }

    await page.getByRole('link', { name: 'View' }).first().click()
    await expect(page).toHaveURL(/\/appointments\/[a-f0-9]{24}/)
    await expect(page.getByText(/Queue #\d+/)).toBeVisible()
  })
})
