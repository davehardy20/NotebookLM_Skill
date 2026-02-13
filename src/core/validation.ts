/**
 * Validation utilities for NotebookLM URLs and inputs
 * Security-focused validation to prevent SSRF and path traversal attacks
 */

import { z } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Zod schema for validating NotebookLM URLs
 * Enforces strict security requirements:
 * - HTTPS protocol only (no HTTP, file://, javascript://, data://)
 * - Only allowed domains: notebooklm.google.com or google.com
 * - No path traversal sequences (.., %2e%2e)
 */
export const NotebookUrlSchema = z
  .string()
  .url({ message: 'URL must be a valid URL' })
  .refine(
    url => {
      // Check raw URL string for path traversal before URL constructor normalizes it
      const lowerUrl = url.toLowerCase();
      return (
        !lowerUrl.includes('..') &&
        !lowerUrl.includes('%2e%2e') &&
        !lowerUrl.includes('%252e%252e') &&
        !lowerUrl.includes('..%2f') &&
        !lowerUrl.includes('%2e%2e%2f')
      );
    },
    { message: 'URL contains invalid path traversal characters' }
  )
  .refine(
    url => {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    },
    { message: 'URL must use HTTPS protocol' }
  )
  .refine(
    url => {
      const parsed = new URL(url);
      return ['notebooklm.google.com', 'google.com'].includes(parsed.hostname);
    },
    { message: 'URL must be from notebooklm.google.com or google.com' }
  )
  .refine(
    url => {
      // Block file://, javascript://, data://, and other dangerous protocols
      const lowerUrl = url.toLowerCase();
      return (
        !lowerUrl.startsWith('file://') &&
        !lowerUrl.startsWith('javascript://') &&
        !lowerUrl.startsWith('data://') &&
        !lowerUrl.startsWith('vbscript://') &&
        !lowerUrl.startsWith('about:')
      );
    },
    { message: 'URL protocol is not allowed' }
  );

/**
 * Validate a NotebookLM URL against security requirements
 * Throws ValidationError if URL is invalid
 *
 * @param url - The URL to validate
 * @returns The validated URL if valid
 * @throws ValidationError if URL is invalid
 */
export function validateNotebookUrl(url: string): string {
  const result = NotebookUrlSchema.safeParse(url);
  if (!result.success) {
    const firstError = result.error.errors[0];
    throw new ValidationError(`Invalid notebook URL: ${firstError.message}`);
  }
  return url;
}

/**
 * Check if a URL is a valid NotebookLM URL without throwing
 * Useful for validation checks in UI/CLI feedback
 *
 * @param url - The URL to check
 * @returns true if valid, false otherwise
 */
export function isValidNotebookUrl(url: string): boolean {
  const result = NotebookUrlSchema.safeParse(url);
  return result.success;
}

/**
 * Normalize URL by ensuring it has trailing slash for consistency
 * Only applies to valid NotebookLM URLs
 *
 * @param url - The URL to normalize
 * @returns Normalized URL
 */
export function normalizeNotebookUrl(url: string): string {
  const validated = validateNotebookUrl(url);
  const parsed = new URL(validated);
  if (!parsed.pathname.endsWith('/')) {
    parsed.pathname += '/';
  }
  return parsed.toString();
}
