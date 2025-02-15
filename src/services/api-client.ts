// src/services/api-client.ts

import axios, { AxiosInstance } from 'axios';
import { DEFAULT_CONFIG, TerminalConfig } from '@/config/config';
import type { Logger } from '@/logger/Logger';
import type { PaymentIntent, Result } from '@/types/terminalTypes';
import { TerminalError } from '@/types/terminalTypes';

export class ApiClient {
  private readonly client: AxiosInstance;

  constructor(
    private readonly config: TerminalConfig = DEFAULT_CONFIG,
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
  async getConnectionToken(): Promise<Result<string>> {
    try {
      this.logger.debug('Fetching connection token from', this.config.baseUrl);
      const { data } = await this.client.post<{ data: { secret: string }, error: null | string }>(
        this.config.endpoints.connectionToken
      );

      this.logger.debug('Connection token:', data);
      if (!data?.data?.secret) {
        throw new TerminalError('CONNECTION_TOKEN_FAILED', 'Invalid response structure');
      }
      return { success: true, data: data.data.secret };
    } catch (error) {
      return {
        success: false,
        error: error instanceof TerminalError ? error : new TerminalError('CONNECTION_TOKEN_FAILED', 'An unknown error occurred')
      }
    }
  }

  async getLocationId(): Promise<string> {
    try {
      this.logger.debug('Fetching location ID from', this.config.baseUrl);
      const { data } = await this.client.get<{ data?: { location_id?: string } }>(
        this.config.endpoints.locationId
      )

      this.logger.debug('Location ID:', data);
      if (!data?.data?.location_id) throw new Error('Invalid response structure');
      return data.data.location_id;
    } catch (error) {
      this.logger.error('Error fetching location ID:', error);
      throw error;
    }
  }

  async createPaymentIntent(amount: number, currency: string = this.config.currency): Promise<PaymentIntentResponse> {
    try {
      const amountInCents = Math.round(amount * 100);
      this.logger.debug('Creating payment intent...', { amountInCents, currency});
      const { data } = await this.client.post<{data?: PaymentIntent }> (
        this.config.endpoints.paymentIntent, { amount: amountInCents, currency }
      );
      if (!data?.data?.client_secret) throw new Error('Invalid payment intent response');
      return { success: true, data: data.data }
    } catch (error) {
      return { success: false, error: error as string || 'An unknown error occurred' };
    }
  }
}