const express = require('express');
const Appointment = require('../models/Appointment');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// GET /api/queue/today
// Accepts optional ?date=YYYY-MM-DD so the client can pass its local date.
// Falls back to the server's UTC date if not provided.
router.get('/today', authenticate, async (req, res) => {
  try {
    let dateStr = req.query.date;

    let y, m, d;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      // Use the client-supplied local date
      [y, m, d] = dateStr.split('-').map(Number);
      m = m - 1; // month is 0-indexed for Date.UTC
    } else {
      // Fallback: server UTC date
      const now = new Date();
      y = now.getUTCFullYear();
      m = now.getUTCMonth();
      d = now.getUTCDate();
    }

    // Dates are stored as UTC midnight, so query the full UTC day
    const startOfDay = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
    const endOfDay   = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));

    const queue = await Appointment.find({
      date: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ queueNumber: 1 });

    res.status(200).json({ queue });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
