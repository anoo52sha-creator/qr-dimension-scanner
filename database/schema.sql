-- QR Dimension Scanner - PostgreSQL Database Schema
-- Database: qr_dimensions_db
-- Supports arbitrary, dynamic JSON payloads without predefined dimension columns.

CREATE TABLE IF NOT EXISTS qr_scan_records (
    id BIGSERIAL PRIMARY KEY,
    qr_raw_data TEXT NOT NULL,
    qr_parsed_data JSONB NOT NULL,
    qr_format VARCHAR(20) DEFAULT 'JSON',
    scanned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    device_info JSONB,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for chronological queries and sorting
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_scanned_at
    ON qr_scan_records (scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scan_records_created_at
    ON qr_scan_records (created_at DESC);

-- GIN index for fast dynamic JSONB property/value queries
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_parsed_data_gin
    ON qr_scan_records USING GIN (qr_parsed_data);

-- Functional index for exact duplicate payload detection (MD5 hash of raw text)
CREATE INDEX IF NOT EXISTS idx_qr_scan_records_raw_hash
    ON qr_scan_records (MD5(qr_raw_data));
