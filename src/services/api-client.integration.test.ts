import { ApiClient } from './api-client';
import { TerminalConfig } from '@/config/config';
import { Logger } from '@/logger/Logger';
import { describe, it, expect, beforeAll } from 'vitest';
import { DEFAULT_CONFIG } from '@/config/config';

describe('ApiClient Integration Tests', () => {
  let apiClient: ApiClient;

  beforeAll(() => {
    // Create real config pointing to your local server
    const config: TerminalConfig = {
      baseUrl: 'http://localhost:4242',  // Make sure your server is running on this port
      timeoutMs: 5000,
      currency: 'eur',
      logLevel: 'info',
      endpoints: {
        connectionToken: DEFAULT_CONFIG.endpoints.connectionToken,
        locationId: DEFAULT_CONFIG.endpoints.locationId,
        paymentIntent: DEFAULT_CONFIG.endpoints.paymentIntent
      }
    };

    // Real logger for debugging
    const logger: Logger = {
      debug: (...args) => console.log('[DEBUG]', ...args),
      info: (...args) => console.log('[INFO]', ...args),
      warn: (...args) => console.log('[WARN]', ...args),
      error: (...args) => console.log('[ERROR]', ...args)
    };

    apiClient = new ApiClient(config, logger);
  });

  it('should fetch a real connection token from server', async () => {
    const result = await apiClient.getConnectionToken();
    
    // Log the response for debugging
    console.log('Raw response:', result);
    
    if (!result.success) {
      console.error('Error code:', result.error.code);
      console.error('Error message:', result.error.message);
      console.error('Original error:', result.error.originalError);
      throw new Error(`Failed to get connection token: ${result.error.message}`);
    }
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(typeof result.data).toBe('string');
  }, 10000);

  it('should handle server errors gracefully', async () => {
    const badClient = new ApiClient({
      ...apiClient['config'],
      baseUrl: 'http://localhost:4242/nonexistent'
    }, apiClient['logger']);

    const result = await badClient.getConnectionToken();
    expect(result.success).toBe(false);
    if (!result.success) {  // Type guard
      expect(result.error).toBeDefined();
      expect(result.error.code).toBe('CONNECTION_TOKEN_FAILED');
    }
  });
}); 