/**
 * AES-256-GCM Encryption Utilities for Browser State
 *
 * Security: Implements authenticated encryption with associated data (AEAD)
 * using AES-256-GCM with random IVs and scrypt key derivation.
 *
 * Format: base64(salt:iv:ciphertext:authTag)
 * - Salt: 16 bytes (scrypt salt)
 * - IV: 12 bytes (GCM recommended size)
 * - Ciphertext: variable length
 * - AuthTag: 16 bytes (GCM authentication tag)
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import { createChildLogger } from './logger.js';

const logger = createChildLogger('Crypto');

/**
 * Encryption envelope format version for future compatibility
 */
const ENCRYPTION_VERSION = 'v1';
const ENCRYPTION_PREFIX = `ENC:${ENCRYPTION_VERSION}:`;

/**
 * Key derivation parameters for scrypt
 * - N: 16384 (cost factor, memory/CPU intensive)
 * - r: 8 (block size)
 * - p: 1 (parallelization)
 * - dkLen: 32 (derived key length for AES-256)
 */
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  dkLen: 32,
};

/**
 * Derive encryption key from password using scrypt
 *
 * @param password - The encryption password/key
 * @param salt - Random salt (16 bytes)
 * @returns 32-byte key for AES-256
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, SCRYPT_PARAMS.dkLen, {
    N: SCRYPT_PARAMS.N,
    r: SCRYPT_PARAMS.r,
    p: SCRYPT_PARAMS.p,
  });
}

/**
 * Encrypt an object using AES-256-GCM
 *
 * @param data - The data object to encrypt
 * @param key - The encryption key (from environment variable)
 * @returns Base64-encoded encrypted string with prefix
 * @throws Error if encryption fails
 */
export function encryptState(data: object, key: string): string {
  try {
    // Validate key
    if (!key || key.length < 8) {
      throw new Error('Encryption key must be at least 8 characters long');
    }

    // Generate random salt and IV
    const salt = randomBytes(16); // 128-bit salt
    const iv = randomBytes(12); // 96-bit IV (GCM recommended)

    // Derive key using scrypt
    const derivedKey = deriveKey(key, salt);

    // Create cipher
    const cipher = createCipheriv('aes-256-gcm', derivedKey, iv);

    // Encrypt the data
    const plaintext = JSON.stringify(data);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    // Combine components: salt + iv + ciphertext + authTag
    const encrypted = Buffer.concat([salt, iv, ciphertext, authTag]);

    // Return with version prefix for future compatibility
    return ENCRYPTION_PREFIX + encrypted.toString('base64');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Encryption failed', { error: message });
    throw new Error(`Failed to encrypt state: ${message}`);
  }
}

/**
 * Decrypt an encrypted state string
 *
 * @param encryptedData - The base64-encoded encrypted string
 * @param key - The encryption key (must match encryption key)
 * @returns The decrypted object
 * @throws Error if decryption fails (invalid key, tampered data, etc.)
 */
export function decryptState(encryptedData: string, key: string): object {
  try {
    // Validate key
    if (!key || key.length < 8) {
      throw new Error('Encryption key must be at least 8 characters long');
    }

    // Remove version prefix if present
    let data = encryptedData;
    if (data.startsWith(ENCRYPTION_PREFIX)) {
      data = data.slice(ENCRYPTION_PREFIX.length);
    }

    // Decode base64
    const encrypted = Buffer.from(data, 'base64');

    // Minimum length check: salt(16) + iv(12) + authTag(16) = 44 bytes minimum
    if (encrypted.length < 44) {
      throw new Error('Invalid encrypted data: too short');
    }

    // Extract components
    const salt = encrypted.subarray(0, 16);
    const iv = encrypted.subarray(16, 28); // 12 bytes
    const authTag = encrypted.subarray(encrypted.length - 16); // last 16 bytes
    const ciphertext = encrypted.subarray(28, encrypted.length - 16);

    // Derive key using scrypt
    const derivedKey = deriveKey(key, salt);

    // Create decipher
    const decipher = createDecipheriv('aes-256-gcm', derivedKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

    // Parse JSON
    return JSON.parse(plaintext.toString('utf8'));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Decryption failed', { error: message });

    // Provide more specific error messages for common issues
    if (message.includes('Unsupported state or unable to authenticate data')) {
      throw new Error('Decryption failed: Invalid encryption key or corrupted data');
    }
    if (message.includes('Unexpected token')) {
      throw new Error('Decryption failed: Data is not valid JSON after decryption');
    }

    throw new Error(`Failed to decrypt state: ${message}`);
  }
}

/**
 * Check if data appears to be encrypted
 *
 * @param data - The data string to check
 * @returns True if data is encrypted (has version prefix or looks like encrypted data)
 */
export function isEncrypted(data: string): boolean {
  if (!data || typeof data !== 'string') {
    return false;
  }

  // Check for version prefix
  if (data.startsWith(ENCRYPTION_PREFIX)) {
    return true;
  }

  // Try to detect encrypted data by attempting base64 decode
  // Encrypted data should not be valid JSON
  try {
    // If it's valid JSON, it's not encrypted
    JSON.parse(data);
    return false;
  } catch {
    // Not valid JSON, might be encrypted
    // Check if it's valid base64 (encrypted data is base64 encoded)
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (base64Regex.test(data) && data.length > 44) {
      return true;
    }
  }

  return false;
}

/**
 * Validate that an encryption key is suitable for use
 *
 * @param key - The key to validate
 * @returns True if key is valid
 */
export function isValidEncryptionKey(key: string | undefined): boolean {
  if (!key) return false;
  if (typeof key !== 'string') return false;
  if (key.length < 8) return false;
  return true;
}

/**
 * Generate a secure random encryption key
 * Useful for generating keys for documentation
 *
 * @param length - Desired key length (default: 32)
 * @returns Random string suitable for use as encryption key
 */
export function generateEncryptionKey(length: number = 32): string {
  const bytes = randomBytes(length);
  return bytes.toString('base64').slice(0, length);
}

/**
 * Get encryption key from environment
 * Returns undefined if not set or invalid
 */
export function getEncryptionKeyFromEnv(): string | undefined {
  const key = process.env.STATE_ENCRYPTION_KEY;
  if (isValidEncryptionKey(key)) {
    return key;
  }
  return undefined;
}

/**
 * Attempt to parse and decrypt state data
 * Handles both encrypted and unencrypted data for backward compatibility
 *
 * @param data - The raw file contents
 * @param key - The encryption key (optional, from env if not provided)
 * @returns Parsed state object
 * @throws Error if data cannot be parsed or decrypted
 */
export function parseStateData(data: string, key?: string): object {
  // If data is not encrypted, parse as JSON directly
  if (!isEncrypted(data)) {
    try {
      return JSON.parse(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse unencrypted state: ${message}`);
    }
  }

  // Data is encrypted, need key
  const encryptionKey = key || getEncryptionKeyFromEnv();

  if (!encryptionKey) {
    throw new Error(
      'Encrypted state file found but STATE_ENCRYPTION_KEY is not set or invalid. ' +
        'Please set STATE_ENCRYPTION_KEY in your environment to decrypt the state.'
    );
  }

  // Decrypt and parse
  return decryptState(data, encryptionKey);
}

/**
 * Encrypt state data if key is available
 * Falls back to unencrypted JSON if no key (for backward compatibility)
 *
 * @param data - The state object to save
 * @param key - The encryption key (optional, from env if not provided)
 * @returns String to write to file (encrypted or JSON)
 */
export function serializeStateData(data: object, key?: string): string {
  const encryptionKey = key || getEncryptionKeyFromEnv();

  if (encryptionKey) {
    try {
      return encryptState(data, encryptionKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Encryption failed, falling back to unencrypted', { error: message });
    }
  }

  // Fallback to unencrypted JSON
  return JSON.stringify(data, null, 2);
}
