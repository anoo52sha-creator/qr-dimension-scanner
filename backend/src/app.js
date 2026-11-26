const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const db = require('./db/pool');
const scansRouter = require('./routes/scans');

const app = express();

app.use(helmet());

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '2mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

/**
 * GET /api/health
 * Verifies backend availability and PostgreSQL connectivity.
 */
app.get('/api/health', async (_req, res) => {
  try {
    const result = await db.query('SELECT NOW() AS db_time');
    return res.json({
      status: 'ok',
      backend: 'connected',
      database: 'connected',
      timestamp: new Date().toISOString(),
      dbTime: result.rows[0]?.db_time,
    });
  } catch (err) {
    return res.status(503).json({
      status: 'error',
      backend: 'connected',
      database: 'disconnected',
      error: err.message,
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/stats
 * Returns total saved records and the latest scanned record.
 */
app.get('/api/stats', async (_req, res, next) => {
  try {
    const countRes = await db.query('SELECT COUNT(*)::int AS total FROM qr_scan_records');
    const latestRes = await db.query(
      `SELECT id, qr_raw_data, qr_parsed_data, qr_format, scanned_at, device_info, created_at
       FROM qr_scan_records
       ORDER BY scanned_at DESC, id DESC
       LIMIT 1`
    );

    return res.json({
      totalRecords: countRes.rows[0]?.total || 0,
      latestScan: latestRes.rows[0] || null,
    });
  } catch (err) {
    return next(err);
  }
});

app.use('/api/scans', scansRouter);

app.get('/', (_req, res) => {
  res.json({
    service: 'QR Dimension Scanner API',
    status: 'running',
    endpoints: ['/api/health', '/api/stats', '/api/scans', '/api/scans/search', '/api/scans/:id'],
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found.' });
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error('[API Error]', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error.' : err.message,
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
