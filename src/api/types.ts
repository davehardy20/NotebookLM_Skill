/**
 * Type definitions for NotebookLM API
 */

/**
 * Cookie format from browser
 */
export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
}

/**
 * Authentication tokens
 */
export interface AuthTokens {
  cookies: Record<string, string>;
  csrfToken: string;
  sessionId?: string;
  buildLabel?: string;
  extractedAt: number;
}

/**
 * Notebook data structure
 */
export interface Notebook {
  id: string;
  title: string;
  sourceCount: number;
  sources: Source[];
  isOwned: boolean;
  isShared: boolean;
  createdAt?: Date;
  modifiedAt?: Date;
}

/**
 * Source data structure
 */
export interface Source {
  id: string;
  title: string;
  type?: number;
  url?: string;
}

/**
 * Query result
 */
export interface QueryResult {
  answer: string;
  conversationId: string;
  sourcesUsed: string[];
  citations: Record<number, string>;
  references: Reference[];
  turnNumber: number;
  isFollowUp: boolean;
}

/**
 * Reference with citation
 */
export interface Reference {
  sourceId: string;
  citationNumber: number;
  citedText?: string;
  citedTable?: TableData;
}

/**
 * Table data from citation
 */
export interface TableData {
  numColumns: number;
  rows: string[][];
}

/**
 * RPC request parameters
 */
export interface RPCRequest {
  rpcId: string;
  params: unknown[];
  path?: string;
  timeout?: number;
}

/**
 * RPC response
 */
export interface RPCResponse {
  result: unknown;
  error?: RPCErrorData;
}

/**
 * RPC error data
 */
export interface RPCErrorData {
  code: number;
  type: string;
  data?: unknown;
}

/**
 * Conversation turn for history
 */
export interface ConversationTurn {
  query: string;
  answer: string;
  turnNumber: number;
}
