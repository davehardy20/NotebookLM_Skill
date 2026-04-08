/**
 * Shared authentication utilities
 * Common functions used across authentication modules
 */

import { readFileSync } from 'node:fs';
import type { AuthTokens } from '../api/types.js';
import { isEncrypted, parseStateData, requireEncryptionKeyFromEnv } from '../core/crypto.js';

/**
 * Load authentication tokens from file
 * Validates that data is encrypted and decrypts it
 *
 * @param authPath - Full path to the auth file
 * @returns AuthTokens if file exists and is valid, null if file doesn't exist
 * @throws Error if file exists but cannot be decrypted or is not encrypted
 */
export async function loadAuthFromFile(authPath: string): Promise<AuthTokens | null> {
  try {
    const content = readFileSync(authPath, 'utf-8');
    if (!isEncrypted(content)) {
      throw new Error(
        'Existing authentication data is stored insecurely. Delete auth.json and re-authenticate after setting STATE_ENCRYPTION_KEY.'
      );
    }

    return (await parseStateData(content, requireEncryptionKeyFromEnv())) as AuthTokens;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}
