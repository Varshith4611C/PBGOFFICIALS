const express = require('express');
const axios = require('axios');
const router = express.Router();

// ── PBG Officials Contact Form Endpoint (Rate Limited) ──
const contactRateLimits = new Map();

// Periodically clean up entries older than 1 minute every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamp] of contactRateLimits.entries()) {
    if (now - timestamp > 60000) contactRateLimits.delete(ip);
  }
}, 5 * 60 * 1000).unref();

router.post('/', async (req, res) => {
  const ip = req.ip || req.connection?.remoteAddress || 'unknown';
  const now = Date.now();
  const lastRequest = contactRateLimits.get(ip) || 0;

  if (now - lastRequest < 15000) {
    return res.status(429).json({ error: 'Please wait a moment before sending another message.' });
  }

  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Invalid email address.' });
  }

  contactRateLimits.set(ip, now);

  try {
    const response = await axios.post('https://formsubmit.co/ajax/support@pbgofficials.dev', {
      name: String(name).slice(0, 100),
      email: String(email).slice(0, 100),
      _replyto: String(email).slice(0, 100),
      _subject: subject ? `[PBG Officials] ${String(subject).slice(0, 150)}` : `New Message from ${String(name).slice(0, 100)}`,
      message: String(message).slice(0, 5000),
      _template: 'table',
      _captcha: 'false',
    }, { timeout: 10000 });

    if (response.data?.success === 'true' || response.data?.success === true || response.status === 200) {
      return res.json({ success: true, message: 'Message successfully delivered to PBG Support.' });
    }
    return res.json({ success: true, message: 'Message received.' });
  } catch (err) {
    console.error('Contact submission error:', err.message);
    return res.status(500).json({ error: 'Failed to deliver message. Please contact support@pbgofficials.dev directly.' });
  }
});

module.exports = router;
