import { randomBytes } from 'node:crypto';
import { logger } from '../core/logger.js';
import {
  BATCHEXECUTE_URL,
  BL_FALLBACK,
  BUILD_LABEL_PATTERNS,
  CSRF_PATTERNS,
  DEFAULT_BASE_DELAY,
  DEFAULT_MAX_DELAY,
  DEFAULT_MAX_RETRIES,
  DEFAULT_TIMEOUT,
  NOTEBOOKLM_BASE_URL,
  PAGE_FETCH_HEADERS,
  QUERY_ENDPOINT,
  RPC_HEADERS,
  SESSION_ID_PATTERNS,
} from './constants.js';
import {
  APIError,
  AuthenticationError,
  CSRFExtractionError,
  isRetryableError,
  NetworkError,
  RateLimitError,
  RequestTimeoutError,
  RPCError,
} from './errors.js';
import type { AuthTokens, RPCRequest } from './types.js';

/**
 * Base client for NotebookLM API
 * Handles RPC protocol, authentication, and HTTP communication
 */
export class BaseClient {
  protected authTokens: AuthTokens;

  constructor(authTokens: AuthTokens) {
    this.authTokens = authTokens;
  }

  /**
   * Generate a cryptographically secure request ID
   */
  private generateRequestId(): string {
    // Generate 16 bytes (128 bits) of randomness for request ID
    // This provides sufficient entropy to prevent enumeration attacks
    return randomBytes(16).toString('hex');
  }

  /**
   * Execute an RPC call to the NotebookLM API
   */
  async callRPC({
    rpcId,
    params,
    path = '/',
    timeout = DEFAULT_TIMEOUT,
  }: RPCRequest): Promise<unknown> {
    let retries = 0;

    while (true) {
      try {
        return await this.executeRPC(rpcId, params, path, timeout);
      } catch (error) {
        if (retries >= DEFAULT_MAX_RETRIES) {
          throw error;
        }

        if (isRetryableError(error)) {
          retries++;
          const delay = Math.min(DEFAULT_BASE_DELAY * 2 ** (retries - 1), DEFAULT_MAX_DELAY);
          await this.sleep(delay * 1000);
          continue;
        }

        throw error;
      }
    }
  }

  /**
   * Execute a single RPC call (internal)
   */
  private async executeRPC(
    rpcId: string,
    params: unknown[],
    path: string,
    timeout: number
  ): Promise<unknown> {
    const url = this.buildURL(rpcId, path);
    const body = this.buildRequestBody(rpcId, params);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          ...RPC_HEADERS,
          Cookie: this.buildCookieHeader(),
          ...(this.authTokens.csrfToken && {
            'X-Goog-Csrf-Token': this.authTokens.csrfToken,
          }),
        },
        body,
        signal: AbortSignal.timeout(timeout * 1000),
      });

      if (!response.ok) {
        await this.handleHTTPError(response);
      }

      const text = await response.text();
      return this.parseResponse(text, rpcId);
    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'TimeoutError' || error.message.includes('timeout')) {
          throw new RequestTimeoutError(undefined, timeout * 1000);
        }
        throw new NetworkError(undefined, error);
      }

      throw new APIError('Unknown error during RPC call', 500);
    }
  }

  /**
   * Build the batchexecute URL with query parameters
   */
  private buildURL(rpcId: string, sourcePath: string): string {
    const params = new URLSearchParams({
      rpcids: rpcId,
      'source-path': sourcePath,
      bl: this.authTokens.buildLabel || BL_FALLBACK,
      hl: 'en',
      rt: 'c',
    });

    if (this.authTokens.sessionId) {
      params.set('f.sid', this.authTokens.sessionId);
    }

    const url = `${BATCHEXECUTE_URL}?${params.toString()}`;

    // Validate URL is safe
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('google.com')) {
        throw new Error('Invalid URL: not a Google domain');
      }
    } catch (error) {
      throw new Error(
        `Failed to build valid URL: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return url;
  }

  /**
   * Build the RPC request body
   */
  private buildRequestBody(rpcId: string, params: unknown[]): string {
    const paramsJson = JSON.stringify(params);
    const fReq = [[[rpcId, paramsJson, null, 'generic']]];
    const fReqJson = JSON.stringify(fReq);

    const bodyParts = [`f.req=${encodeURIComponent(fReqJson)}`];

    if (this.authTokens.csrfToken) {
      bodyParts.push(`at=${encodeURIComponent(this.authTokens.csrfToken)}`);
    }

    return bodyParts.join('&') + '&';
  }

  /**
   * Build cookie header from auth tokens
   */
  protected buildCookieHeader(): string {
    return Object.entries(this.authTokens.cookies)
      .map(([name, value]) => {
        // URL-encode cookie values to handle special characters like / and =
        const encodedValue = encodeURIComponent(value);
        return `${name}=${encodedValue}`;
      })
      .join('; ');
  }

  /**
   * Parse the batchexecute response
   */
  private parseResponse(responseText: string, rpcId: string): unknown {
    // Remove anti-XSSI prefix
    let text = responseText;
    if (text.startsWith(")]}'")) {
      text = text.slice(4);
    }

    const lines = text.trim().split('\n');
    const results: unknown[] = [];
    let i = 0;

    while (i < lines.length) {
      const line = lines[i].trim();
      if (!line) {
        i++;
        continue;
      }

      // Try to parse as byte count
      const byteCount = parseInt(line, 10);
      if (!Number.isNaN(byteCount) && byteCount > 0) {
        i++;
        if (i < lines.length) {
          try {
            const data = JSON.parse(lines[i]);
            results.push(data);
          } catch {
            // Not valid JSON, skip
          }
        }
        i++;
      } else {
        // Not a byte count, try to parse as JSON directly
        try {
          const data = JSON.parse(line);
          results.push(data);
        } catch {
          // Not valid JSON, skip
        }
        i++;
      }
    }

    return this.extractRPCResult(results, rpcId);
  }

  /**
   * Extract result for specific RPC ID from parsed response
   */
  private extractRPCResult(parsedResponse: unknown[], rpcId: string): unknown {
    for (const chunk of parsedResponse) {
      if (Array.isArray(chunk)) {
        for (const item of chunk) {
          if (
            Array.isArray(item) &&
            item.length >= 3 &&
            item[0] === 'wrb.fr' &&
            item[1] === rpcId
          ) {
            // Check for error in item[5]
            if (item.length > 5 && Array.isArray(item[5]) && item[5].length > 0) {
              const errorCode = item[5][0];
              if (typeof errorCode === 'number') {
                if (errorCode === 16) {
                  throw new AuthenticationError(
                    'Session invalid. Please run "notebooklm auth import" to re-authenticate.'
                  );
                }

                let detailType = '';
                let detailData: unknown;

                if (item[5].length > 2 && Array.isArray(item[5][2])) {
                  for (const detail of item[5][2]) {
                    if (Array.isArray(detail) && detail.length > 0) {
                      detailType = String(detail[0]);
                      detailData = detail[1];
                      break;
                    }
                  }
                }

                throw new RPCError(
                  `API error (code ${errorCode})`,
                  rpcId,
                  errorCode,
                  detailType,
                  detailData
                );
              }
            }

            const resultStr = item[2];
            if (typeof resultStr === 'string') {
              try {
                return JSON.parse(resultStr);
              } catch {
                return resultStr;
              }
            }
            return resultStr;
          }
        }
      }
    }

    return null;
  }

  /**
   * Handle HTTP error responses
   */
  private async handleHTTPError(response: Response): Promise<void> {
    const status = response.status;

    if (status === 401 || status === 403) {
      throw new AuthenticationError();
    }

    if (status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError(undefined, retryAfter ? parseInt(retryAfter, 10) : undefined);
    }

    if (status >= 500) {
      throw new APIError(`Server error: ${status}`, status);
    }

    throw new APIError(`HTTP error: ${status}`, status);
  }

  /**
   * Refresh CSRF token by fetching the NotebookLM homepage
   */
  async refreshCSRFToken(): Promise<void> {
    try {
      const cookieHeader = this.buildCookieHeader();

      logger.debug(`Cookie header being sent: ${cookieHeader}`);
      logger.debug(`Number of cookies: ${Object.keys(this.authTokens.cookies).length}`);
      logger.debug(`Cookie names: ${Object.keys(this.authTokens.cookies).join(', ')}`);

      const response = await fetch(NOTEBOOKLM_BASE_URL + '/', {
        headers: {
          ...PAGE_FETCH_HEADERS,
          Cookie: cookieHeader,
          Origin: 'https://notebooklm.google.com',
          Referer: 'https://notebooklm.google.com/',
        },
        redirect: 'follow',
      });

      logger.debug(`Response status: ${response.status}`);
      logger.debug(`Response URL: ${response.url}`);
      logger.debug(`Was redirected: ${response.redirected}`);

      if (!response.ok) {
        throw new CSRFExtractionError(`Failed to fetch NotebookLM page: HTTP ${response.status}`);
      }

      const url = response.url;
      if (url.includes('accounts.google.com')) {
        logger.debug('Redirected to Google login page - cookies rejected');
        logger.debug(`Cookies that were sent: ${Object.keys(this.authTokens.cookies).join(', ')}`);
        throw new CSRFExtractionError(
          'Redirected to Google login. Session may be invalid or expired.'
        );
      }

      const html = await response.text();
      logger.debug(`HTML length: ${html.length}`);

      this.extractTokensFromHTML(html);

      logger.debug(`CSRF token extracted: ${!!this.authTokens.csrfToken}`);
    } catch (error) {
      if (error instanceof CSRFExtractionError) {
        throw error;
      }
      throw new CSRFExtractionError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Extract CSRF token, session ID, and build label from HTML
   */
  private extractTokensFromHTML(html: string): void {
    // Extract CSRF token
    let csrfToken: string | undefined;
    for (const pattern of CSRF_PATTERNS) {
      const match = html.match(pattern);
      if (match) {
        csrfToken = match[1];
        break;
      }
    }

    if (!csrfToken) {
      throw new CSRFExtractionError('Could not extract CSRF token from page');
    }

    this.authTokens.csrfToken = csrfToken;

    // Extract session ID
    for (const pattern of SESSION_ID_PATTERNS) {
      const match = html.match(pattern);
      if (match) {
        this.authTokens.sessionId = match[1];
        break;
      }
    }

    // Extract build label
    for (const pattern of BUILD_LABEL_PATTERNS) {
      const match = html.match(pattern);
      if (match) {
        this.authTokens.buildLabel = match[1];
        break;
      }
    }

    this.authTokens.extractedAt = Date.now();
  }

  /**
   * Check if auth tokens need refresh
   */
  needsTokenRefresh(maxAgeHours: number = 1): boolean {
    const ageMs = Date.now() - this.authTokens.extractedAt;
    const ageHours = ageMs / (1000 * 60 * 60);
    return ageHours > maxAgeHours;
  }

  /**
   * Query endpoint for streaming responses
   */
  protected buildQueryURL(): string {
    const params = new URLSearchParams({
      bl: this.authTokens.buildLabel || BL_FALLBACK,
      hl: 'en',
      _reqid: this.generateRequestId(),
      rt: 'c',
    });

    if (this.authTokens.sessionId) {
      params.set('f.sid', this.authTokens.sessionId);
    }

    return `${NOTEBOOKLM_BASE_URL}${QUERY_ENDPOINT}?${params.toString()}`;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
