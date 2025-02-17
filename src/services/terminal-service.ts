// src/services/terminal-service.ts
import { reactive, readonly } from 'vue';
import { DEFAULT_CONFIG, TerminalConfig } from '../config/config';
import { ConsoleLogger, type Logger, LogLevel } from '@/logger/Logger';
import { TerminalError } from '../types/terminalTypes';
import type { Reader } from '@/types/terminalTypes';
import { ApiClient } from './api-client';

// We have to declare stripeTerminal as "any" because it's a global from the <script> tag
// This should be resolved in a future version of the Stripe Terminal SDK
declare const StripeTerminal: any;

export class TerminalService {
  // Reactive state that can bind to the UI
  private state = reactive({
    isInitialized: false,
    isLoading: false,
    isConnected: false,
    lastError: null as string | null,
    currentReader: null as Reader | null,
    availableReaders: [] as Reader[],
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
      // Create the stripe Terminal instnace using the ApiClient for fetching the connection token
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
      this.logger.info('Discovering readers...');
      //const locationId = await this.getLocationId();
      // for now, simulate discovery readers
      const readers: Reader[] = [
        {
          id: 'reader1',
          object: 'reader',
          action: null,
          base_url: 'https://example.com',
          device_sw_version: '1.0.0',
          device_type: 'chipper2x',
          ip_address: '192.168.1.1',
          label: 'Reader 1',
          last_seen_at: 1713331200,
          livemode: true,
          location: '123 Main St',
          metadata: {},
          serial_number: '1234567890',
          status: 'online',
        }
      ]
      // **Update the state to reflect the available readers**
      this.state.availableReaders = readers;
      console.log('Terminal service: Available readers:', this.state.availableReaders);
      return { success: true, data: readers };
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
      this.logger.info('Connecting to reader...', { readerId: reader.id });
      // simulate connection delay
      await new Promise(resolve => setTimeout(resolve, 500));
      // mark reader as connected
      this.state.currentReader = reader;
      this.state.isConnected = true;
      return { success: true, data: reader };
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
      // simulate disconnection delay
      await new Promise(resolve => setTimeout(resolve, 500));
      // reset current reader
      this.state.currentReader = null;
    } catch (error: any) {
      const terminalError = new TerminalError('READER_DISCONNECTION_FAILED', error instanceof Error ? error.message : String(error));
      this.state.lastError = terminalError.message;
    } finally {
      this.state.isLoading = false;
    }
  }
}

export const terminalService = new TerminalService();


