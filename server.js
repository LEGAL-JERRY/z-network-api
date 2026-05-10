require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Import routes (we'll create these next)
const paymentRoutes = require('./routes/payments');
app.use('/api', paymentRoutes);

// Health check — visit this to confirm server is running
app.get('/', (req, res) => {
  res.json({ status: 'Z-Network API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server running on port ' + PORT);
});
const db = require('./db');

db.query('SELECT 1')
  .then(() => console.log('✅ Database connected successfully!'))
  .catch(err => console.log('❌ Database connection failed:', err.message));