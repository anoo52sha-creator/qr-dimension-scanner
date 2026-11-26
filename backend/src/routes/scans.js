const express = require('express');
const db = require('../db/pool');
const { validateJsonPayload } = require('../utils/jsonValidator');

const router = express.Router();

function parsePagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildDateFilters(query, params) {
  const conditions = [];
  if (query.from) {
    const fromDate = new Date(query.from);
    if (!Number.isNaN(fromDate.getTime())) {
      params.push(fromDate.toISOString());
      conditions.push(`scanned_at >= $${params.length}`);
    }
  }
  if (query.to) {
    const toDate = new Date(query.to);
    if (!Number.isNaN(toDate.getTime())) {
      // Include full end day if date-only string (YYYY-MM-DD) is supplied
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(query.to).trim())) {
        toDate.setUTCHours(23, 59, 59, 999);
      }
      params.push(toDate.toISOString());
      conditions.push(`scanned_at <= $${params.length}`);
    }
  }
  return conditions;
}

/**
 * POST /api/scans/check-duplicate
 * Checks whether an identical JSON payload already exists in the database.
 */
router.post('/check-duplicate', async (req, res, next) => {
  try {
    const validation = validateJsonPayload(req.body?.qr_raw_data);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const result = await db.query(
      `SELECT id, scanned_at, created_at
       FROM qr_scan_records
       WHERE (MD5(qr_raw_data) = MD5($1) AND qr_raw_data = $1)
          OR qr_parsed_data = $2::jsonb
       ORDER BY scanned_at DESC
       LIMIT 1`,
      [validation.raw, validation.jsonbText]
    );

    const countRes = await db.query(
      `SELECT COUNT(*)::int AS count
       FROM qr_scan_records
       WHERE (MD5(qr_raw_data) = MD5($1) AND qr_raw_data = $1)
          OR qr_parsed_data = $2::jsonb`,
      [validation.raw, validation.jsonbText]
    );

    const existingCount = countRes.rows[0]?.count || 0;
    return res.json({
      isDuplicate: existingCount > 0,
      existingCount,
      latestMatch: result.rows[0] || null,
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * POST /api/scans
 * Validates and persists a scanned QR JSON payload into PostgreSQL.
 */
router.post('/', async (req, res, next) => {
  try {
    const { qr_raw_data, qr_format = 'JSON', scanned_at, device_info, allow_duplicate = false } =
      req.body || {};

    const validation = validateJsonPayload(qr_raw_data);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    if (typeof qr_format !== 'string' || qr_format.length > 20) {
      return res.status(400).json({ error: 'qr_format must be a string up to 20 characters.' });
    }

    let parsedScannedAt = null;
    if (scanned_at) {
      const dt = new Date(scanned_at);
      if (Number.isNaN(dt.getTime())) {
        return res.status(400).json({ error: 'scanned_at must be a valid ISO timestamp.' });
      }
      parsedScannedAt = dt.toISOString();
    }

    const deviceInfoJson =
      device_info !== undefined && device_info !== null ? JSON.stringify(device_info) : null;

    if (!allow_duplicate) {
      const dupRes = await db.query(
        `SELECT id, scanned_at
         FROM qr_scan_records
         WHERE (MD5(qr_raw_data) = MD5($1) AND qr_raw_data = $1)
            OR qr_parsed_data = $2::jsonb
         ORDER BY scanned_at DESC
         LIMIT 1`,
        [validation.raw, validation.jsonbText]
      );

      if (dupRes.rows.length > 0) {
        return res.status(409).json({
          error: 'An identical QR JSON payload already exists in the database.',
          code: 'DUPLICATE_QR',
          latestMatch: dupRes.rows[0],
        });
      }
    }

    const insertSql = `
      INSERT INTO qr_scan_records (
        qr_raw_data,
        qr_parsed_data,
        qr_format,
        scanned_at,
        device_info
      )
      VALUES ($1, $2::jsonb, $3, COALESCE($4::timestamptz, CURRENT_TIMESTAMP), $5::jsonb)
      RETURNING id, qr_raw_data, qr_parsed_data, qr_format, scanned_at, device_info, created_at
    `;

    const result = await db.query(insertSql, [
      validation.raw,
      validation.jsonbText,
      qr_format.trim() || 'JSON',
      parsedScannedAt,
      deviceInfoJson,
    ]);

    return res.status(201).json({
      message: 'Scan record saved to PostgreSQL successfully.',
      record: result.rows[0],
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/scans/search
 * Dynamically searches across any JSON property name or value, plus optional date range.
 */
router.get('/search', async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const params = [];
    const conditions = [];

    if (q) {
      params.push(`%${q}%`);
      conditions.push(`(qr_raw_data ILIKE $${params.length} OR qr_parsed_data::text ILIKE $${params.length})`);
    }

    conditions.push(...buildDateFilters(req.query, params));

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM qr_scan_records ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT id, qr_raw_data, qr_parsed_data, qr_format, scanned_at, device_info, created_at
       FROM qr_scan_records
       ${whereClause}
       ORDER BY scanned_at DESC, id DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return res.json({
      data: dataResult.rows,
      query: q,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/scans
 * Retrieves paginated scan records sorted newest first, with optional date filtering.
 */
router.get('/', async (req, res, next) => {
  try {
    const { page, limit, offset } = parsePagination(req.query);
    const params = [];
    const conditions = buildDateFilters(req.query, params);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM qr_scan_records ${whereClause}`,
      params
    );
    const total = countResult.rows[0]?.total || 0;

    const dataParams = [...params, limit, offset];
    const dataResult = await db.query(
      `SELECT id, qr_raw_data, qr_parsed_data, qr_format, scanned_at, device_info, created_at
       FROM qr_scan_records
       ${whereClause}
       ORDER BY scanned_at DESC, id DESC
       LIMIT $${dataParams.length - 1} OFFSET $${dataParams.length}`,
      dataParams
    );

    return res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err) {
    return next(err);
  }
});

/**
 * GET /api/scans/:id
 * Retrieves a single scan record by ID.
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0 || String(id) !== String(req.params.id)) {
      return res.status(400).json({ error: 'Record ID must be a positive integer.' });
    }

    const result = await db.query(
      `SELECT id, qr_raw_data, qr_parsed_data, qr_format, scanned_at, device_info, created_at
       FROM qr_scan_records
       WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: `Scan record ${id} not found.` });
    }

    return res.json({ record: result.rows[0] });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
