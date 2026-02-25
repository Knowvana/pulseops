// ============================================================================
// Log Sanitizer — PulseOps UI
//
// PURPOSE: Sanitizes sensitive data in API logs following security best
// practices. Masks passwords, tokens, API keys, and other sensitive fields.
// ============================================================================

const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'apiKey',
  'apiSecret',
  'secret',
  'authorization',
  'bearer',
  'ssn',
  'creditCard',
  'cvv',
  'pin',
];

const SENSITIVE_PATTERNS = [
  /password["\']?\s*[:=]\s*["\']?([^"'\s,}]+)/gi,
  /token["\']?\s*[:=]\s*["\']?([^"'\s,}]+)/gi,
  /apikey["\']?\s*[:=]\s*["\']?([^"'\s,}]+)/gi,
  /authorization["\']?\s*[:=]\s*["\']?([^"'\s,}]+)/gi,
];

/**
 * Sanitize an object by masking sensitive fields
 * @param {*} data - Data to sanitize (object, string, or any type)
 * @returns {*} Sanitized data
 */
export function sanitizeData(data) {
  if (!data) return data;

  if (typeof data === 'string') {
    return sanitizeString(data);
  }

  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.map(item => sanitizeData(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveField(key)) {
        sanitized[key] = '••••••••';
      } else if (typeof value === 'object') {
        sanitized[key] = sanitizeData(value);
      } else if (typeof value === 'string') {
        sanitized[key] = sanitizeString(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  return data;
}

/**
 * Check if a field name is sensitive
 * @param {string} fieldName - Field name to check
 * @returns {boolean} True if field is sensitive
 */
function isSensitiveField(fieldName) {
  const lowerName = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(field => lowerName.includes(field));
}

/**
 * Sanitize a string by masking sensitive patterns
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  let sanitized = str;
  SENSITIVE_PATTERNS.forEach(pattern => {
    sanitized = sanitized.replace(pattern, (match, value) => {
      return match.replace(value, '••••••••');
    });
  });
  return sanitized;
}

/**
 * Format JSON for display with sanitization
 * @param {*} data - Data to format
 * @returns {string} Formatted JSON string
 */
export function formatSanitizedJson(data) {
  try {
    const sanitized = sanitizeData(data);
    return JSON.stringify(sanitized, null, 2);
  } catch (err) {
    return String(data);
  }
}

export default {
  sanitizeData,
  formatSanitizedJson,
};
