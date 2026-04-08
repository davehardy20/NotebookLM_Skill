import { logger } from '../core/logger.js';
import { BaseClient } from './client.js';
import {
  ChatGoals,
  ChatResponseLengths,
  NOTEBOOKLM_BASE_URL,
  OWNERSHIP_MINE,
  RPC_HEADERS,
  RPC_IDS,
} from './constants.js';
import { NotebookNotFoundError } from './errors.js';
import type { Notebook, QueryResult, Source } from './types.js';

export class NotebookClient extends BaseClient {
  async listNotebooks(): Promise<Notebook[]> {
    const result = await this.callRPC({
      rpcId: RPC_IDS.LIST_NOTEBOOKS,
      params: [null, 1, null, [2]],
    });

    if (!Array.isArray(result)) {
      return [];
    }

    const notebookList = Array.isArray(result[0]) ? result[0] : result;

    return notebookList
      .filter(nb => Array.isArray(nb) && nb.length >= 3)
      .map(nb => this.parseNotebookData(nb));
  }

  async getNotebook(notebookId: string): Promise<Notebook> {
    const result = await this.callRPC({
      rpcId: RPC_IDS.GET_NOTEBOOK,
      params: [notebookId, null, [2], null, 0],
      path: `/notebook/${notebookId}`,
    });

    if (!result) {
      throw new NotebookNotFoundError(notebookId);
    }

    return this.parseNotebookFromDetail(result, notebookId);
  }

  async createNotebook(title: string = ''): Promise<Notebook> {
    const params = [
      title,
      null,
      null,
      [2],
      [1, null, null, null, null, null, null, null, null, null, [1]],
    ];

    const result = await this.callRPC({
      rpcId: RPC_IDS.CREATE_NOTEBOOK,
      params,
    });

    if (!Array.isArray(result) || result.length < 3 || !result[2]) {
      throw new Error('Failed to create notebook: invalid response');
    }

    return {
      id: String(result[2]),
      title: title || 'Untitled notebook',
      sourceCount: 0,
      sources: [],
      isOwned: true,
      isShared: false,
    };
  }

  async renameNotebook(notebookId: string, newTitle: string): Promise<boolean> {
    const params = [notebookId, [[null, null, null, [null, newTitle]]]];

    const result = await this.callRPC({
      rpcId: RPC_IDS.RENAME_NOTEBOOK,
      params,
      path: `/notebook/${notebookId}`,
    });

    return result !== null;
  }

  async deleteNotebook(notebookId: string): Promise<boolean> {
    const params = [[notebookId], [2]];

    const result = await this.callRPC({
      rpcId: RPC_IDS.DELETE_NOTEBOOK,
      params,
    });

    return result !== null;
  }

  async configureChat(
    notebookId: string,
    goal: 'default' | 'custom' | 'learning_guide' = 'default',
    customPrompt?: string,
    responseLength: 'default' | 'longer' | 'shorter' = 'default'
  ): Promise<void> {
    const goalCode = ChatGoals.getCode(goal);

    if (goal === 'custom' && !customPrompt) {
      throw new Error('customPrompt is required when goal is "custom"');
    }

    if (customPrompt && customPrompt.length > 10000) {
      throw new Error(`custom_prompt exceeds 10000 chars (got ${customPrompt.length})`);
    }

    const lengthCode = ChatResponseLengths.getCode(responseLength);

    const goalSetting = goal === 'custom' && customPrompt ? [goalCode, customPrompt] : [goalCode];

    const chatSettings = [goalSetting, [lengthCode]];
    const params = [notebookId, [[null, null, null, null, null, null, null, chatSettings]]];

    await this.callRPC({
      rpcId: RPC_IDS.RENAME_NOTEBOOK,
      params,
      path: `/notebook/${notebookId}`,
    });
  }

  async getNotebookSummary(
    notebookId: string
  ): Promise<{ summary: string; suggestedTopics: Array<{ question: string; prompt: string }> }> {
    const result = await this.callRPC({
      rpcId: RPC_IDS.GET_SUMMARY,
      params: [notebookId, [2]],
      path: `/notebook/${notebookId}`,
    });

    let summary = '';
    const suggestedTopics: Array<{ question: string; prompt: string }> = [];

    if (Array.isArray(result)) {
      if (result.length > 0 && Array.isArray(result[0]) && result[0].length > 0) {
        summary = String(result[0][0]);
      }

      if (result.length > 1 && result[1]) {
        const topicsData = Array.isArray(result[1]) && result[1].length > 0 ? result[1][0] : [];

        for (const topic of topicsData) {
          if (Array.isArray(topic) && topic.length >= 2) {
            suggestedTopics.push({
              question: String(topic[0]),
              prompt: String(topic[1]),
            });
          }
        }
      }
    }

    return { summary, suggestedTopics };
  }

  async query(
    notebookId: string,
    queryText: string,
    sourceIds?: string[],
    conversationId?: string
  ): Promise<QueryResult> {
    const notebook = await this.getNotebook(notebookId);
    const sources = sourceIds || notebook.sources.map(s => s.id);

    const sourcesArray = sources.map(sid => [[sid]]);

    const params = [
      sourcesArray,
      queryText,
      null,
      [2, null, [1]],
      conversationId || this.generateConversationId(),
    ];

    const paramsJson = JSON.stringify(params);
    const fReq = [null, paramsJson];
    const fReqJson = JSON.stringify(fReq);

    const bodyParts = [`f.req=${encodeURIComponent(fReqJson)}`];
    if (this.authTokens.csrfToken) {
      bodyParts.push(`at=${encodeURIComponent(this.authTokens.csrfToken)}`);
    }
    const body = bodyParts.join('&') + '&';

    const url = this.buildQueryURL();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...RPC_HEADERS,
        Cookie: this.buildCookieHeader(),
        'X-Goog-Csrf-Token': this.authTokens.csrfToken,
        Origin: NOTEBOOKLM_BASE_URL,
        Referer: `${NOTEBOOKLM_BASE_URL}/`,
        'X-Same-Domain': '1',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`Query failed: HTTP ${response.status}`);
    }

    const text = await response.text();
    const answer = this.parseQueryResponse(text);

    return {
      answer,
      conversationId: conversationId || this.generateConversationId(),
      sourcesUsed: sources,
      citations: {},
      references: [],
      turnNumber: 1,
      isFollowUp: false,
    };
  }

  private generateConversationId(): string {
    return crypto.randomUUID();
  }

  private parseQueryResponse(responseText: string): string {
    let text = responseText;
    if (text.startsWith(")]}'")) {
      text = text.slice(4);
    }

    const lines = text.trim().split('\n');
    let longestAnswer = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const byteCount = parseInt(line, 10);
        if (!Number.isNaN(byteCount) && byteCount > 0 && i + 1 < lines.length) {
          i++;
          const jsonLine = lines[i];
          const data = JSON.parse(jsonLine);

          if (Array.isArray(data)) {
            for (const item of data) {
              if (Array.isArray(item) && item.length > 2 && item[2]) {
                const innerData = JSON.parse(item[2]);
                if (Array.isArray(innerData) && innerData.length > 0) {
                  const answer = innerData[0][0];
                  if (typeof answer === 'string' && answer.length > longestAnswer.length) {
                    longestAnswer = answer;
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        logger.debug('Failed to parse query response line:', error);
      }
    }

    return longestAnswer;
  }

  private parseNotebookData(nb: unknown[]): Notebook {
    const title = typeof nb[0] === 'string' ? nb[0] : 'Untitled';
    const sourcesData = nb[1] || [];
    const notebookId = typeof nb[2] === 'string' ? nb[2] : '';

    let isOwned = true;
    let isShared = false;
    let createdAt: Date | undefined;
    let modifiedAt: Date | undefined;

    if (nb.length > 5 && Array.isArray(nb[5]) && nb[5].length > 0) {
      const metadata = nb[5];
      const ownershipValue = metadata[0];
      isOwned = ownershipValue === OWNERSHIP_MINE;

      if (metadata.length > 1) {
        isShared = Boolean(metadata[1]);
      }

      if (metadata.length > 5) {
        modifiedAt = this.parseTimestamp(metadata[5]);
      }
      if (metadata.length > 8) {
        createdAt = this.parseTimestamp(metadata[8]);
      }
    }

    const sources: Source[] = [];
    if (Array.isArray(sourcesData)) {
      for (const src of sourcesData) {
        if (Array.isArray(src) && src.length >= 2) {
          const srcIds = src[0] || [];
          const srcTitle = src[1] || 'Untitled';

          const srcId = Array.isArray(srcIds) && srcIds.length > 0 ? srcIds[0] : srcIds;

          const typeCode = src.length > 3 && Array.isArray(src[3]) ? src[3][0] : undefined;

          sources.push({
            id: String(srcId),
            title: String(srcTitle),
            type: typeof typeCode === 'number' ? typeCode : undefined,
          });
        }
      }
    }

    return {
      id: notebookId,
      title,
      sourceCount: sources.length,
      sources,
      isOwned,
      isShared,
      createdAt,
      modifiedAt,
    };
  }

  private parseNotebookFromDetail(result: unknown, notebookId: string): Notebook {
    if (Array.isArray(result) && result.length > 0 && Array.isArray(result[0])) {
      const notebookData = result[0];
      return this.parseNotebookData([
        notebookData[0],
        notebookData[1],
        notebookId,
        notebookData[3],
        notebookData[4],
        notebookData[5],
      ]);
    }

    throw new NotebookNotFoundError(notebookId);
  }

  private parseTimestamp(ts: unknown): Date | undefined {
    if (Array.isArray(ts) && ts.length >= 2 && typeof ts[0] === 'number') {
      return new Date(ts[0] * 1000);
    }
    return undefined;
  }
}
