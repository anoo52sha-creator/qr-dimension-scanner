const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString && process.env.NODE_ENV !== 'test') {
  console.warn(
    '[DB] Warning: DATABASE_URL is not set. Database queries will fail until DATABASE_URL is configured.'
  );
}

const useSsl =
  process.env.DATABASE_SSL === 'true' ||
  (connectionString && connectionString.includes('sslmode=require')) ||
  process.env.NODE_ENV === 'production';

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected idle client error:', err.message);
});

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS qr_scan_records (
    id BIGSERIAL PRIMARY KEY,
    qr_raw_data TEXT NOT NULL,
    qr_parsed_data JSONB NOT NULL,
    qr_format VARCHAR(20) DEFAULT 'JSON',
    scanned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    device_info JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_records_scanned_at
    ON qr_scan_records (scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scan_records_created_at
    ON qr_scan_records (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scan_records_parsed_data_gin
    ON qr_scan_records USING GIN (qr_parsed_data);

CREATE INDEX IF NOT EXISTS idx_qr_scan_records_raw_hash
    ON qr_scan_records (MD5(qr_raw_data));
`;

async function ensureSchema() {
  if (!connectionString) return;
  await pool.query(SCHEMA_SQL);
}

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params),
  ensureSchema,
};
