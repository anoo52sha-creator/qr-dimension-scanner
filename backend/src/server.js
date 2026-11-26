require('dotenv').config();

const app = require('./app');
const { ensureSchema } = require('./db/pool');

const PORT = Number.parseInt(process.env.PORT, 10) || 5000;

async function start() {
  try {
    await ensureSchema();
    console.log('[DB] Schema verified.');
  } catch (err) {
    console.error('[DB] Schema initialization warning:', err.message);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] QR Dimension Scanner API listening on port ${PORT}`);
  });
}

start();
