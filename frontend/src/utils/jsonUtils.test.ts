import { describe, it, expect } from 'vitest';
import {
  countJsonMetrics,
  summarizeJsonPreview,
  validateAndParseJson,
} from './jsonUtils';

describe('Dynamic JSON Utilities', () => {
  it('validates and preserves arbitrary JSON structures without fixed fields', () => {
    const raw = JSON.stringify({
      PartNo: 'ABC001',
      OuterDiameter: 25.5,
      Passed: true,
      Notes: null,
      Tags: ['steel', 42, false],
      Nested: { X: 10, Y: 20 },
    });

    const result = validateAndParseJson(raw);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.raw).toBe(raw);
      expect(result.parsed).toEqual({
        PartNo: 'ABC001',
        OuterDiameter: 25.5,
        Passed: true,
        Notes: null,
        Tags: ['steel', 42, false],
        Nested: { X: 10, Y: 20 },
      });
    }
  });

  it('rejects invalid JSON and empty strings', () => {
    expect(validateAndParseJson('').valid).toBe(false);
    const bad = validateAndParseJson('{Length: 120}');
    expect(bad.valid).toBe(false);
    if (!bad.valid) {
      expect(bad.error).toMatch(/Invalid JSON syntax/i);
    }
  });

  it('computes dynamic metrics and summaries for nested objects and arrays', () => {
    const sample = {
      Product: { ID: 'P1001', Dimensions: { X: 120, Y: 50, Z: 30 } },
      Measurements: [
        { Name: 'M1', Value: 10 },
        { Name: 'M2', Value: 20 },
      ],
    };

    const metrics = countJsonMetrics(sample);
    expect(metrics.topLevelType).toBe('Object(2 keys)');
    expect(metrics.maxDepth).toBeGreaterThanOrEqual(4);

    const summary = summarizeJsonPreview(sample);
    expect(summary).toContain('Product: {...}');
    expect(summary).toContain('Measurements: [2]');
  });
});
