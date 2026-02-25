import { z } from 'zod';

const now = new Date().toISOString();

/**
 * Represents a single NotebookLM notebook in the library
 */
export const NotebookSchema = z.object({
  id: z.string().describe('Unique identifier for the notebook'),
  url: z.string().url().describe('NotebookLM notebook URL'),
  name: z.string().describe('Display name for the notebook'),
  description: z.string().describe('Description of notebook contents'),
  topics: z.array(z.string()).default([]).describe('Topics covered in this notebook'),
  contentTypes: z.array(z.string()).default([]).describe('Types of content (PDF, docs, etc.)'),
  useCases: z.array(z.string()).default([]).describe('Recommended use cases'),
  tags: z.array(z.string()).default([]).describe('Additional tags for organization'),
  createdAt: z.string().default(now).describe('ISO 8601 timestamp of creation'),
  updatedAt: z.string().default(now).describe('ISO 8601 timestamp of last update'),
  useCount: z.number().int().nonnegative().default(0).describe('Number of times queried'),
  lastUsed: z
    .string()
    .nullable()
    .default(null)
    .describe('ISO 8601 timestamp of last query, or null'),
});

export type Notebook = z.infer<typeof NotebookSchema>;

/**
 * Represents the complete notebook library with metadata
 */
export const NotebookLibraryDataSchema = z.object({
  notebooks: z.record(z.string(), NotebookSchema).describe('Map of notebook ID to notebook data'),
  activeNotebookId: z
    .string()
    .nullable()
    .default(null)
    .describe('Currently active notebook ID, or null'),
  updatedAt: z.string().default(now).describe('ISO 8601 timestamp of last library update'),
});

export type NotebookLibraryData = z.infer<typeof NotebookLibraryDataSchema>;

/**
 * Statistics about the notebook library.
 * Ported from get_stats() method in notebook_manager.py.
 */
export const NotebookStatsSchema = z.object({
  totalNotebooks: z.number().int().nonnegative().describe('Total number of notebooks in library'),
  totalTopics: z
    .number()
    .int()
    .nonnegative()
    .describe('Total number of unique topics across all notebooks'),
  totalUseCount: z.number().int().nonnegative().describe('Total usage count across all notebooks'),
  activeNotebook: NotebookSchema.nullable().describe('The currently active notebook, or null'),
  mostUsedNotebook: NotebookSchema.nullable().describe(
    'The most frequently used notebook, or null'
  ),
  libraryPath: z.string().describe('File path to the library data file'),
});

export type NotebookStats = z.infer<typeof NotebookStatsSchema>;
