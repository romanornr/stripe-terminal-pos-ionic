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
    const token = await apiClient.getConnectionToken();
    
    console.log('Raw token response:', token); // Debug log
    
    expect(token).toBeDefined();
    // Check if token is an object with a secret property
    if (typeof token === 'object' && token !== null) {
      const tokenObj = token as { secret: string };
      expect(tokenObj.secret).toBeDefined();
      expect(typeof tokenObj.secret).toBe('string');
      expect(tokenObj.secret.length).toBeGreaterThan(0);
    } else {
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(0);
    }
  }, 10000);  // 10s timeout for real HTTP call

  it('should handle server errors gracefully', async () => {
    // Temporarily break the URL to test error handling
    const badClient = new ApiClient({
      ...apiClient['config'],
      baseUrl: 'http://localhost:4242/nonexistent'
    }, apiClient['logger']);

    await expect(badClient.getConnectionToken())
      .rejects
      .toThrow();
  });
}); 