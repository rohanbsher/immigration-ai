/**
 * Field-level encryption utility for sensitive PII data.
 * Uses AES-256-GCM for authenticated encryption.
 *
 * This module provides encryption for sensitive fields like:
 * - Passport numbers
 * - Alien numbers
 * - Social Security Numbers
 * - Date of birth
 * - Other PII stored in documents and forms
 */

import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { createLogger } from '@/lib/logger';
import { serverEnv, features } from '@/lib/config';

const log = createLogger('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
// Key length is 32 bytes (256 bits) - enforced in getEncryptionKey()

// Development fallback key - DO NOT use in production
// This is a deterministic key for local development only
const DEV_FALLBACK_KEY = '0'.repeat(64); // 32 bytes of zeros
let devKeyWarningShown = false;

/**
 * Get the encryption key from environment.
 * Key should be a 64-character hex string (32 bytes).
 * In development mode, falls back to a deterministic key with a warning.
 */
function getEncryptionKey(): Buffer {
  let keyHex = serverEnv.ENCRYPTION_KEY;

  if (!keyHex) {
    if (features.isDevelopment) {
      if (!devKeyWarningShown) {
        log.warn(
          'ENCRYPTION_KEY not set. Using development fallback key. ' +
          'This is NOT SECURE and should only be used in development. ' +
          'Generate a production key with: openssl rand -hex 32'
        );
        devKeyWarningShown = true;
      }
      keyHex = DEV_FALLBACK_KEY;
    } else {
      throw new Error(
        'ENCRYPTION_KEY environment variable is required in production. ' +
        'Generate one with: openssl rand -hex 32'
      );
    }
  }

  if (keyHex.length !== 64) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

export interface EncryptedData {
  /** Initialization vector (hex encoded) */
  iv: string;
  /** Encrypted data (hex encoded) */
  data: string;
  /** Authentication tag (hex encoded) */
  tag: string;
  /** Version for future algorithm changes */
  v: number;
}

/**
 * Encrypt a string value using AES-256-GCM.
 *
 * @param plaintext - The value to encrypt
 * @returns Encrypted data object
 */
export function encrypt(plaintext: string): EncryptedData {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    iv: iv.toString('hex'),
    data: encrypted.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    v: 1,
  };
}

/**
 * Decrypt an encrypted value.
 *
 * @param encryptedData - The encrypted data object
 * @returns Decrypted plaintext
 */
export function decrypt(encryptedData: EncryptedData): string {
  if (encryptedData.v !== 1) {
    throw new Error(`Unsupported encryption version: ${encryptedData.v}`);
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(encryptedData.iv, 'hex');
  const data = Buffer.from(encryptedData.data, 'hex');
  const tag = Buffer.from(encryptedData.tag, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Check if a value appears to be encrypted data.
 */
export function isEncrypted(value: unknown): value is EncryptedData {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.iv === 'string' &&
    typeof obj.data === 'string' &&
    typeof obj.tag === 'string' &&
    typeof obj.v === 'number'
  );
}

/**
 * Encrypt a value if it's not already encrypted.
 * Returns the original value if already encrypted.
 */
export function encryptIfNeeded(value: string | EncryptedData): EncryptedData {
  if (isEncrypted(value)) {
    return value;
  }
  return encrypt(value);
}

/**
 * Decrypt a value if it's encrypted, otherwise return as-is.
 */
export function decryptIfNeeded(value: string | EncryptedData): string {
  if (isEncrypted(value)) {
    return decrypt(value);
  }
  return value;
}

/**
 * Fields that should be encrypted when storing PII.
 */
export const SENSITIVE_FIELDS = [
  'passport_number',
  'alien_number',
  'social_security_number',
  'ssn',
  'date_of_birth',
  'dob',
  'driver_license_number',
  'bank_account_number',
  'credit_card_number',
  'tax_id',
  'itin',
  'ein',
  'visa_number',
  'travel_document_number',
  'uscis_receipt_number',
  'mother_maiden_name',
  'national_id_number',
  'i94_number',
] as const;

/**
 * Check if a field name is considered sensitive.
 */
export function isSensitiveField(fieldName: string): boolean {
  const normalizedName = fieldName.toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_FIELDS.some((sensitive) =>
    normalizedName.includes(sensitive.replace(/[_-]/g, ''))
  );
}

/**
 * Encrypt sensitive fields in an object.
 * Non-sensitive fields are left unchanged.
 *
 * @param data - Object containing fields to potentially encrypt
 * @returns Object with sensitive fields encrypted
 */
export function encryptSensitiveFields<T extends Record<string, unknown>>(
  data: T
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === 'string' && isSensitiveField(key)) {
      result[key] = encrypt(value);
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = encryptSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Decrypt sensitive fields in an object.
 *
 * @param data - Object containing potentially encrypted fields
 * @returns Object with sensitive fields decrypted
 */
export function decryptSensitiveFields<T extends Record<string, unknown>>(
  data: T
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (isEncrypted(value)) {
      result[key] = decrypt(value);
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = decryptSensitiveFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Mask a sensitive value for display purposes.
 * Shows only the last 4 characters.
 */
export function maskSensitiveValue(value: string): string {
  if (value.length <= 4) {
    return '*'.repeat(value.length);
  }
  return '*'.repeat(value.length - 4) + value.slice(-4);
}
