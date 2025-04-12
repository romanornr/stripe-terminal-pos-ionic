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
      timeout: config.httpTimeoutMs,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Fetches a connection token from the server.
   * @returns A promise that resolves to the connection token.
   */
  async getConnectionToken(): Promise<Result<string>> {
    try {
      this.logger.debug('Fetching connection token from', this.config.baseUrl);
      const { data } = await this.client.post<{ secret: string } | { data: { secret: string }, error: null | string }>(
        this.config.endpoints.connectionToken
      );

      this.logger.debug('Connection token response:', data);
      
      if ('secret' in data) {
        return { success: true, data: data.secret };
      } else {
        throw new TerminalError('CONNECTION_TOKEN_FAILED', 'Invalid response structure');
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof TerminalError ? error : new TerminalError('CONNECTION_TOKEN_FAILED', 'An unknown error occurred')
      }
    }
  }

  async getLocationId(): Promise<Result<string>> {
    try {
      this.logger.debug('Fetching location ID from', this.config.baseUrl);
      const { data } = await this.client.get<{ data?: { location_id?: string } }>(
        this.config.endpoints.locationId
      )
      this.logger.debug('Location ID response:', data);
      if (!data?.data?.location_id) {
        throw new TerminalError('READER_CONNECTION_FAILED', 'Invalid location ID response');
      }
      return { success: true, data: data.data.location_id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof TerminalError ? error : new TerminalError('READER_CONNECTION_FAILED', 'An unknown error occurred')
      }
    }
  }

  async createPaymentIntent(amount: number, currency: string = this.config.currency): Promise<Result<PaymentIntent>> {
    try {
      const amountInCents = Math.round(amount * 100);
      this.logger.debug('Creating payment intent...', { amountInCents, currency});
      const { data } = await this.client.post<{data?: PaymentIntent, error: null | string }> (
        this.config.endpoints.paymentIntent, { amount: amountInCents, currency }
      );
      if (!data?.data?.client_secret) {
        throw new TerminalError('PAYMENT_INTENT_FAILED', 'Invalid payment intent response');
      }
      return { success: true, data: data.data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof TerminalError ? error : new TerminalError('PAYMENT_INTENT_FAILED', 'An unknown error occurred')
      }
    }
  }
}