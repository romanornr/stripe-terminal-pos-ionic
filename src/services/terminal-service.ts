// src/services/terminal-service.ts
import { reactive, readonly } from 'vue';
import { DEFAULT_CONFIG, TerminalConfig } from '../config/config';
import { ConsoleLogger, type Logger, LogLevel } from '@/logger/Logger';
import { TerminalError } from '../types/terminalTypes';
import type { Reader, PaymentIntent, Result, CollectResult, ProcessPaymentResult } from '@/types/terminalTypes';
import { ApiClient } from './api-client';

// We have to declare stripeTerminal as "any" because it's a global from the <script> tag
// This should be resolved in a future version of the Stripe Terminal SDK
declare const StripeTerminal: any;

// Default payment timeout in milliseconds from the config 
const DEFAULT_PAYMENT_TIMEOUT_MS = DEFAULT_CONFIG.timeoutMs;

export class TerminalService {
  // Reactive state that can bind to the UI
  private state = reactive({
    isInitialized: false,
    isLoading: false,
    isConnected: false,
    lastError: null as string | null,
    currentReader: null as Reader | null,
    availableReaders: [] as Reader[],
    lastPaymentIntent: null as PaymentIntent | null
  })

  private logger: Logger;
  private config: TerminalConfig;
  private apiClient: ApiClient;
  private terminal: any = null;

  constructor(config: TerminalConfig = DEFAULT_CONFIG) {
    this.config = config;
    this.logger = new ConsoleLogger(config.logLevel as LogLevel);
    this.apiClient = new ApiClient(config, this.logger);
  }

  // Expose a read-only view of state for components
  get terminalState() {
    return readonly(this.state);
  }

  async initialize() {
    this.state.isLoading = true;
    try {
      this.logger.info('Initializing terminal service...');
      // Create the stripe Terminal instance using the ApiClient for fetching the connection token
      this.terminal = StripeTerminal.create({
        onFetchConnectionToken: async () => {
          const result = await this.apiClient.getConnectionToken();
          if (result.success) {
            this.logger.info('Connection token fetched successfully');
            return result.data;
          } else {
            throw new Error(result.error.message);
          }
        },
        onUnexpectedReaderDisconnect: () => {
          this.state.isConnected = false;
          this.state.currentReader = null;
          this.state.lastError = 'Reader disconnected unexpectedly';
          this.logger.warn('Reader disconnected unexpectedly');
        }
      });
      await new Promise(resolve => setTimeout(resolve, 500));
      this.state.isInitialized = true;
      this.logger.info('Terminal service initialized successfully');
    } catch (error: any) {
      this.state.lastError = error.message || String(error);
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  async discoverReaders(): Promise<{ success: true; data: Reader[] } | { success: false; error: TerminalError }> {
    this.state.isLoading = true;
    try {
      this.logger.info('Discovering readers using terminal instance...');

      // Attempt to get the location ID; if it fails, it will be caught below
      const locationId = await this.apiClient.getLocationId();
      if (!locationId.success) {
        throw new TerminalError('LOCATION_ID_FETCH_FAILED', locationId.error.message);
      }

      // Discover readers
      const discoverResult = await this.terminal.discoverReaders({ location: locationId.data });
      if (discoverResult.error) {
        throw new TerminalError('NO_READERS_FOUND', discoverResult.error.message);
      }

      const readers: Reader[] = discoverResult.discoveredReaders || [];
      this.logger.info('Discovered readers:', readers);
      this.state.availableReaders = readers;
      return { success: true, data: this.state.availableReaders };
    } catch (error: unknown) {
      const terminalError = new TerminalError('NO_READERS_FOUND', error instanceof Error ? error.message : String(error));
      this.state.lastError = terminalError.message;
      return { success: false, error: terminalError };
    } finally {
      this.state.isLoading = false;
    }
  }

  async connectReader(reader: Reader): Promise<{ success: true; data: Reader } | { success: false; error: TerminalError }> {
    this.state.isLoading = true;
    try {
      this.logger.info('Connecting to reader via SDK...', { readerId: reader.id });
      //await new Promise(resolve => setTimeout(resolve, 500)); // simulate connection delay
      const connectResult = await this.terminal.connectReader(reader)
      if (connectResult.error) {
        throw new TerminalError('READER_CONNECTION_FAILED', connectResult.error)
      }

      // Update the current reader in state
      // Note: connectResult.reader is the reader object returned by the SDK
      this.state.currentReader = connectResult.reader || reader; // update the current reader in state
      if (!this.state.currentReader) { // sanity check
        throw new TerminalError('READER_CONNECTION_FAILED', 'No reader connected');
      }

      this.state.isConnected = true;
      this.logger.info('Connected to reader successfully');
      return { success: true, data: this.state.currentReader };
    } catch (error: any) {
      const terminalError = new TerminalError('READER_CONNECTION_FAILED', error instanceof Error ? error.message : String(error));
      this.state.lastError = terminalError.message;
      return { success: false, error: terminalError };
    } finally {
      this.state.isLoading = false;
    }
  }

  async connectAndInitializeReader(): Promise<Reader> {
    // Ensure terminal is initialized first
    if (!this.state.isInitialized) {
      await this.initialize();
    }

    // Wait a brief moment to ensure state propagation
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check if already connected and disconnect first
    if (this.state.isConnected) {
      await this.disconnect();
    }

    // Discover readers
    const discoverResult = await this.discoverReaders();
    if (!discoverResult.success || discoverResult.data.length === 0) {
      throw new TerminalError('NO_READERS_FOUND', 'No available readers found');
    }

    // Auto-connect to the first reader available
    const readerToConnect = discoverResult.data[0];
    const connectResult = await this.connectReader(readerToConnect);
    if (!connectResult.success) {
      throw new TerminalError('READER_CONNECTION_FAILED', connectResult.error.message);
    }

    return connectResult.data;
  }

  async disconnect(): Promise<void> {
    this.state.isLoading = true; 
    try {
      this.logger.info('Disconnecting from reader...');
      await new Promise(resolve => setTimeout(resolve, 500)); // simulate disconnection delay
      await this.terminal.disconnectReader();
      this.state.currentReader = null; // reset current reader
    } catch (error: any) {
      const terminalError = new TerminalError('READER_DISCONNECTION_FAILED', error instanceof Error ? error.message : String(error));
      this.state.lastError = terminalError.message;
    } finally {
      this.state.isLoading = false;
    }
  }

  async createPaymentIntent(amount: number, currency?: string): Promise<Result<PaymentIntent>> {
    this.state.isLoading = true;
    try {
      this.logger.info('Creating payment intent...', { amount, currency: currency || this.config.currency });
      const result = await this.apiClient.createPaymentIntent(amount, currency || this.config.currency);
      
      if (!result.success) {
        return { 
          success: false, 
          error: new TerminalError('PAYMENT_INTENT_FAILED', result.error?.message || 'Failed to create payment intent') 
        };
      }

      this.state.lastPaymentIntent = result.data;
      return { success: true, data: result.data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to create payment intent';
      return { 
        success: false, 
        error: new TerminalError('PAYMENT_INTENT_FAILED', message)
      };
    } finally {
      this.state.isLoading = false;
    }
  }

  async collectPaymentMethod(clientSecret: string, timeoutMs: number = DEFAULT_PAYMENT_TIMEOUT_MS): Promise<CollectResult> {
    if (!this.terminal) {
      throw new TerminalError('PAYMENT_COLLECTION_FAILED', 'Terminal is not initialized');
    }

    try { 
      this.logger.info('Starting payment collection with client secret:', clientSecret);
      const collectResult = await this.terminal.collectPaymentMethod(clientSecret);

      this.logger.info('Collection result:', JSON.stringify(collectResult, null, 2));

      return { success: true, data: collectResult.paymentIntent };
    } catch (error) {
      this.state.lastError = error instanceof Error ? error.message : String(error);
      console.warn('Error during payment collection', error);
      // this is a hack to get the error message to the UI. It's not a good practice to do this. Better would be to use a global error handler.
      // TODO: Implement a global error handler
      // TODO: Add a timeout to the payment collection
      return { success: false, error: new TerminalError('PAYMENT_COLLECTION_FAILED', error instanceof Error ? error.message : 'Payment collection failed') }
    }
  }

  // async collectPaymentMethod(clientSecret: string, timeoutMs: number = DEFAULT_PAYMENT_TIMEOUT_MS): Promise<CollectResult> {
  //   if(!this.terminal) {
  //     throw new Error('Terminal is not initialized');
  //   }

  //   let collectionStarted = false;
  //   try {
  //     this.logger.info('Collecting payment method...')
  //     collectionStarted = true;
  //     const result = await this.withTimeout(
  //       this.terminal.collectPaymentMethod(clientSecret),
  //       timeoutMs,
  //       new Error('Payment collection timed out')
  //     ) as CollectResult;
  //     if (!result.success) {
  //       throw new TerminalError('PAYMENT_COLLECTION_FAILED', 'Payment collection failed');
  //     }
  //     return result;
  //   } catch (error: unknown) {
  //     this.logger.warn('Error during payment collection', error);
  //     if (collectionStarted) {
  //       try {
  //         await this.terminal.cancelCollectPaymentMethod();
  //       } catch (cancelError) {
  //         this.logger.warn('Error cancelling payment collection', cancelError);
  //       }
  //     }
  //     throw error instanceof TerminalError ? error : new TerminalError('PAYMENT_COLLECTION_FAILED', error instanceof Error ? error.message : 'Unknown error during payment collection');
  //   }
  // }

  async processPayment(paymentIntent: PaymentIntent): Promise<ProcessPaymentResult<PaymentIntent>> {
    this.state.isLoading = true;
    try {
      this.logger.info('Processing payment...', { paymentIntentId: paymentIntent.id });
      const result = await this.terminal.processPayment(paymentIntent);
      if (result.error) {
        throw new TerminalError('PAYMENT_PROCESSING_FAILED', result.error.message);
      }
      this.logger.info('Payment processed successfully:', result.paymentIntent);
      return { success: true, paymentIntent: result.paymentIntent };
    } catch(error: any) {
      this.state.lastError = error instanceof Error ? error.message : String(error);
      return { success: false, error: new TerminalError('PAYMENT_PROCESSING_FAILED', error instanceof Error ? error.message : 'Payment processing failed') }
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Helper function to handle timeouts for terminal operations
   * @param promise - The promise to handle
   * @param timeoutMs - The timeout in milliseconds
   * @param timeOutError - The error to throw if the operation times out (default is a generic timeout error)
   * @returns A promise that resolves to the result of the operation
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeOutError?: Error): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;
    const errorToThrow = timeOutError || new Error('Operation timed out');
    return new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(errorToThrow), timeoutMs);
      promise.then(resolve).catch(reject).finally(() => clearTimeout(timeoutId));
    })
  }
}

export const terminalService = new TerminalService();


