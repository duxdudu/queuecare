// ─────────────────────────────────────────────────────────────────────────────
// QueueCare — UI Automation Suite
// File  : Frontend/tests/ui/appointments.spec.js
// Runner: Playwright (headless)
//
// Test accounts (must exist in DB before running):
//   patient@test.com  / Password123  / role: patient
//   patient2@test.com / Password123  / role: patient
//   staff@test.com    / Password123  / role: staff
//
// Run:
//   cd Frontend && npx playwright test
// ─────────────────────────────────────────────────────────────────────────────

import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Log in via the UI login form and wait for the dashboard redirect.
 * @param {import('@playwright/test').Page} page
 * @param {string} email
 * @param {string} password
 */
async function loginAs(page, email, password) {
  await page.goto('/login')
  await page.getByTestId('login-email').fill(email)
  await page.getByTestId('login-password').fill(password)
  await page.getByTestId('login-submit').click()
  // Wait for navigation away from /login
  await page.waitForURL(/\/dashboard/, { timeout: 10000 })
}

/**
 * Returns tomorrow's date as a YYYY-MM-DD string (local time).
 * @returns {string}
 */
function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

/**
 * Returns yesterday's date as a YYYY-MM-DD string (local time).
 * @returns {string}
 */
function getYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

/**
 * Returns a future date offset by `days` from today as YYYY-MM-DD.
 * @param {number} days
 * @returns {string}
 */
function getFutureDate(days) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. LOGIN FLOW
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login Flow', () => {
  test('valid credentials → redirect to dashboard with appointments list', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')

    // Must land on dashboard
    await expect(page).toHaveURL(/\/dashboard/)

    // Either the appointments list or the empty-state placeholder must be visible
    const hasList      = await page.getByTestId('appointments-list').isVisible().catch(() => false)
    const hasEmptyState = await page.getByTestId('empty-state').isVisible().catch(() => false)
    expect(hasList || hasEmptyState).toBe(true)
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

  test('empty form submission → browser validation prevents submit, stays on login page', async ({ page }) => {
    await page.goto('/login')
    await page.getByTestId('login-submit').click()

    // The email input has type="email" and is required by the browser —
    // the form will not submit and the page stays at /login.
    await expect(page).toHaveURL(/\/login/)

    // The error banner must NOT appear (no server round-trip happened)
    await expect(page.getByTestId('login-error')).not.toBeVisible()
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
    await page.getByTestId('appt-date').fill(getTomorrow())
    await page.getByTestId('appt-reason').fill('Annual checkup')
    await page.getByTestId('appt-doctor').fill('Dr. Smith')
    await page.getByTestId('appt-submit').click()

    // Success banner appears
    await expect(page.getByTestId('appt-success')).toBeVisible()

    // Then redirects to dashboard
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('new appointment appears on dashboard with queue number', async ({ page }) => {
    // Use a date far enough in the future to avoid duplicate-day conflicts
    const uniqueDate = getFutureDate(20)

    await page.getByTestId('appt-date').fill(uniqueDate)
    await page.getByTestId('appt-reason').fill('Queue number visibility test')
    await page.getByTestId('appt-doctor').fill('Dr. Queue')
    await page.getByTestId('appt-submit').click()

    await page.waitForURL(/\/dashboard/, { timeout: 10000 })

    // At least one appointment card must be visible
    const cards = page.getByTestId('appointment-card')
    await expect(cards.first()).toBeVisible()

    // At least one queue number must be visible
    const queueNum = page.getByTestId('queue-number').first()
    await expect(queueNum).toBeVisible()
    await expect(queueNum).toContainText('Queue #')
  })

  test('missing date → error shown, stays on form', async ({ page }) => {
    // Leave date empty
    await page.getByTestId('appt-reason').fill('No date test')
    await page.getByTestId('appt-doctor').fill('Dr. Smith')
    await page.getByTestId('appt-submit').click()

    await expect(page.getByTestId('appt-error')).toBeVisible()
    await expect(page).toHaveURL(/\/appointments\/new/)
  })

  test('missing reason → error shown, stays on form', async ({ page }) => {
    await page.getByTestId('appt-date').fill(getTomorrow())
    // Leave reason empty
    await page.getByTestId('appt-doctor').fill('Dr. Smith')
    await page.getByTestId('appt-submit').click()

    await expect(page.getByTestId('appt-error')).toBeVisible()
    await expect(page).toHaveURL(/\/appointments\/new/)
  })

  test('missing doctor → error shown, stays on form', async ({ page }) => {
    await page.getByTestId('appt-date').fill(getTomorrow())
    await page.getByTestId('appt-reason').fill('No doctor test')
    // Leave doctor empty
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
  /**
   * Creates a fresh appointment via the UI and returns to the dashboard.
   * Uses a date far in the future to avoid duplicate-day conflicts.
   */
  async function createAppointmentAndGoToDashboard(page, daysAhead = 30) {
    await page.goto('/appointments/new')
    await page.getByTestId('appt-date').fill(getFutureDate(daysAhead))
    await page.getByTestId('appt-reason').fill('Cancel flow test')
    await page.getByTestId('appt-doctor').fill('Dr. Cancel')
    await page.getByTestId('appt-submit').click()
    await page.waitForURL(/\/dashboard/, { timeout: 10000 })
  }

  test('cancel a pending appointment → status changes to cancelled, card stays visible', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')
    await createAppointmentAndGoToDashboard(page, 35)

    // Find the first pending cancel button and click it
    // The cancel button is disabled when status !== pending, so we target the enabled one
    const cancelBtn = page.getByTestId('cancel-btn').filter({ hasNot: page.locator('[disabled]') }).first()
    await expect(cancelBtn).toBeVisible()

    // Intercept the confirm dialog
    page.once('dialog', dialog => dialog.accept())
    await cancelBtn.click()

    // The card must still be visible (not removed from DOM)
    await expect(page.getByTestId('appointment-card').first()).toBeVisible()

    // The status badge on that card must now read "cancelled"
    // We look for any badge with text "cancelled"
    await expect(
      page.getByTestId('appointment-status').filter({ hasText: 'cancelled' }).first()
    ).toBeVisible()
  })

  test('cancel button is disabled on already-cancelled appointments', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')
    await page.goto('/dashboard')

    // Find a card whose status badge says "cancelled"
    const cancelledCard = page.getByTestId('appointment-card').filter({
      has: page.getByTestId('appointment-status').filter({ hasText: 'cancelled' })
    }).first()

    // If there's a cancelled card, its cancel button must be disabled
    const count = await cancelledCard.count()
    if (count > 0) {
      const disabledCancelBtn = cancelledCard.getByTestId('cancel-btn')
      await expect(disabledCancelBtn).toBeDisabled()
    } else {
      // No cancelled appointments yet — test is vacuously passing
      test.info().annotations.push({ type: 'skip-reason', description: 'No cancelled appointments in DB yet' })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. DASHBOARD — ROLE-BASED VIEWS
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Dashboard — Role-Based Views', () => {
  test('patient dashboard shows "My Appointments" and create button', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')

    // The Layout title for patients is "My Appointments"
    await expect(page.getByRole('heading', { name: 'My Appointments' })).toBeVisible()

    // Create appointment button must be present (either in header or empty-state)
    const createBtn = page.getByTestId('create-appointment-btn')
    await expect(createBtn.first()).toBeVisible()
  })

  test('staff dashboard shows "All Appointments" heading', async ({ page }) => {
    await loginAs(page, 'staff@test.com', 'Password123')

    await expect(page.getByRole('heading', { name: 'All Appointments' })).toBeVisible()
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
  test('clicking View on a card navigates to detail page with correct data', async ({ page }) => {
    await loginAs(page, 'patient@test.com', 'Password123')

    // Make sure there is at least one appointment
    const hasList = await page.getByTestId('appointments-list').isVisible().catch(() => false)
    if (!hasList) {
      // Create one first
      await page.goto('/appointments/new')
      await page.getByTestId('appt-date').fill(getFutureDate(40))
      await page.getByTestId('appt-reason').fill('Detail view test')
      await page.getByTestId('appt-doctor').fill('Dr. Detail')
      await page.getByTestId('appt-submit').click()
      await page.waitForURL(/\/dashboard/, { timeout: 10000 })
    }

    // Click the first "View" link
    await page.getByRole('link', { name: 'View' }).first().click()
    await expect(page).toHaveURL(/\/appointments\/[a-f0-9]{24}/)

    // Queue number and status must be visible on the detail page
    await expect(page.getByText(/Queue #\d+/)).toBeVisible()
  })
})
