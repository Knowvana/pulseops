// ============================================================================
// Encryption Utility — ServiceNow Module (PulseOps API)
//
// PURPOSE: Production-grade AES-256-GCM encryption/decryption for sensitive
// data like ServiceNow passwords. Uses Node.js native crypto module.
//
// SECURITY:
//   - AES-256-GCM provides authenticated encryption (confidentiality + integrity)
//   - Random IV generated for each encryption operation
//   - Auth tag prevents tampering
//   - Key derived from SERVICENOW_ENCRYPTION_KEY env var via SHA-256
//   - Falls back to a default key for development ONLY (logs a warning)
//
// USED BY:
//   - src/modules/servicenow/routes/servicenowRoutes.js — encrypt on save,
//     decrypt on test-connect
//
// USAGE:
//   import { encrypt, decrypt } from '#modules/servicenow/utils/encryption.js';
//   const encrypted = encrypt('my-secret-password');
//   const decrypted = decrypt(encrypted);
// ============================================================================
import crypto from 'crypto';
import logger from '#core/logger.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment or fallback.
 * Production MUST set SERVICENOW_ENCRYPTION_KEY env var.
 * @returns {Buffer} 32-byte key
 */
function getEncryptionKey() {
  const envKey = process.env.SERVICENOW_ENCRYPTION_KEY;
  if (!envKey) {
    logger.warn('SERVICENOW_ENCRYPTION_KEY not set — using fallback key. Set this in production!');
  }
  const keySource = envKey || 'pulseops-servicenow-default-dev-key-change-me';
  return crypto.createHash('sha256').update(keySource).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * @param {string} plaintext — The string to encrypt
 * @returns {string} Base64-encoded string containing IV + authTag + ciphertext
 */
export function encrypt(plaintext) {
  if (!plaintext) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  // Pack: iv(hex) + ':' + authTag(hex) + ':' + ciphertext(hex)
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * @param {string} encryptedData — The encrypted string from encrypt()
 * @returns {string} Decrypted plaintext
 */
export function decrypt(encryptedData) {
  if (!encryptedData) return '';

  const key = getEncryptionKey();
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }

  const iv = Buffer.from(parts[0], 'hex');
  const authTag = Buffer.from(parts[1], 'hex');
  const ciphertext = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export default { encrypt, decrypt };
