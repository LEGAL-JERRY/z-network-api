const axios = require('axios');
const db = require('../db');

exports.handleSuccess = async (req, res) => {
  const { ref } = req.query;

  if (!ref) {
    return res.status(400).json({ error: 'No payment reference provided' });
  }

  try {
    const [existing] = await db.query(
      'SELECT * FROM payments WHERE reference = ?', [ref]
    );

    if (existing.length > 0) {
      return res.json({
        status: 'success',
        voucher: existing[0].voucher_code,
        plan: existing[0].plan_key,
        reference: ref
      });
    }

    const paystackRes = await axios.get(
      `https://api.paystack.co/transaction/verify/${ref}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` } }
    );

    const payment = paystackRes.data.data;

    if (payment.status !== 'success') {
      return res.status(400).json({ error: 'Payment not successful' });
    }

    const amountPaid = payment.amount / 100;
    const planKey = getPlanFromAmount(amountPaid);

    if (!planKey) {
      return res.status(400).json({ error: 'Unknown amount: ' + amountPaid });
    }

    const [vouchers] = await db.query(
    "SELECT * FROM vouchers WHERE plan_key = ? AND status = 'unused' LIMIT 1",
      [planKey]
    );

    if (vouchers.length === 0) {
      return res.status(503).json({ error: 'No vouchers available. Contact support.' });
    }

    const voucher = vouchers[0];

  await db.query(
  "UPDATE vouchers SET status='used', payment_reference=?, used_at=NOW() WHERE id=?",
  [ref, voucher.id]
);

 const expiresAt = getExpiryDate(planKey);
 const expiresAtStr = expiresAt.toISOString().slice(0, 19).replace('T', ' ');

await db.query(
  "UPDATE vouchers SET status='used', payment_reference=?, used_at=NOW() WHERE id=?",
  [ref, voucher.id]
);

    return res.json({
      status: 'success',
      voucher: voucher.code,
      plan: planKey,
      amount: amountPaid,
      reference: ref
    });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
};

exports.verifyPayment = async (req, res) => {
  res.json({ message: 'verify endpoint working' });
};

function getPlanFromAmount(amount) {
  const map = {
    350:  'daily',
    500:  'twoday',
    1000: 'halfweek',
    2000: 'weekly',
    6000: 'monthly'
  };
  return map[amount] || null;
}
function getExpiryDate(planKey) {
  const now = new Date();
  const days = {
    'daily':    1,
    'twoday':   2,
    'halfweek': 3.5,
    'weekly':   7,
    'monthly':  30
  };
  const planDays = days[planKey] || 1;
  now.setTime(now.getTime() + planDays * 24 * 60 * 60 * 1000);
  return now;
}

exports.checkExpiry = async (req, res) => {
  const { voucher } = req.query;

  if (!voucher) {
    return res.json({ valid: false, reason: 'no_voucher' });
  }

  try {
    const [rows] = await db.query(
      "SELECT expires_at FROM payments WHERE voucher_code = ? AND status = 'success'",
      [voucher]
    );

    if (rows.length === 0) {
      return res.json({ valid: false, reason: 'not_found' });
    }

    const expiresAt = new Date(rows[0].expires_at);
    const now = new Date();

    if (now > expiresAt) {
      return res.json({ valid: false, reason: 'expired' });
    }

    const remainingMs = expiresAt - now;
    const remainingHours = Math.floor(remainingMs / 3600000);
    const remainingMins = Math.floor((remainingMs % 3600000) / 60000);

    return res.json({
      valid: true,
      expires_at: expiresAt,
      remaining_hours: remainingHours,
      remaining_minutes: remainingMins
    });

  } catch (err) {
    console.error('checkExpiry FULL ERROR:', err.message, err.stack);
    return res.status(500).json({ valid: false, reason: 'server_error', error: err.message });
  }
};