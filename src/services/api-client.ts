// src/services/api-client.ts

import axios, { AxiosInstance } from 'axios';
import type { TerminalConfig } from '@/config/config';
import type { Logger } from '@/logger/Logger';

export class ApiClient {
  private readonly client: AxiosInstance;

  constructor(
    private readonly config: TerminalConfig,
    private readonly logger: Logger
  ) {
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Fetches a connection token from the server.
   * @returns A promise that resolves to the connection token.
   * @throws An error if the response structure is invalid.
   */
  async getConnectionToken(): Promise<string> {
    try {
      this.logger.debug('Fetching connection token from', this.config.baseUrl);
      const { data } = await this.client.post<{ data?: string }>(
        this.config.endpoints.connectionToken
      );

      this.logger.debug('Connection token:', data);
      if (!data?.data) throw new Error('Invalid response structure');
      return data.data;
    } catch (error) {
      this.logger.error('Error fetching connection token:', error);
      throw error;
    }
  }

}