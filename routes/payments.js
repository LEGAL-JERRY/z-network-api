const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/paymentController');

// GET /api/success?ref=xxx   (called by your success.html)
router.get('/success', ctrl.handleSuccess);

// POST /api/verify-payment   (optional direct verify)
router.post('/verify-payment', ctrl.verifyPayment);

module.exports = router;
router.get('/check-expiry', ctrl.checkExpiry);