/**
 * Validates and parses a raw QR payload string as JSON.
 * Preserves the exact raw string and supports all valid JSON types:
 * objects, arrays, strings, integers, decimals, booleans, and null.
 *
 * @param {unknown} rawInput
 * @returns {{ valid: true, raw: string, parsed: unknown, jsonbText: string } | { valid: false, error: string }}
 */
function validateJsonPayload(rawInput) {
  if (typeof rawInput !== 'string') {
    return {
      valid: false,
      error: 'QR payload must be a raw JSON string.',
    };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return {
      valid: false,
      error: 'QR payload is empty.',
    };
  }

  try {
    const parsed = JSON.parse(rawInput);
    return {
      valid: true,
      raw: rawInput,
      parsed,
      // Explicitly serialize for safe PostgreSQL ::jsonb parameter binding
      jsonbText: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      valid: false,
      error: `Invalid JSON syntax: ${err.message}`,
    };
  }
}

module.exports = {
  validateJsonPayload,
};
