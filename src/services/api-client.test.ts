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
      mockPost.mockResolvedValueOnce({ data: { data: mockSecret } });

      const result = await apiClient.getConnectionToken();

      expect(result).toBe(mockSecret);
      expect(mockPost).toHaveBeenCalledWith(mockConfig.endpoints.connectionToken);
      expect(mockLogger.debug).toHaveBeenCalledWith('Fetching connection token from', mockConfig.baseUrl);
    });

    it('should throw error when response structure is invalid', async () => {
      mockPost.mockResolvedValueOnce({ data: {} });

      await expect(apiClient.getConnectionToken()).rejects.toThrow('Invalid response structure');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should throw error when API call fails', async () => {
      const mockError = new Error('Network error');
      mockPost.mockRejectedValueOnce(mockError);

      await expect(apiClient.getConnectionToken()).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalledWith('Error fetching connection token:', mockError);
    });
  });
});

