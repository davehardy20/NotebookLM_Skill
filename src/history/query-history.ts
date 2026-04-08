import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chmod } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  isEncrypted,
  parseStateData,
  requireEncryptionKeyFromEnv,
  serializeStateData,
} from '../core/crypto.js';
import { logger } from '../core/logger.js';
import { Paths } from '../core/paths.js';
import { redactSensitiveContent } from '../core/security.js';

export interface QueryRecord {
  id: string;
  timestamp: string;
  question: string;
  answer: string;
  notebookId: string;
  notebookName: string;
  duration: number;
  fromCache: boolean;
}

export interface QueryHistoryData {
  queries: QueryRecord[];
  lastUpdated: string;
}

export class QueryHistory {
  private static instance: QueryHistory | null = null;
  private historyFile: string;
  private queries: QueryRecord[] = [];
  private initialized = false;

  private constructor() {
    this.historyFile = join(Paths.getInstance().dataDir, 'query_history.json');
  }

  static getInstance(): QueryHistory {
    if (!QueryHistory.instance) {
      QueryHistory.instance = new QueryHistory();
    }
    return QueryHistory.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const content = await fs.readFile(this.historyFile, 'utf-8');
      const wasEncrypted = isEncrypted(content);
      const data = (await parseStateData(
        content,
        requireEncryptionKeyFromEnv()
      )) as QueryHistoryData;
      this.queries = data.queries || [];
      logger.info(`📜 Loaded ${this.queries.length} queries from history`);

      if (!wasEncrypted) {
        await this.save();
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.queries = [];
      } else {
        logger.error({ error }, 'Error loading query history');
        throw error;
      }
    }

    this.initialized = true;
  }

  private async save(): Promise<void> {
    try {
      const dir = dirname(this.historyFile);
      await fs.mkdir(dir, { recursive: true });

      const data: QueryHistoryData = {
        queries: this.queries,
        lastUpdated: new Date().toISOString(),
      };

      const serialized = await serializeStateData(data, requireEncryptionKeyFromEnv());
      await fs.writeFile(this.historyFile, serialized, 'utf-8');

      const paths = Paths.getInstance();
      if (paths.isUnix()) {
        await chmod(dir, 0o700).catch(() => undefined);
        await chmod(this.historyFile, 0o600).catch(() => undefined);
      }
    } catch (error) {
      logger.error({ error }, 'Error saving query history');
      throw error;
    }
  }

  async logQuery(record: Omit<QueryRecord, 'id' | 'timestamp'>): Promise<QueryRecord> {
    await this.initialize();

    const newRecord: QueryRecord = {
      ...record,
      question: redactSensitiveContent(record.question, 'question'),
      answer: redactSensitiveContent(record.answer, 'answer'),
      id: this.generateId(),
      timestamp: new Date().toISOString(),
    };

    this.queries.unshift(newRecord);

    // Keep only last 1000 queries
    if (this.queries.length > 1000) {
      this.queries = this.queries.slice(0, 1000);
    }

    await this.save();
    logger.debug({ queryId: newRecord.id }, 'Query logged to history');

    return newRecord;
  }

  async list(limit: number = 20): Promise<QueryRecord[]> {
    await this.initialize();
    return this.queries.slice(0, limit);
  }

  async search(query: string): Promise<QueryRecord[]> {
    await this.initialize();
    const lowerQuery = query.toLowerCase();
    return this.queries.filter(
      q =>
        q.question.toLowerCase().includes(lowerQuery) ||
        q.answer.toLowerCase().includes(lowerQuery) ||
        q.notebookName.toLowerCase().includes(lowerQuery)
    );
  }

  async getById(id: string): Promise<QueryRecord | undefined> {
    await this.initialize();
    return this.queries.find(q => q.id === id);
  }

  async exportToMarkdown(): Promise<string> {
    await this.initialize();

    const lines: string[] = [
      '# Query History',
      '',
      `Exported: ${new Date().toLocaleString()}`,
      `Total queries: ${this.queries.length}`,
      '',
    ];

    for (const query of this.queries) {
      const date = new Date(query.timestamp).toLocaleString();
      lines.push(`## ${query.question}`);
      lines.push(
        `**Notebook:** ${query.notebookName} | **Date:** ${date} | **Duration:** ${query.duration}ms`
      );
      lines.push('');
      lines.push(query.answer);
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  private generateId(): string {
    return `q_${randomUUID()}`;
  }
}

export function resetQueryHistory(): void {
  (QueryHistory as unknown as { instance: QueryHistory | null }).instance = null;
}
