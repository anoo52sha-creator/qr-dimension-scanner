const { describe, it, beforeEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

process.env.NODE_ENV = 'test';

const db = require('../src/db/pool');
const app = require('../src/app');

describe('QR Dimension Scanner API', () => {
  let records = [];
  let nextId = 1;

  beforeEach(() => {
    records = [];
    nextId = 1;

    mock.method(db, 'query', async (sql, params = []) => {
      const normalized = sql.replace(/\s+/g, ' ').trim();

      if (normalized.startsWith('SELECT NOW()')) {
        return { rows: [{ db_time: new Date().toISOString() }] };
      }

      if (normalized.includes('SELECT COUNT(*)::int AS total FROM qr_scan_records')) {
        let filtered = [...records];
        if (normalized.includes('ILIKE')) {
          const term = String(params[0] || '').replace(/%/g, '').toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.qr_raw_data.toLowerCase().includes(term) ||
              JSON.stringify(r.qr_parsed_data).toLowerCase().includes(term)
          );
        }
        return { rows: [{ total: filtered.length }] };
      }

      if (normalized.includes('SELECT COUNT(*)::int AS count FROM qr_scan_records')) {
        const raw = params[0];
        const parsed = JSON.parse(params[1]);
        const matches = records.filter(
          (r) => r.qr_raw_data === raw || JSON.stringify(r.qr_parsed_data) === JSON.stringify(parsed)
        );
        return { rows: [{ count: matches.length }] };
      }

      if (normalized.includes('SELECT id, scanned_at') && normalized.includes('MD5(qr_raw_data)')) {
        const raw = params[0];
        const parsed = JSON.parse(params[1]);
        const matches = records
          .filter(
            (r) => r.qr_raw_data === raw || JSON.stringify(r.qr_parsed_data) === JSON.stringify(parsed)
          )
          .sort((a, b) => b.id - a.id);
        return { rows: matches.slice(0, 1) };
      }

      if (normalized.startsWith('INSERT INTO qr_scan_records')) {
        const [qr_raw_data, jsonbText, qr_format, scanned_at, deviceInfoJson] = params;
        const now = new Date().toISOString();
        const row = {
          id: nextId++,
          qr_raw_data,
          qr_parsed_data: JSON.parse(jsonbText),
          qr_format,
          scanned_at: scanned_at || now,
          device_info: deviceInfoJson ? JSON.parse(deviceInfoJson) : null,
          created_at: now,
        };
        records.push(row);
        return { rows: [row] };
      }

      if (normalized.includes('WHERE id = $1')) {
        const id = Number(params[0]);
        const found = records.find((r) => r.id === id);
        return { rows: found ? [found] : [] };
      }

      if (normalized.includes('FROM qr_scan_records') && normalized.includes('LIMIT 1')) {
        const sorted = [...records].sort((a, b) => b.id - a.id);
        return { rows: sorted.slice(0, 1) };
      }

      if (normalized.includes('FROM qr_scan_records') && normalized.includes('LIMIT $')) {
        let filtered = [...records];
        if (normalized.includes('ILIKE')) {
          const term = String(params[0] || '').replace(/%/g, '').toLowerCase();
          filtered = filtered.filter(
            (r) =>
              r.qr_raw_data.toLowerCase().includes(term) ||
              JSON.stringify(r.qr_parsed_data).toLowerCase().includes(term)
          );
        }
        const limit = params[params.length - 2];
        const offset = params[params.length - 1];
        const sorted = filtered.sort((a, b) => b.id - a.id);
        return { rows: sorted.slice(offset, offset + limit) };
      }

      return { rows: [] };
    });
  });

  it('GET /api/health returns connected status', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.equal(res.body.backend, 'connected');
    assert.equal(res.body.database, 'connected');
  });

  it('POST /api/scans rejects invalid JSON', async () => {
    const res = await request(app).post('/api/scans').send({
      qr_raw_data: '{invalid json',
    });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /Invalid JSON syntax/i);
  });

  it('POST /api/scans saves arbitrary dynamic JSON structures (nested, arrays, null, booleans)', async () => {
    const payloads = [
      { Length: 120, Width: 50, Height: 30 },
      { PartNo: 'ABC001', OuterDiameter: 25.5, InnerDiameter: 10.2, Thickness: 3 },
      {
        Product: { ID: 'P1001', Dimensions: { X: 120, Y: 50, Z: 30 } },
        Measurements: [
          { Name: 'M1', Value: 10, Passed: true, Notes: null },
          { Name: 'M2', Value: 20, Passed: false, Notes: 'Edge' },
        ],
      },
      [1, 'two', true, null, { nested: 3.14 }],
    ];

    for (const payload of payloads) {
      const raw = JSON.stringify(payload);
      const res = await request(app).post('/api/scans').send({ qr_raw_data: raw });
      assert.equal(res.status, 201);
      assert.equal(res.body.record.qr_raw_data, raw);
      assert.deepEqual(res.body.record.qr_parsed_data, payload);
    }

    const statsRes = await request(app).get('/api/stats');
    assert.equal(statsRes.status, 200);
    assert.equal(statsRes.body.totalRecords, 4);
  });

  it('detects duplicate QR payloads and allows saving when allow_duplicate is true', async () => {
    const raw = JSON.stringify({ Length: 120, Width: 50 });

    const first = await request(app).post('/api/scans').send({ qr_raw_data: raw });
    assert.equal(first.status, 201);

    const dupCheck = await request(app)
      .post('/api/scans/check-duplicate')
      .send({ qr_raw_data: raw });
    assert.equal(dupCheck.status, 200);
    assert.equal(dupCheck.body.isDuplicate, true);
    assert.equal(dupCheck.body.existingCount, 1);

    const conflict = await request(app).post('/api/scans').send({ qr_raw_data: raw });
    assert.equal(conflict.status, 409);
    assert.equal(conflict.body.code, 'DUPLICATE_QR');

    const confirmed = await request(app)
      .post('/api/scans')
      .send({ qr_raw_data: raw, allow_duplicate: true });
    assert.equal(confirmed.status, 201);
  });

  it('supports pagination, search across dynamic properties/values, and single-record lookup', async () => {
    await request(app)
      .post('/api/scans')
      .send({ qr_raw_data: JSON.stringify({ PartNo: 'XYZ-99', Diameter: 42.5 }) });
    await request(app)
      .post('/api/scans')
      .send({ qr_raw_data: JSON.stringify({ Box: { Width: 100, Verified: true } }) });

    const listRes = await request(app).get('/api/scans?page=1&limit=10');
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.data.length, 2);
    assert.equal(listRes.body.pagination.total, 2);

    const searchRes = await request(app).get('/api/scans/search?q=XYZ-99');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.body.data.length, 1);
    assert.equal(searchRes.body.data[0].qr_parsed_data.PartNo, 'XYZ-99');

    const detailRes = await request(app).get(`/api/scans/${searchRes.body.data[0].id}`);
    assert.equal(detailRes.status, 200);
    assert.equal(detailRes.body.record.qr_parsed_data.Diameter, 42.5);
  });

  it('returns 503 on /api/health when database is unreachable', async () => {
    mock.method(db, 'query', async () => {
      throw new Error('ECONNREFUSED');
    });

    const res = await request(app).get('/api/health');
    assert.equal(res.status, 503);
    assert.equal(res.body.database, 'disconnected');
  });
});
