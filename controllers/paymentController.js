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
      'SELECT * FROM vouchers WHERE plan_key = ? AND status = "unused" LIMIT 1',
      [planKey]
    );

    if (vouchers.length === 0) {
      return res.status(503).json({ error: 'No vouchers available. Contact support.' });
    }

    const voucher = vouchers[0];

    await db.query(
      'UPDATE vouchers SET status="used", payment_reference=?, used_at=NOW() WHERE id=?',
      [ref, voucher.id]
    );

    await db.query(
      `INSERT INTO payments (reference, amount, plan_key, status, voucher_code)
       VALUES (?, ?, ?, 'success', ?)`,
      [ref, amountPaid, planKey, voucher.code]
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
    1500: 'weekly',
    5000: 'monthly'
  };
  return map[amount] || null;
}