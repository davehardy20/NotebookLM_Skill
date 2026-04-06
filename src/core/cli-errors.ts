import { safeErrorMessage } from './security.js';

export function getCliErrorMessage(
  error: unknown,
  fallback: string = 'Unknown error occurred'
): string {
  return safeErrorMessage(error, fallback);
}
