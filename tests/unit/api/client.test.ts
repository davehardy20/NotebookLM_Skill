/**
 * Unit tests for API Client
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NotebookClient } from '../../../src/api/notebooks.js';
import {
  AuthenticationError,
  CSRFExtractionError,
  NetworkError,
  RateLimitError,
} from '../../../src/api/errors.js';
import type { AuthTokens } from '../../../src/api/types.js';

const mockFetch = vi.fn();
global.fetch = mockFetch;

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

  describe('Error Handling', () => {
    it('should throw AuthenticationError on 401', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.callRPC({ rpcId: 'rpc', params: [] })).rejects.toThrow(
        AuthenticationError
      );
    });

    it('should succeed after RateLimitError retry', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests',
          headers: new Headers({ 'retry-after': '0' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: vi
            .fn()
            .mockResolvedValue(
              '1\n[[["wrb.fr","rpc","[[\"success\"]]",null,null,null,"generic"]]]\n'
            ),
        });

      const result = await client.callRPC({ rpcId: 'rpc', params: [] });
      expect(result).toEqual(['success']);
    });

    it('should throw NetworkError on persistent fetch failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('fetch failed'));

      await expect(client.callRPC({ rpcId: 'rpc', params: [] })).rejects.toThrow(NetworkError);
    }, 30000);

    it('should throw CSRFExtractionError when CSRF token is missing', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('<html>No CSRF token here</html>'),
      });

      await expect(client.refreshCSRFToken()).rejects.toThrow(CSRFExtractionError);
    });
  });
});
