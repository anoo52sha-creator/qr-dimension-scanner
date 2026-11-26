import { Clipboard } from '@capacitor/clipboard';
import { Capacitor } from '@capacitor/core';
import type { JsonValue } from '../types/scan';

export type JsonValidationResult =
  | { valid: true; raw: string; parsed: JsonValue; pretty: string }
  | { valid: false; raw: string; error: string };

/**
 * Validates raw QR text as JSON without assuming any schema or truncating data.
 */
export function validateAndParseJson(raw: string): JsonValidationResult {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return {
      valid: false,
      raw: raw ?? '',
      error: 'Scanned QR code is empty and does not contain JSON.',
    };
  }

  try {
    const parsed = JSON.parse(raw) as JsonValue;
    return {
      valid: true,
      raw,
      parsed,
      pretty: JSON.stringify(parsed, null, 2),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown JSON parse error';
    return {
      valid: false,
      raw,
      error: `Invalid JSON syntax: ${message}`,
    };
  }
}

export interface JsonMetrics {
  topLevelType: string;
  totalKeys: number;
  totalItems: number;
  maxDepth: number;
}

/**
 * Computes structural metrics for any arbitrary JSON value.
 */
export function countJsonMetrics(value: JsonValue, depth = 1): JsonMetrics {
  if (value === null || typeof value !== 'object') {
    return {
      topLevelType: value === null ? 'null' : typeof value,
      totalKeys: 0,
      totalItems: 1,
      maxDepth: depth,
    };
  }

  if (Array.isArray(value)) {
    let totalKeys = 0;
    let totalItems = value.length;
    let maxDepth = depth;
    for (const item of value) {
      const sub = countJsonMetrics(item, depth + 1);
      totalKeys += sub.totalKeys;
      maxDepth = Math.max(maxDepth, sub.maxDepth);
    }
    return {
      topLevelType: `Array(${value.length})`,
      totalKeys,
      totalItems,
      maxDepth,
    };
  }

  const keys = Object.keys(value);
  let totalKeys = keys.length;
  let totalItems = 0;
  let maxDepth = depth;
  for (const key of keys) {
    const sub = countJsonMetrics(value[key], depth + 1);
    totalKeys += sub.totalKeys;
    totalItems += sub.totalItems;
    maxDepth = Math.max(maxDepth, sub.maxDepth);
  }
  return {
    topLevelType: `Object(${keys.length} keys)`,
    totalKeys,
    totalItems,
    maxDepth,
  };
}

/**
 * Generates a concise preview string for any dynamic JSON structure.
 */
export function summarizeJsonPreview(value: JsonValue): string {
  if (value === null) return 'null';
  if (typeof value !== 'object') return String(value);

  if (Array.isArray(value)) {
    return `Array [${value.length} items]: ${JSON.stringify(value).slice(0, 110)}`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return '{} (empty object)';

  return entries
    .slice(0, 4)
    .map(([k, v]) => {
      if (v === null) return `${k}: null`;
      if (typeof v === 'object') {
        return Array.isArray(v) ? `${k}: [${v.length}]` : `${k}: {...}`;
      }
      return `${k}: ${String(v)}`;
    })
    .join(' • ');
}

export async function copyToClipboard(text: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await Clipboard.write({ string: text });
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}

export function downloadJsonFile(filename: string, rawJson: string): void {
  let content = rawJson;
  try {
    content = JSON.stringify(JSON.parse(rawJson), null, 2);
  } catch {
    content = rawJson;
  }

  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
