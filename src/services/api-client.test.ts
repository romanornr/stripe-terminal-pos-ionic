import { ApiClient } from './api-client';
import { TerminalConfig } from '@/config/config';
import { Logger } from '@/logger/Logger';
import axios from 'axios';
import { vi, describe, it, beforeEach, expect } from 'vitest';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: vi.fn()
    }))
  }
}));

describe('ApiClient', () => {
  let apiClient: ApiClient;
  let mockConfig: TerminalConfig;
  let mockLogger: Logger;
  let mockPost: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      baseUrl: 'http://mock-url',
      timeoutMs: 5000,
      currency: 'eur',
      logLevel: 'info',
      endpoints: {
        connectionToken: '/connection-token',
        locationId: '/get-location-id',
        paymentIntent: '/create-payment-intent'
      }
    };
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };
    mockPost = vi.fn();
    vi.mocked(axios.create).mockReturnValue({ post: mockPost } as any);
    apiClient = new ApiClient(mockConfig, mockLogger);
  });

  describe('getConnectionToken', () => {
    it('should successfully fetch and return a valid connection token', async () => {
      const mockSecret = 'mock_secret_token';
      mockPost.mockResolvedValueOnce({ 
        data: { 
          data: { secret: mockSecret },
          error: null
        } 
      });

      const result = await apiClient.getConnectionToken();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(mockSecret);
      }
      expect(mockPost).toHaveBeenCalledWith(mockConfig.endpoints.connectionToken);
      expect(mockLogger.debug).toHaveBeenCalledWith('Fetching connection token from', mockConfig.baseUrl);
    });

    it('should return error when response structure is invalid', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      const result = await apiClient.getConnectionToken();
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBe('CONNECTION_TOKEN_FAILED');
      }
    });

    it('should return error when API call fails', async () => {
      const mockError = new Error('Network error');
      mockPost.mockRejectedValueOnce(mockError);

      const result = await apiClient.getConnectionToken();
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error.code).toBe('CONNECTION_TOKEN_FAILED');
      }
    });
  });
});

