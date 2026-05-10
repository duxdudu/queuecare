const express = require('express');
const Appointment = require('../models/Appointment');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');

const router = express.Router();

// Helper: parse a YYYY-MM-DD string as UTC midnight.
// Using Date.UTC ensures the stored value is always exactly midnight UTC
// regardless of the server's local timezone, so creation and queue queries
// always agree on which calendar day an appointment belongs to.
function parseUTCDate(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

// Helper function to strip time from date and compare date only (UTC)
function isSameDay(date1, date2) {
  return date1.getUTCFullYear() === date2.getUTCFullYear() &&
         date1.getUTCMonth()    === date2.getUTCMonth()    &&
         date1.getUTCDate()     === date2.getUTCDate();
}

// Helper function to check if date is in the past (UTC date comparison)
function isDateInPast(dateString) {
  const inputDate = parseUTCDate(dateString);
  // Today at UTC midnight
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return inputDate < todayUTC;
}

// POST /api/appointments
router.post('/', authenticate, async (req, res) => {
  try {
    // Check role is patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { date, reason, doctor } = req.body;

    // Validate required fields
    if (!date || !reason || !doctor) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Parse date as UTC midnight — consistent with how the queue queries dates
    const appointmentDate = parseUTCDate(date);
    if (isNaN(appointmentDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    // Check if date is in the past (compare UTC dates only)
    if (isDateInPast(date)) {
      return res.status(400).json({ message: 'Appointment date cannot be in the past' });
    }

    // Check for existing pending appointment on the same calendar day
    const existingAppointments = await Appointment.find({
      patientId: req.user.id,
      status: 'pending'
    });

    for (const appt of existingAppointments) {
      if (isSameDay(new Date(appt.date), appointmentDate)) {
        return res.status(409).json({ message: 'You already have an appointment on this day' });
      }
    }

    // Count all appointments on the same UTC calendar day to assign queue number
    const y = appointmentDate.getUTCFullYear();
    const mo = appointmentDate.getUTCMonth();
    const d = appointmentDate.getUTCDate();
    const startOfDay = new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
    const endOfDay   = new Date(Date.UTC(y, mo, d, 23, 59, 59, 999));

    const appointmentsOnDay = await Appointment.countDocuments({
      date: { $gte: startOfDay, $lte: endOfDay }
    });

    const queueNumber = appointmentsOnDay + 1;

    // Create appointment
    const appointment = await Appointment.create({
      patientId: req.user.id,
      date: appointmentDate,
      reason,
      doctor,
      queueNumber
    });

    res.status(201).json({
      message: 'Appointment created',
      appointment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/appointments
router.get('/', authenticate, async (req, res) => {
  try {
    let appointments;

    if (req.user.role === 'patient') {
      // Patient: return only their own appointments
      appointments = await Appointment.find({ patientId: req.user.id });
    } else {
      // Staff: return all appointments
      appointments = await Appointment.find();
    }

    res.status(200).json({ appointments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/appointments/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check access: patient can only view their own
    if (req.user.role === 'patient' && appointment.patientId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.status(200).json({ appointment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/appointments/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    // Check role is patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check ownership
    if (appointment.patientId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check if cancelled
    if (appointment.status === 'cancelled') {
      return res.status(409).json({ message: 'Cannot update a cancelled appointment' });
    }

    const { date, reason, doctor } = req.body;

    // Validate and update date if provided
    if (date) {
      const newDate = parseUTCDate(date);
      if (isNaN(newDate.getTime())) {
        return res.status(400).json({ message: 'Invalid date format' });
      }
      if (isDateInPast(date)) {
        return res.status(400).json({ message: 'Appointment date cannot be in the past' });
      }
      appointment.date = newDate;
    }

    // Update other fields if provided
    if (reason) appointment.reason = reason;
    if (doctor) appointment.doctor = doctor;

    await appointment.save();

    res.status(200).json({
      message: 'Appointment updated',
      appointment
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/appointments/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    // Check role is patient
    if (req.user.role !== 'patient') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check ownership
    if (appointment.patientId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // Check if already cancelled
    if (appointment.status === 'cancelled') {
      return res.status(409).json({ message: 'Appointment is already cancelled' });
    }

    // Set status to cancelled
    appointment.status = 'cancelled';
    await appointment.save();

    res.status(200).json({ message: 'Appointment cancelled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/appointments/:id/serve
router.patch('/:id/serve', ...requireRole('staff'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Check if already served
    if (appointment.status === 'served') {
      return res.status(409).json({ message: 'Patient is already marked as served' });
    }

    // Check if cancelled
    if (appointment.status === 'cancelled') {
      return res.status(409).json({ message: 'Cannot serve a cancelled appointment' });
    }

    // Set status to served
    appointment.status = 'served';
    await appointment.save();

    res.status(200).json({ message: 'Patient marked as served' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
