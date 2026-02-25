import { z } from 'zod';

/**
 * Authentication information and browser state status
 */
export const AuthInfoSchema = z.object({
  authenticated: z.boolean().describe('Whether user is currently authenticated'),
  stateFile: z.string().optional().describe('Path to browser state file'),
  stateExists: z.boolean().describe('Whether state file exists on disk'),
  stateAgeHours: z
    .number()
    .nonnegative()
    .nullable()
    .optional()
    .describe('Age of state file in hours, or null'),
  authenticatedAtIso: z
    .string()
    .nullable()
    .optional()
    .describe('ISO 8601 timestamp of authentication, or null'),
});

export type AuthInfo = z.infer<typeof AuthInfoSchema>;

/**
 * Browser context and session state
 */
export const BrowserStateSchema = z.object({
  contextId: z.string().describe('Unique identifier for browser context'),
  authenticated: z.boolean().describe('Whether context is authenticated'),
  createdAt: z.string().describe('ISO 8601 timestamp of context creation'),
  lastUsedAt: z.string().describe('ISO 8601 timestamp of last use'),
  cookies: z.array(z.record(z.unknown())).default([]).describe('Stored cookies'),
  localStorage: z.record(z.string()).default({}).describe('Local storage data'),
  sessionStorage: z.record(z.string()).default({}).describe('Session storage data'),
});

export type BrowserState = z.infer<typeof BrowserStateSchema>;
