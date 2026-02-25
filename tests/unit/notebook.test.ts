import { promises as fs } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NotebookLibrary, resetNotebookLibrary } from '../../src/notebook/notebook-manager.js';

vi.mock('fs');

const mkdir = vi.mocked(fs.mkdir);
const readFile = vi.mocked(fs.readFile);
const writeFile = vi.mocked(fs.writeFile);

describe('NotebookLibrary', () => {
  let library: NotebookLibrary;

  beforeEach(() => {
    resetNotebookLibrary();
    library = new NotebookLibrary();

    vi.clearAllMocks();
  });

  afterEach(() => {
    resetNotebookLibrary();
  });

  describe('CRUD Operations', () => {
    it('addNotebook - adds with generated ID', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      const notebook = await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'A test notebook',
        ['AI', 'Testing']
      );

      expect(notebook.id).toBe('my-notebook');
      expect(notebook.name).toBe('My Notebook');
      expect(notebook.url).toBe('https://notebooklm.google.com/notebook/123');
      expect(notebook.description).toBe('A test notebook');
      expect(notebook.topics).toEqual(['AI', 'Testing']);
      expect(notebook.useCount).toBe(0);
      expect(notebook.lastUsed).toBeNull();
      expect(notebook.createdAt).toBeDefined();
      expect(notebook.updatedAt).toBeDefined();
    });

    it('addNotebook - validates required fields', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'First Notebook',
        'First description',
        ['Topic1']
      );

      await expect(
        library.addNotebook(
          'https://notebooklm.google.com/notebook/456',
          'First Notebook',
          'Different description',
          ['Topic2']
        )
      ).rejects.toThrow("Notebook 'First Notebook' (ID: first-notebook) already exists");
    });

    it('getNotebook - returns notebook by ID', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      const _created = await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'A test notebook',
        ['AI']
      );

      const retrieved = library.getNotebook('my-notebook');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('my-notebook');
      expect(retrieved?.name).toBe('My Notebook');
    });

    it('getNotebook - returns undefined for missing ID', () => {
      const retrieved = library.getNotebook('nonexistent');
      expect(retrieved).toBeUndefined();
    });

    it('updateNotebook - updates fields', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Original description',
        ['AI']
      );

      const updated = await library.updateNotebook('my-notebook', {
        name: 'Updated Notebook',
        description: 'New description',
        topics: ['AI', 'Machine Learning'],
      });

      expect(updated.name).toBe('Updated Notebook');
      expect(updated.description).toBe('New description');
      expect(updated.topics).toEqual(['AI', 'Machine Learning']);
      expect(updated.id).toBe('my-notebook');
      expect(updated.createdAt).toBeDefined();
    });

    it('removeNotebook - removes by ID', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'A test notebook',
        ['AI']
      );

      const removed = await library.removeNotebook('my-notebook');

      expect(removed).toBe(true);
      expect(library.getNotebook('my-notebook')).toBeUndefined();
    });

    it('removeNotebook - handles active notebook removal', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'First Notebook',
        'First description',
        ['Topic1']
      );

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/456',
        'Second Notebook',
        'Second description',
        ['Topic2']
      );

      expect(library.getActiveNotebook()?.id).toBe('first-notebook');

      const removed = await library.removeNotebook('first-notebook');

      expect(removed).toBe(true);
      expect(library.getActiveNotebook()?.id).toBe('second-notebook');
    });

    it('removeNotebook - returns false for missing notebook', async () => {
      const removed = await library.removeNotebook('nonexistent');
      expect(removed).toBe(false);
    });

    it('listNotebooks - returns all as array', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/1',
        'Notebook 1',
        'Desc 1',
        ['Topic1']
      );
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/2',
        'Notebook 2',
        'Desc 2',
        ['Topic2']
      );
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/3',
        'Notebook 3',
        'Desc 3',
        ['Topic3']
      );

      const notebooks = library.listNotebooks();

      expect(notebooks).toHaveLength(3);
      expect(notebooks.map(n => n.name)).toEqual(['Notebook 1', 'Notebook 2', 'Notebook 3']);
    });
  });

  describe('Search functionality', () => {
    beforeEach(async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/1',
        'AI Research',
        'Research on AI topics',
        ['AI', 'Machine Learning'],
        ['PDF', 'Articles'],
        ['Research'],
        ['ai', 'research']
      );
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/2',
        'Web Development',
        'Full stack development guides',
        ['Web', 'React', 'Node.js'],
        ['Docs', 'Code'],
        ['Learning'],
        ['web', 'dev']
      );
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/3',
        'Data Science',
        'Data analysis notebooks',
        ['Data', 'Analytics', 'Python'],
        ['Datasets', 'Notebooks'],
        ['Analysis'],
        ['data', 'science']
      );
    });

    it('searchNotebooks - finds by name', () => {
      const results = library.searchNotebooks('AI');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('AI Research');
    });

    it('searchNotebooks - finds by description', () => {
      const results = library.searchNotebooks('development');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Web Development');
    });

    it('searchNotebooks - finds by topic', () => {
      const results = library.searchNotebooks('React');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Web Development');
    });

    it('searchNotebooks - finds by tag', () => {
      const results = library.searchNotebooks('research');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('AI Research');
    });

    it('searchNotebooks - finds by use case', () => {
      const results = library.searchNotebooks('Analysis');

      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Data Science');
    });

    it('searchNotebooks - case insensitive', () => {
      const lowerResults = library.searchNotebooks('ai');
      const upperResults = library.searchNotebooks('AI');
      const mixedResults = library.searchNotebooks('Ai');

      expect(lowerResults).toHaveLength(1);
      expect(upperResults).toHaveLength(1);
      expect(mixedResults).toHaveLength(1);
      expect(lowerResults[0].name).toBe('AI Research');
    });

    it('searchNotebooks - empty query returns all', () => {
      const results = library.searchNotebooks('');

      expect(results).toHaveLength(3);
    });
  });

  describe('Active notebook', () => {
    beforeEach(async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);
    });

    it('selectNotebook - sets active', async () => {
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/1',
        'Notebook 1',
        'Desc 1',
        ['Topic1']
      );
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/2',
        'Notebook 2',
        'Desc 2',
        ['Topic2']
      );

      await library.selectNotebook('notebook-2');

      expect(library.getActiveNotebook()?.id).toBe('notebook-2');
      expect(library.getActiveNotebook()?.name).toBe('Notebook 2');
    });

    it('getActiveNotebook - returns active', async () => {
      writeFile.mockResolvedValue(undefined);

      const created = await library.addNotebook(
        'https://notebooklm.google.com/notebook/1',
        'First Notebook',
        'Desc',
        ['Topic1']
      );

      const active = library.getActiveNotebook();

      expect(active).toBeDefined();
      expect(active?.id).toBe(created.id);
    });

    it('selectNotebook - validates ID exists', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/1',
        'Notebook 1',
        'Desc 1',
        ['Topic1']
      );

      await expect(library.selectNotebook('nonexistent')).rejects.toThrow(
        'Notebook not found: nonexistent'
      );
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/1',
        'Notebook 1',
        'Desc 1',
        ['AI', 'ML']
      );
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/2',
        'Notebook 2',
        'Desc 2',
        ['Web', 'React']
      );
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/3',
        'Notebook 3',
        'Desc 3',
        ['AI', 'Python']
      );
    });

    it('getStats - calculates total count', () => {
      const stats = library.getStats();

      expect(stats.totalNotebooks).toBe(3);
    });

    it('getStats - returns topic list', () => {
      const stats = library.getStats();

      expect(stats.totalTopics).toBe(5);
    });

    it('getStats - calculates use count', async () => {
      await library.incrementUseCount('notebook-1');
      await library.incrementUseCount('notebook-1');
      await library.incrementUseCount('notebook-2');

      const stats = library.getStats();

      expect(stats.totalUseCount).toBe(3);
    });

    it('getStats - returns most used notebook', async () => {
      await library.incrementUseCount('notebook-1');
      await library.incrementUseCount('notebook-1');
      await library.incrementUseCount('notebook-2');
      await library.incrementUseCount('notebook-3');

      const stats = library.getStats();

      expect(stats.mostUsedNotebook?.id).toBe('notebook-1');
      expect(stats.mostUsedNotebook?.useCount).toBe(2);
    });

    it('incrementUseCount - updates timestamp', async () => {
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/4',
        'Notebook 4',
        'Desc 4',
        ['Topic']
      );

      const notebook = await library.incrementUseCount('notebook-4');

      expect(notebook.useCount).toBe(1);
      expect(notebook.lastUsed).toBeDefined();
      expect(notebook.lastUsed).not.toBeNull();
    });
  });

  describe('Persistence', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);
      resetNotebookLibrary();
      library = new NotebookLibrary();
    });

    it('load from JSON on init - creates empty library if file not found', async () => {
      readFile.mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

      await library.initialize();

      const notebooks = library.listNotebooks();
      expect(notebooks).toHaveLength(0);
      expect(writeFile).toHaveBeenCalled();
    });

    it('load from JSON on init - loads existing library', async () => {
      const mockData = {
        notebooks: {
          'my-notebook': {
            id: 'my-notebook',
            url: 'https://notebooklm.google.com/notebook/123',
            name: 'My Notebook',
            description: 'A test notebook',
            topics: ['AI'],
            contentTypes: [],
            useCases: [],
            tags: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            useCount: 0,
            lastUsed: null,
          },
        },
        activeNotebookId: 'my-notebook',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      readFile.mockResolvedValue(JSON.stringify(mockData));
      vi.clearAllMocks();

      await library.initialize();

      const notebook = library.getNotebook('my-notebook');
      expect(notebook).toBeDefined();
      expect(notebook?.name).toBe('My Notebook');
      expect(library.getActiveNotebook()?.id).toBe('my-notebook');
    });

    it('handle corrupted file - throws error', async () => {
      readFile.mockRejectedValue(new Error('Invalid JSON'));
      vi.clearAllMocks();

      await expect(library.initialize()).rejects.toThrow();
    });

    it('save to JSON on changes', async () => {
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );

      expect(writeFile).toHaveBeenCalled();

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData.notebooks).toHaveProperty('my-notebook');
      expect(savedData.activeNotebookId).toBe('my-notebook');
    });

    it('save on removeNotebook', async () => {
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );
      await library.removeNotebook('my-notebook');

      expect(writeFile).toHaveBeenCalledTimes(2);
    });

    it('save on updateNotebook', async () => {
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );
      await library.updateNotebook('my-notebook', { name: 'Updated' });

      expect(writeFile).toHaveBeenCalledTimes(2);
    });

    it('save on selectNotebook', async () => {
      await library.addNotebook('https://notebooklm.google.com/notebook/1', 'Notebook 1', 'Desc', [
        'Topic',
      ]);
      await library.addNotebook('https://notebooklm.google.com/notebook/2', 'Notebook 2', 'Desc', [
        'Topic',
      ]);
      await library.selectNotebook('notebook-2');

      expect(writeFile).toHaveBeenCalledTimes(3);
    });

    it('save on incrementUseCount', async () => {
      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );
      await library.incrementUseCount('my-notebook');

      expect(writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Persistence', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      resetNotebookLibrary();
      library = new NotebookLibrary();
    });

    it('load from JSON on init - creates empty library if file not found', async () => {
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' } as NodeJS.ErrnoException);

      await library.initialize();

      const notebooks = library.listNotebooks();
      expect(notebooks).toHaveLength(0);
      expect(fs.writeFile).toHaveBeenCalled();
    });

    it('load from JSON on init - loads existing library', async () => {
      const mockData = {
        notebooks: {
          'my-notebook': {
            id: 'my-notebook',
            url: 'https://notebooklm.google.com/notebook/123',
            name: 'My Notebook',
            description: 'A test notebook',
            topics: ['AI'],
            contentTypes: [],
            useCases: [],
            tags: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
            useCount: 0,
            lastUsed: null,
          },
        },
        activeNotebookId: 'my-notebook',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockData));
      vi.clearAllMocks();

      await library.initialize();

      const notebook = library.getNotebook('my-notebook');
      expect(notebook).toBeDefined();
      expect(notebook?.name).toBe('My Notebook');
      expect(library.getActiveNotebook()?.id).toBe('my-notebook');
    });

    it('handle corrupted file - throws error', async () => {
      vi.mocked(fs.readFile).mockRejectedValue(new Error('Invalid JSON'));
      vi.clearAllMocks();

      await expect(library.initialize()).rejects.toThrow();
    });

    it('save to JSON on changes', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );

      expect(writeFile).toHaveBeenCalled();

      const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
      const savedData = JSON.parse(writeCall[1] as string);

      expect(savedData.notebooks).toHaveProperty('my-notebook');
      expect(savedData.activeNotebookId).toBe('my-notebook');
    });

    it('save on removeNotebook', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );
      await library.removeNotebook('my-notebook');

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('save on updateNotebook', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );
      await library.updateNotebook('my-notebook', { name: 'Updated' });

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('save on selectNotebook', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await library.addNotebook('https://notebooklm.google.com/notebook/1', 'Notebook 1', 'Desc', [
        'Topic',
      ]);
      await library.addNotebook('https://notebooklm.google.com/notebook/2', 'Notebook 2', 'Desc', [
        'Topic',
      ]);
      await library.selectNotebook('notebook-2');

      expect(fs.writeFile).toHaveBeenCalledTimes(3);
    });

    it('save on incrementUseCount', async () => {
      vi.mocked(fs.mkdir).mockResolvedValue(undefined);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'Desc',
        ['Topic']
      );
      await library.incrementUseCount('my-notebook');

      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });
  });

  describe('Edge Cases', () => {
    it('handles special characters in notebook name', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      const notebook = await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook!!! (2024)',
        'A test notebook',
        ['AI']
      );

      expect(notebook.id).toBe('my-notebook-2024');
    });

    it('handles empty arrays for optional fields', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      const notebook = await library.addNotebook(
        'https://notebooklm.google.com/notebook/123',
        'My Notebook',
        'A test notebook',
        ['AI']
      );

      expect(notebook.contentTypes).toEqual([]);
      expect(notebook.useCases).toEqual([]);
      expect(notebook.tags).toEqual([]);
    });

    it('handles last notebook removal sets active to null', async () => {
      mkdir.mockResolvedValue(undefined);
      writeFile.mockResolvedValue(undefined);

      await library.addNotebook(
        'https://notebooklm.google.com/notebook/1',
        'Only Notebook',
        'Desc',
        ['Topic']
      );
      await library.removeNotebook('only-notebook');

      expect(library.getActiveNotebook()).toBeUndefined();
    });
  });
});
