/**
 * Comprehensive unit tests for API Client
 * Tests BaseClient and NotebookClient functionality
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { NotebookClient } from '../../../src/api/notebooks.js';
import {
  APIError,
  AuthenticationError,
  CSRFExtractionError,
  NetworkError,
  RateLimitError,
  RequestTimeoutError,
  RPCError,
  NotebookNotFoundError,
} from '../../../src/api/errors.js';
import type { AuthTokens } from '../../../src/api/types.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('BaseClient', () => {
  const mockTokens: AuthTokens = {
    cookies: {
      SID: 'test-sid',
      HSID: 'test-hsid',
      SSID: 'test-ssid',
      APISID: 'test-apisid',
      SAPISID: 'test-sapisid',
    },
    csrfToken: 'test-csrf-token',
    extractedAt: Date.now(),
    buildLabel: 'test-build-label',
    sessionId: 'test-session-id',
  };

  let client: NotebookClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new NotebookClient(mockTokens);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('callRPC', () => {
    it('should successfully call RPC and return parsed result', async () => {
      const mockResponse = '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.callRPC({ rpcId: 'testRpc', params: ['param1'] });

      expect(result).toEqual(['success']);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle response with anti-XSSI prefix', async () => {
      const mockResponse = ")]}'\n1\n[[["wrb.fr","testRpc","[\\"data\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toEqual(['data']);
    });

    it('should handle response with plain JSON (no byte count)', async () => {
      const mockResponse = '[[["wrb.fr","testRpc","[\\"plain\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toEqual(['plain']);
    });

    it('should handle response with multiple chunks', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","testRpc","[\\"result\\"]",null,null,null,"generic"]]]\n1\n[[["wrb.fr","otherRpc","[\\"other\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toEqual(['result']);
    });

    it('should handle non-JSON result string', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","testRpc","\\"simple string\\"",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toBe('simple string');
    });

    it('should return null when RPC ID is not found in response', async () => {
      const mockResponse = '1\n[[["wrb.fr","differentRpc","[\\"data\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toBeNull();
    });

    it('should return null for empty response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(''),
      });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toBeNull();
    });

    it('should handle RPC error in response (error code 16)', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","testRpc",null,null,null,[16,"Authentication expired"],"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should handle generic RPC error in response', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","testRpc",null,null,null,[7,"Permission denied",[["type","detail"]]],"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(RPCError);
    });
  });

  describe('Error Handling - HTTP Status Codes', () => {
    it('should throw AuthenticationError on 401 Unauthorized', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw AuthenticationError on 403 Forbidden', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should throw RateLimitError on 429 Too Many Requests', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'Retry-After': '120' }),
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(
        RateLimitError
      );
    });

    it('should throw RateLimitError without retry-after header', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers(),
      });

      const error = await expect(
        client.callRPC({ rpcId: 'testRpc', params: [] })
      ).rejects.toThrow(RateLimitError);
    });

    it('should throw APIError on 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const error = (await expect(
        client.callRPC({ rpcId: 'testRpc', params: [] })
      ).rejects.toThrow(APIError)) as unknown as APIError;
    });

    it('should throw APIError on 503 Service Unavailable', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(APIError);
    });

    it('should throw APIError on generic 4xx error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(APIError);
    });
  });

  describe('Network Error Handling', () => {
    it('should throw NetworkError on fetch failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(NetworkError);
    });

    it('should throw NetworkError on connection refused', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(NetworkError);
    });

    it('should throw NetworkError on DNS failure', async () => {
      mockFetch.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(NetworkError);
    });

    it('should throw RequestTimeoutError on timeout', async () => {
      const timeoutError = new Error('The operation was aborted');
      timeoutError.name = 'TimeoutError';
      mockFetch.mockRejectedValue(timeoutError);

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(
        RequestTimeoutError
      );
    });

    it('should throw RequestTimeoutError on timeout message', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(
        RequestTimeoutError
      );
    });

    it('should include original error in NetworkError', async () => {
      const originalError = new Error('Original network error');
      mockFetch.mockRejectedValue(originalError);

      try {
        await client.callRPC({ rpcId: 'testRpc', params: [] });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(NetworkError);
        expect((error as NetworkError).originalError).toBe(originalError);
      }
    });
  });

  describe('Retry Logic', () => {
    it('should retry on RateLimitError and succeed', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'Retry-After': '0' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(successResponse),
        });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toEqual(['success']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on 500 error and succeed', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(successResponse),
        });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toEqual(['success']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should retry on network error and succeed', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';

      mockFetch
        .mockRejectedValueOnce(new TypeError('fetch failed'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(successResponse),
        });

      const result = await client.callRPC({ rpcId: 'testRpc', params: [] });

      expect(result).toEqual(['success']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not retry on AuthenticationError', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(
        AuthenticationError
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw after max retries exceeded', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.callRPC({ rpcId: 'testRpc', params: [] })).rejects.toThrow(NetworkError);
      expect(mockFetch).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });
  });

  describe('CSRF Token Extraction', () => {
    it('should extract CSRF token from WIZ_global_data', async () => {
      const html = `
        <html>
          <script>
            window.WIZ_global_data = {"SNlM0e":"extracted-csrf-token"};
          </script>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://notebooklm.google.com/',
        text: vi.fn().mockResolvedValue(html),
      });

      await client.refreshCSRFToken();

      // Verify the client has the new token by checking a subsequent request
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });
      const lastCall = mockFetch.mock.lastCall;
      expect(lastCall?.[1]?.headers?.['X-Goog-Csrf-Token']).toBe('extracted-csrf-token');
    });

    it('should extract CSRF token from at= parameter', async () => {
      const html = `
        <html>
          <body>
            <a href="/notebook?at=param-csrf-token">Link</a>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://notebooklm.google.com/',
        text: vi.fn().mockResolvedValue(html),
      });

      await client.refreshCSRFToken();

      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });
      const lastCall = mockFetch.mock.lastCall;
      expect(lastCall?.[1]?.headers?.['X-Goog-Csrf-Token']).toBe('param-csrf-token');
    });

    it('should extract CSRF token from FdrFJe field', async () => {
      const html = `
        <html>
          <script>
            window.WIZ_global_data = {"FdrFJe":"fdr-csrf-token"};
          </script>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://notebooklm.google.com/',
        text: vi.fn().mockResolvedValue(html),
      });

      await client.refreshCSRFToken();

      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });
      const lastCall = mockFetch.mock.lastCall;
      expect(lastCall?.[1]?.headers?.['X-Goog-Csrf-Token']).toBe('fdr-csrf-token');
    });

    it('should extract session ID from FdrFJe', async () => {
      const html = `
        <html>
          <script>
            window.WIZ_global_data = {"SNlM0e":"csrf","FdrFJe":"123456789"};
          </script>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://notebooklm.google.com/',
        text: vi.fn().mockResolvedValue(html),
      });

      await client.refreshCSRFToken();

      // Verify session ID is included in URL
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });
      const lastCall = mockFetch.mock.lastCall?.[0] as string;
      expect(lastCall).toContain('f.sid=123456789');
    });

    it('should extract build label from cfb2h', async () => {
      const html = `
        <html>
          <script>
            window.WIZ_global_data = {"SNlM0e":"csrf","cfb2h":"boq_build_label_v1"};
          </script>
        </html>
      `;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://notebooklm.google.com/',
        text: vi.fn().mockResolvedValue(html),
      });

      await client.refreshCSRFToken();

      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });
      const lastCall = mockFetch.mock.lastCall?.[0] as string;
      expect(lastCall).toContain('bl=boq_build_label_v1');
    });

    it('should throw CSRFExtractionError when token not found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://notebooklm.google.com/',
        text: vi.fn().mockResolvedValue('<html>No token here</html>'),
      });

      await expect(client.refreshCSRFToken()).rejects.toThrow(CSRFExtractionError);
    });

    it('should throw CSRFExtractionError when redirected to login', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        url: 'https://accounts.google.com/signin',
        text: vi.fn().mockResolvedValue('<html>Login page</html>'),
      });

      await expect(client.refreshCSRFToken()).rejects.toThrow(CSRFExtractionError);
      await expect(client.refreshCSRFToken()).rejects.toThrow('Redirected to login page');
    });

    it('should throw CSRFExtractionError on HTTP error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.refreshCSRFToken()).rejects.toThrow(CSRFExtractionError);
    });

    it('should throw CSRFExtractionError on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.refreshCSRFToken()).rejects.toThrow(CSRFExtractionError);
    });
  });

  describe('Request Formatting', () => {
    it('should build correct cookie header', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });

      const lastCall = mockFetch.mock.lastCall;
      const headers = lastCall?.[1]?.headers as Record<string, string>;
      expect(headers?.Cookie).toContain('SID=test-sid');
      expect(headers?.Cookie).toContain('HSID=test-hsid');
      expect(headers?.Cookie).toContain('SSID=test-ssid');
      expect(headers?.Cookie).toContain('APISID=test-apisid');
      expect(headers?.Cookie).toContain('SAPISID=test-sapisid');
    });

    it('should include CSRF token in X-Goog-Csrf-Token header', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });

      const lastCall = mockFetch.mock.lastCall;
      expect(lastCall?.[1]?.headers?.['X-Goog-Csrf-Token']).toBe('test-csrf-token');
    });

    it('should build correct URL with query parameters', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [], path: '/notebook/123' });

      const lastCall = mockFetch.mock.lastCall?.[0] as string;
      expect(lastCall).toContain('rpcids=testRpc');
      expect(lastCall).toContain('source-path=%2Fnotebook%2F123');
      expect(lastCall).toContain('bl=test-build-label');
      expect(lastCall).toContain('hl=en');
      expect(lastCall).toContain('rt=c');
      expect(lastCall).toContain('f.sid=test-session-id');
    });

    it('should use fallback build label when not set', async () => {
      const tokensWithoutBuildLabel: AuthTokens = {
        ...mockTokens,
        buildLabel: undefined,
      };
      const clientWithoutBuildLabel = new NotebookClient(tokensWithoutBuildLabel);

      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await clientWithoutBuildLabel.callRPC({ rpcId: 'testRpc', params: [] });

      const lastCall = mockFetch.mock.lastCall?.[0] as string;
      expect(lastCall).toContain('bl=');
    });

    it('should build correct request body', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: ['param1', 'param2'] });

      const lastCall = mockFetch.mock.lastCall;
      const body = lastCall?.[1]?.body as string;

      expect(body).toContain('f.req=');
      expect(body).toContain('at=test-csrf-token');

      // Decode and verify f.req structure
      const fReqMatch = body.match(/f\.req=([^&]+)/);
      expect(fReqMatch).toBeTruthy();
      const decodedReq = decodeURIComponent(fReqMatch![1]);
      const parsedReq = JSON.parse(decodedReq);
      expect(parsedReq).toEqual([[['testRpc', '["param1","param2"]', null, 'generic']]]);
    });

    it('should handle empty params array', async () => {
      const successResponse =
        '1\n[[["wrb.fr","testRpc","[\\"success\\"]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(successResponse),
      });

      await client.callRPC({ rpcId: 'testRpc', params: [] });

      const lastCall = mockFetch.mock.lastCall;
      const body = lastCall?.[1]?.body as string;
      const fReqMatch = body.match(/f\.req=([^&]+)/);
      const decodedReq = decodeURIComponent(fReqMatch![1]);
      const parsedReq = JSON.parse(decodedReq);
      expect(parsedReq).toEqual([[['testRpc', '[]', null, 'generic']]]);
    });
  });

  describe('needsTokenRefresh', () => {
    it('should return true when token is older than max age', () => {
      const oldTokens: AuthTokens = {
        ...mockTokens,
        extractedAt: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
      };
      const clientWithOldTokens = new NotebookClient(oldTokens);

      expect(clientWithOldTokens.needsTokenRefresh(1)).toBe(true);
    });

    it('should return false when token is fresh', () => {
      const freshTokens: AuthTokens = {
        ...mockTokens,
        extractedAt: Date.now() - 30 * 60 * 1000, // 30 minutes ago
      };
      const clientWithFreshTokens = new NotebookClient(freshTokens);

      expect(clientWithFreshTokens.needsTokenRefresh(1)).toBe(false);
    });

    it('should use default max age of 1 hour', () => {
      const slightlyOldTokens: AuthTokens = {
        ...mockTokens,
        extractedAt: Date.now() - 90 * 60 * 1000, // 90 minutes ago
      };
      const clientWithSlightlyOldTokens = new NotebookClient(slightlyOldTokens);

      expect(clientWithSlightlyOldTokens.needsTokenRefresh()).toBe(true);
    });
  });
});

describe('NotebookClient', () => {
  const mockTokens: AuthTokens = {
    cookies: {
      SID: 'test-sid',
      HSID: 'test-hsid',
      SSID: 'test-ssid',
      APISID: 'test-apisid',
      SAPISID: 'test-sapisid',
    },
    csrfToken: 'test-csrf-token',
    extractedAt: Date.now(),
    buildLabel: 'test-build-label',
    sessionId: 'test-session-id',
  };

  let client: NotebookClient;

  beforeEach(() => {
    mockFetch.mockClear();
    client = new NotebookClient(mockTokens);
  });

  describe('listNotebooks', () => {
    it('should return array of notebooks', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","wXbhsf","[[[\\"Notebook 1\\",[[[\\"src1\\",\\"Source 1\\"],[\\"src2\\",\\"Source 2\\"]],\\"nb1\\"],[\\"Notebook 2\\",[],\\"nb2\\"]]",null,null,null,"generic"]]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const notebooks = await client.listNotebooks();

      expect(Array.isArray(notebooks)).toBe(true);
      expect(notebooks).toHaveLength(2);
      expect(notebooks[0].id).toBe('nb1');
      expect(notebooks[0].title).toBe('Notebook 1');
      expect(notebooks[0].sourceCount).toBe(2);
      expect(notebooks[0].isOwned).toBe(true);
    });

    it('should return empty array for non-array response', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","wXbhsf","\\"not an array\\"",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const notebooks = await client.listNotebooks();

      expect(notebooks).toEqual([]);
    });

    it('should handle empty notebook list', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","wXbhsf","[]",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const notebooks = await client.listNotebooks();

      expect(notebooks).toEqual([]);
    });
  });

  describe('getNotebook', () => {
    it('should return notebook details', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","rLM1Ne","[[[\\"Test Notebook\\",[[[\\"src1\\",\\"Source 1\\"]],\\"nb123\\",null,null,[1,false,null,null,null,1234567890,null,null,1234560000]]]]",null,null,null,"generic"]]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const notebook = await client.getNotebook('nb123');

      expect(notebook.id).toBe('nb123');
      expect(notebook.title).toBe('Test Notebook');
      expect(notebook.sourceCount).toBe(1);
      expect(notebook.isOwned).toBe(true);
      expect(notebook.isShared).toBe(false);
    });

    it('should throw NotebookNotFoundError when notebook not found', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","rLM1Ne","null",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      await expect(client.getNotebook('nonexistent')).rejects.toThrow(NotebookNotFoundError);
    });
  });

  describe('createNotebook', () => {
    it('should create notebook with title', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","CCqFvf","[null,null,\\"new-nb-id\\",null]",null,null,null,"generic"]]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const notebook = await client.createNotebook('My New Notebook');

      expect(notebook.id).toBe('new-nb-id');
      expect(notebook.title).toBe('My New Notebook');
      expect(notebook.sourceCount).toBe(0);
    });

    it('should create notebook with default title', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","CCqFvf","[null,null,\\"new-nb-id\\",null]",null,null,null,"generic"]]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const notebook = await client.createNotebook();

      expect(notebook.title).toBe('Untitled notebook');
    });

    it('should throw error for invalid response', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","CCqFvf","null",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      await expect(client.createNotebook('Test')).rejects.toThrow('Failed to create notebook');
    });
  });

  describe('renameNotebook', () => {
    it('should rename notebook successfully', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","s0tc2d","\\"success\\"",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.renameNotebook('nb123', 'New Title');

      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","s0tc2d","null",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.renameNotebook('nb123', 'New Title');

      expect(result).toBe(false);
    });
  });

  describe('deleteNotebook', () => {
    it('should delete notebook successfully', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","WWINqb","\\"success\\"",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.deleteNotebook('nb123');

      expect(result).toBe(true);
    });

    it('should return false on failure', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","WWINqb","null",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.deleteNotebook('nb123');

      expect(result).toBe(false);
    });
  });

  describe('configureChat', () => {
    it('should configure chat with default goal', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","s0tc2d","\\"success\\"",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      await expect(
        client.configureChat('nb123', 'default', undefined, 'default')
      ).resolves.not.toThrow();
    });

    it('should configure chat with custom goal and prompt', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","s0tc2d","\\"success\\"",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      await expect(
        client.configureChat('nb123', 'custom', 'Custom prompt', 'longer')
      ).resolves.not.toThrow();
    });

    it('should throw error when customPrompt is required but missing', async () => {
      await expect(client.configureChat('nb123', 'custom')).rejects.toThrow(
        'customPrompt is required when goal is "custom"'
      );
    });

    it('should throw error when customPrompt exceeds 10000 chars', async () => {
      const longPrompt = 'a'.repeat(10001);

      await expect(
        client.configureChat('nb123', 'custom', longPrompt)
      ).rejects.toThrow('custom_prompt exceeds 10000 chars');
    });
  });

  describe('getNotebookSummary', () => {
    it('should return summary and suggested topics', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","VfAZjd","[[[\\"Summary text\\"],[[[\\"Question 1\\",\\"Prompt 1\\"],[\\"Question 2\\",\\"Prompt 2\\"]]]]",null,null,null,"generic"]]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getNotebookSummary('nb123');

      expect(result.summary).toBe('Summary text');
      expect(result.suggestedTopics).toHaveLength(2);
      expect(result.suggestedTopics[0].question).toBe('Question 1');
      expect(result.suggestedTopics[0].prompt).toBe('Prompt 1');
    });

    it('should return empty summary for invalid response', async () => {
      const mockResponse =
        '1\n[[["wrb.fr","VfAZjd","null",null,null,null,"generic"]]]';
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await client.getNotebookSummary('nb123');

      expect(result.summary).toBe('');
      expect(result.suggestedTopics).toEqual([]);
    });
  });

  describe('query', () => {
    beforeEach(() => {
      // Mock getNotebook for query tests
      const notebookResponse =
        '1\n[[["wrb.fr","rLM1Ne","[[[\\"Test Notebook\\",[[[\\"src1\\",\\"Source 1\\"]],\\"nb123\\"]]]",null,null,null,"generic"]]]]';
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi.fn().mockResolvedValue(notebookResponse),
        })
    });

    it('should return query result with answer', async () => {
      const queryResponse = ")]}'\n1\n[[\"wrb.fr\",\"testRpc\",\"[[\\\"This is the answer\\\"]]\",null,null,null,\"generic\"]]";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(queryResponse),
      });

      const result = await client.query('nb123', 'What is this?');

      expect(result.answer).toBe('This is the answer');
      expect(result.sourcesUsed).toContain('src1');
      expect(result.isFollowUp).toBe(false);
    });

    it('should use provided source IDs', async () => {
      const queryResponse = ")]}'\n1\n[[\"wrb.fr\",\"testRpc\",\"[[\\\"Answer\\\"]]\",null,null,null,\"generic\"]]";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(queryResponse),
      });

      const result = await client.query('nb123', 'Question', ['custom-source']);

      expect(result.sourcesUsed).toEqual(['custom-source']);
    });

    it('should handle conversation ID for follow-up', async () => {
      const queryResponse = ")]}'\n1\n[[\"wrb.fr\",\"testRpc\",\"[[\\\"Follow-up answer\\\"]]\",null,null,null,\"generic\"]]";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(queryResponse),
      });

      const result = await client.query('nb123', 'Follow-up', undefined, 'conv-123');

      expect(result.conversationId).toBe('conv-123');
    });

    it('should throw error on HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(client.query('nb123', 'Question')).rejects.toThrow('Query failed: HTTP 500');
    });
  });
});

describe('Error Classes', () => {
  it('should create APIError with correct properties', () => {
    const error = new APIError('Test error', 500, 'Detail', 'API_ERROR');

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(500);
    expect(error.detail).toBe('Detail');
    expect(error.code).toBe('API_ERROR');
    expect(error.name).toBe('APIError');
  });

  it('should create AuthenticationError with default message', () => {
    const error = new AuthenticationError();

    expect(error.message).toContain('Authentication failed');
    expect(error.statusCode).toBe(401);
    expect(error.code).toBe('AUTHENTICATION_ERROR');
    expect(error.name).toBe('AuthenticationError');
  });

  it('should create AuthenticationError with custom message', () => {
    const error = new AuthenticationError('Custom auth error');

    expect(error.message).toBe('Custom auth error');
  });

  it('should create RateLimitError with retry-after', () => {
    const error = new RateLimitError(undefined, 120);

    expect(error.message).toContain('Rate limit exceeded');
    expect(error.retryAfter).toBe(120);
    expect(error.statusCode).toBe(429);
    expect(error.name).toBe('RateLimitError');
  });

  it('should create NetworkError with original error', () => {
    const originalError = new Error('Connection refused');
    const error = new NetworkError(undefined, originalError);

    expect(error.message).toContain('Network error');
    expect(error.originalError).toBe(originalError);
    expect(error.statusCode).toBe(503);
    expect(error.name).toBe('NetworkError');
  });

  it('should create RPCError with all properties', () => {
    const error = new RPCError('RPC failed', 'rpcId123', 7, 'PERMISSION_DENIED', { detail: 'test' });

    expect(error.message).toBe('RPC failed');
    expect(error.rpcId).toBe('rpcId123');
    expect(error.errorCode).toBe(7);
    expect(error.detailType).toBe('PERMISSION_DENIED');
    expect(error.detailData).toEqual({ detail: 'test' });
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('RPCError');
  });

  it('should create CSRFExtractionError', () => {
    const error = new CSRFExtractionError('Failed to extract', '<html>...</html>');

    expect(error.message).toBe('Failed to extract');
    expect(error.htmlSnippet).toBe('<html>...</html>');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('CSRFExtractionError');
  });

  it('should create NotebookNotFoundError', () => {
    const error = new NotebookNotFoundError('nb123');

    expect(error.message).toBe('Notebook not found: nb123');
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOTEBOOK_NOT_FOUND');
    expect(error.name).toBe('NotebookNotFoundError');
  });

  it('should create RequestTimeoutError', () => {
    const error = new RequestTimeoutError(undefined, 30000);

    expect(error.message).toContain('timed out');
    expect(error.timeoutMs).toBe(30000);
    expect(error.statusCode).toBe(408);
    expect(error.name).toBe('RequestTimeoutError');
  });
});
