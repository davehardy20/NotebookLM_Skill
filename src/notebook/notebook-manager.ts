/**
 * Notebook Library Management for NotebookLM
 * Manages a library of NotebookLM notebooks with metadata
 * Ported from Python notebook_manager.py
 */

import { promises as fs } from 'node:fs';
import { logger } from '../core/logger.js';
import { Paths } from '../core/paths.js';
import {
  type Notebook,
  type NotebookLibraryData,
  NotebookLibraryDataSchema,
} from '../types/notebook.js';

/**
 * Manages a collection of NotebookLM notebooks with metadata
 */
export class NotebookLibrary {
  private notebooks: Map<string, Notebook> = new Map();
  private activeNotebookId: string | null = null;
  private libraryFile: string;
  private initialized: boolean = false;

  constructor() {
    this.libraryFile = Paths.getInstance().libraryFile;
  }

  /**
   * Initialize the library by loading from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this._loadLibrary();
      this.initialized = true;
    } catch (error) {
      logger.error({ error }, 'Failed to initialize notebook library');
      throw error;
    }
  }

  /**
   * Load library from disk
   */
  private async _loadLibrary(): Promise<void> {
    try {
      const content = await fs.readFile(this.libraryFile, 'utf-8');
      const data = JSON.parse(content);

      const validated = NotebookLibraryDataSchema.parse(data);
      this.notebooks = new Map(Object.entries(validated.notebooks));
      this.activeNotebookId = validated.activeNotebookId;

      logger.info(`📚 Loaded library with ${this.notebooks.size} notebooks`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.notebooks = new Map();
        this.activeNotebookId = null;
        await this._saveLibrary();
      } else {
        logger.error({ error }, '⚠️ Error loading library');
        throw error;
      }
    }
  }

  /**
   * Save library to disk
   */
  private async _saveLibrary(): Promise<void> {
    try {
      const dir = this.libraryFile.substring(0, this.libraryFile.lastIndexOf('/'));
      await fs.mkdir(dir, { recursive: true });

      const data: NotebookLibraryData = {
        notebooks: Object.fromEntries(this.notebooks),
        activeNotebookId: this.activeNotebookId,
        updatedAt: new Date().toISOString(),
      };

      await fs.writeFile(this.libraryFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error({ error }, '❌ Error saving library');
      throw error;
    }
  }

  /**
   * Add a new notebook to the library
   *
   * @param url - NotebookLM notebook URL
   * @param name - Display name for the notebook
   * @param description - What's in this notebook
   * @param topics - Topics covered
   * @param contentTypes - Types of content (optional)
   * @param useCases - When to use this notebook (optional)
   * @param tags - Additional tags for organization (optional)
   * @returns The created notebook object
   */
  async addNotebook(
    url: string,
    name: string,
    description: string,
    topics: string[],
    contentTypes?: string[],
    useCases?: string[],
    tags?: string[]
  ): Promise<Notebook> {
    const notebookId = name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/_/g, '-')
      .replace(/[^a-z0-9-]/g, '');

    const existingNotebook = this.notebooks.get(notebookId);
    if (existingNotebook) {
      throw new Error(
        `Notebook '${name}' (ID: ${notebookId}) already exists. ` +
          `Current URL: ${existingNotebook.url}. ` +
          `Use 'notebooklm notebook list' to see all notebooks or 'notebooklm notebook remove ${notebookId}' to replace it.`
      );
    }

    const now = new Date().toISOString();
    const notebook: Notebook = {
      id: notebookId,
      url,
      name,
      description,
      topics,
      contentTypes: contentTypes ?? [],
      useCases: useCases ?? [],
      tags: tags ?? [],
      createdAt: now,
      updatedAt: now,
      useCount: 0,
      lastUsed: null,
    };

    this.notebooks.set(notebookId, notebook);

    if (this.notebooks.size === 1) {
      this.activeNotebookId = notebookId;
    }

    await this._saveLibrary();
    logger.info(`✅ Added notebook: ${name} (${notebookId})`);

    return notebook;
  }

  /**
   * Remove a notebook from the library
   *
   * @param notebookId - ID of notebook to remove
   * @returns True if removed, False if not found
   */
  async removeNotebook(notebookId: string): Promise<boolean> {
    if (!this.notebooks.has(notebookId)) {
      logger.warn(`⚠️ Notebook not found: ${notebookId}`);
      return false;
    }

    this.notebooks.delete(notebookId);

    if (this.activeNotebookId === notebookId) {
      this.activeNotebookId = null;
      if (this.notebooks.size > 0) {
        this.activeNotebookId = Array.from(this.notebooks.keys())[0];
      }
    }

    await this._saveLibrary();
    logger.info(`✅ Removed notebook: ${notebookId}`);

    return true;
  }

  /**
   * Update notebook metadata
   *
   * @param notebookId - ID of notebook to update
   * @param updates - Fields to update (undefined = keep existing)
   * @returns Updated notebook object
   */
  async updateNotebook(
    notebookId: string,
    updates: Partial<Omit<Notebook, 'id' | 'createdAt'>>
  ): Promise<Notebook> {
    const notebook = this.notebooks.get(notebookId);
    if (!notebook) {
      throw new Error(`Notebook not found: ${notebookId}`);
    }

    const updated: Notebook = {
      ...notebook,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.notebooks.set(notebookId, updated);
    await this._saveLibrary();
    logger.info(`✅ Updated notebook: ${updated.name}`);

    return updated;
  }

  /**
   * Get a specific notebook by ID
   *
   * @param notebookId - ID of notebook to retrieve
   * @returns The notebook, or undefined if not found
   */
  getNotebook(notebookId: string): Notebook | undefined {
    return this.notebooks.get(notebookId);
  }

  /**
   * List all notebooks in the library
   *
   * @returns Array of all notebooks
   */
  listNotebooks(): Notebook[] {
    return Array.from(this.notebooks.values());
  }

  /**
   * Search notebooks by query
   *
   * @param query - Search query (searches name, description, topics, tags, use cases)
   * @returns List of matching notebooks
   */
  searchNotebooks(query: string): Notebook[] {
    const queryLower = query.toLowerCase();
    const results: Notebook[] = [];

    for (const notebook of Array.from(this.notebooks.values())) {
      const searchable = [
        notebook.name.toLowerCase(),
        notebook.description.toLowerCase(),
        notebook.topics.join(' ').toLowerCase(),
        notebook.tags.join(' ').toLowerCase(),
        notebook.useCases.join(' ').toLowerCase(),
      ];

      if (searchable.some(field => field.includes(queryLower))) {
        results.push(notebook);
      }
    }

    return results;
  }

  /**
   * Set a notebook as active
   *
   * @param notebookId - ID of notebook to activate
   * @returns The activated notebook
   */
  async selectNotebook(notebookId: string): Promise<Notebook> {
    const notebook = this.notebooks.get(notebookId);
    if (!notebook) {
      throw new Error(`Notebook not found: ${notebookId}`);
    }

    this.activeNotebookId = notebookId;
    await this._saveLibrary();
    logger.info(`✅ Activated notebook: ${notebook.name}`);

    return notebook;
  }

  /**
   * Get the currently active notebook
   *
   * @returns The active notebook, or undefined if none selected
   */
  getActiveNotebook(): Notebook | undefined {
    if (this.activeNotebookId) {
      return this.notebooks.get(this.activeNotebookId);
    }
    return undefined;
  }

  /**
   * Increment usage counter for a notebook
   *
   * @param notebookId - ID of notebook that was used
   * @returns Updated notebook
   */
  async incrementUseCount(notebookId: string): Promise<Notebook> {
    const notebook = this.notebooks.get(notebookId);
    if (!notebook) {
      throw new Error(`Notebook not found: ${notebookId}`);
    }

    const updated: Notebook = {
      ...notebook,
      useCount: notebook.useCount + 1,
      lastUsed: new Date().toISOString(),
    };

    this.notebooks.set(notebookId, updated);
    await this._saveLibrary();

    return updated;
  }

  /**
   * Get library statistics
   *
   * @returns Statistics object with library metrics
   */
  getStats(): {
    totalNotebooks: number;
    totalTopics: number;
    totalUseCount: number;
    activeNotebook: Notebook | undefined;
    mostUsedNotebook: Notebook | undefined;
    libraryPath: string;
  } {
    const totalTopics = new Set<string>();
    let totalUseCount = 0;
    let mostUsedNotebook: Notebook | undefined;
    let maxUseCount = 0;

    for (const notebook of Array.from(this.notebooks.values())) {
      for (const topic of notebook.topics) {
        totalTopics.add(topic);
      }
      totalUseCount += notebook.useCount;

      if (notebook.useCount > maxUseCount) {
        maxUseCount = notebook.useCount;
        mostUsedNotebook = notebook;
      }
    }

    return {
      totalNotebooks: this.notebooks.size,
      totalTopics: totalTopics.size,
      totalUseCount,
      activeNotebook: this.getActiveNotebook(),
      mostUsedNotebook,
      libraryPath: this.libraryFile,
    };
  }
}

/**
 * Global singleton instance
 */
let instance: NotebookLibrary | null = null;

/**
 * Get or create the global NotebookLibrary instance
 */
export function getNotebookLibrary(): NotebookLibrary {
  if (!instance) {
    instance = new NotebookLibrary();
  }
  return instance;
}

/**
 * Reset the global instance (useful for testing)
 */
export function resetNotebookLibrary(): void {
  instance = null;
}
