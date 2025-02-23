import { json } from 'stream/consumers';
import { ref, reactive, toRefs } from 'vue';
import { Logger, ConsoleLogger } from '../logger/Logger';
import { DEFAULT_CONFIG } from '@/config/config';

// -- INTERFACES --

interface StripeTerminalOptions {
  onFetchConnectionToken: () => Promise<string>;
  onUnexpectedReaderDisconnect: () => void;
  onReaderDisconnected: () => void;
}

interface Reader {
  id: string;
  object: string; // It's always 'terminal.reader'
  action: any; // come back to this - it might be a null or an object representing the action
  base_url: string;
  device_sw_version: string;
  device_type: string;
  ip_address: string;
  label: string;
  last_seen_at: number;
  livemode: boolean;
  location: string;
  metadata: {};
  serial_number: string;
  status: string;
}

interface DiscoverReaderOptions {
  location: string;
}

interface DiscoverResult {
  error?: { message: string };
  discoveredReaders?: Reader[];
}

interface ConnectResult {
  error?: { message: string };
  reader?: Reader;
}

interface CollectResult {
  error?: { message: string };
  paymentIntent: PaymentIntent;
}

interface ProcessPaymentResult {
  error?: { message: string };
  paymentIntent?: PaymentIntent;
}

interface PaymentIntent {
  id: string;
  object: string;
  amount: number;
  currency: string;
  status: string;
  client_secret: string;
  amount_capturable: number;
  amount_received: number;
  capture_method: string;
  confirmation_method: string;
  created: number;
  livemode: boolean;
  payment_method: any;
  payment_method_types: string[];
  processing: any;
  metadata: Record<string, any>;
  // Add other optional properties
  description?: string;
  shipping?: any;
  receipt_email?: string;
  last_payment_error?: any;
}

// Constants for API endpoints
const API_BASE_URL =  DEFAULT_CONFIG.baseUrl //'http://localhost:4242';
const CONNECTION_TOKEN_ENDPOINT = `${API_BASE_URL}${DEFAULT_CONFIG.endpoints.connectionToken}`;
const GET_LOCATION_ID_ENDPOINT = `${API_BASE_URL}${DEFAULT_CONFIG.endpoints.locationId}`;
const CREATE_PAYMENT_INTENT_ENDPOINT = `${API_BASE_URL}${DEFAULT_CONFIG.endpoints.paymentIntent}`;
const DEFAULT_PAYMENT_TIMEOUT_MS = DEFAULT_CONFIG.timeoutMs;

const logger: Logger = new ConsoleLogger('debug')

// We have to declare stripeTerminal as "any" because it's a global from the <script> tag
// This should be resolved in a future version of the Stripe Terminal SDK
declare const StripeTerminal: any;

interface TerminalState {
  isConnected: boolean;
  isLoading: boolean;
  lastError: string | null;
  currentReader: Reader | null;
}

/**
 * StripeTerminalService
 * 
 * Abstracts away:
 *  - The Stripe Terminal SDK
 *  - Terminal init 
 *  - Connection token fetching
 *  - Reader discovery + connection
 *  - Payment intent creation
 *  - Payment collection + processPayment with auto-cancel
 *  - (optional) readers/cancel-action route
 */
class StripeTerminalService {
  private terminal: any = null;
  private locationId: string | null = null;

  private state = reactive<TerminalState>({
    isConnected: false,
    isLoading: false,
    lastError: null,
    currentReader: null,
  });

  // Expose the state as refs for readonly access
  public readonly stateRefs = toRefs(this.state);

  /** Base URL for your backend server */
  private baseUrl = API_BASE_URL //'http://localhost:4242';

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }


    /**
   * Initializes the Stripe Terminal (creates the Terminal instance)
   * 
   * @returns Promise<void>
   * @throws Error if the terminal initialization fails
   */
  async initialize(): Promise<void> {
    if (this.terminal) return this.terminal;

    this.state.isLoading = true;
    this.state.lastError = null;

    logger.info('ConsoleLogger initialized successfully')

    try {
      this.terminal = StripeTerminal.create({
        onFetchConnectionToken: async () => {
          const response = await fetch(CONNECTION_TOKEN_ENDPOINT, { method: 'POST' });
          const responseJson = await response.json();
          if (!responseJson.data?.secret) {
            throw new Error('Invalid connection token response: missing secret')
          }
          console.log('Response from connection token endpoint', responseJson)
          return responseJson.data?.secret;
        },
        onUnexpectedReaderDisconnect: () => {
          console.log('Reader disconnected unexpectedly');
          this.state.isConnected = false;
          this.state.currentReader = null;
        }
      });
      // Pre-fetch the locationId (if needed)
      await this.getLocationId();
    } catch (error: any) {
      this.handleError(error, 'Failed to initialize Stripe Terminal');
      //console.error('Failed to initialize Stripe Terminal', error.message || error);
      this.state.lastError = error.message || String(error)
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Fetches the location ID from the backend
   * @returns Promise<string> - The location ID
   * @throws Error if the location ID is invalid or retrieval fails
   */
  async getLocationId(): Promise<string> {
    if (this.locationId) return this.locationId;

    this.state.isLoading = true;
    this.state.lastError = null;

    try {
      const response = await fetch(GET_LOCATION_ID_ENDPOINT);
      const responseJson = await response.json();
      const locationId = responseJson.data.location_id || responseJson.locationId;

      if (typeof locationId !== 'string' || locationId.trim() === '') {
        throw new Error('Invalid location ID received from backend');
      }
      this.locationId = locationId // store the locationId
      return locationId;
    } catch (error) {
      this.handleError(error, 'Failed to get location ID');
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Finds an available reader
   * @returns Promise<Reader | null> - The discovered reader or null if no reader is found
   * @throws Error if the reader discovery fails
   */
  async findAvailableReader(): Promise<Reader | null> {
    if (!this.terminal) await this.initialize();
    this.state.isLoading = true;
    this.state.lastError = null;

    try {
      const locationId = await this.getLocationId();
      const discoverResult = await this.terminal.discoverReaders({ location: locationId });
      if (discoverResult.error) {
        throw new Error(`Error discovering readers: ${discoverResult.error.message}`);
      }

      // Return the first reader if available
      return discoverResult.discoveredReaders?.[0] || null;
    } catch (error) {
      this.handleError(error, 'Failed to discover readers');
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Connects to a reader
   * @param reader - The reader to connect to
   * @returns Promise<Reader> - The connected reader
   * @throws Error if the reader connection fails
   */
  async connectToReader(reader: Reader): Promise<Reader> {
    if (!this.terminal) {
      await this.initialize();
      if (!this.terminal) throw new Error('Terminal initialization failed');
    }

    // if already connected to the same reader, return it immediately
    if (this.state.isConnected && this.state.currentReader?.id == reader.id) {
      return reader;
    }

    try {
      const connectResult = await this.terminal.connectReader(reader);

      if (connectResult.error) throw new Error(`Error connecting to reader: ${connectResult.error.message}`);

      this.state.currentReader = connectResult.reader || reader;
      this.state.isConnected = true;

      // if state.currentReader is still null, throw an error
      if (!this.state.currentReader) {
        throw new Error('Failed to connect: No reader available');
      }

      console.log('Connected to reader successfully', this.state.currentReader);
      return this.state.currentReader;
    } catch (error) {
      this.handleError(error, 'Failed to connect to reader');
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Connects and initializes the reader
   * @returns Promise<any> - The connected reader
   * @throws Error if the reader connection fails
   */
  async connectAndInitializeReader(): Promise<Reader> {
    if (!this.terminal) await this.initialize();

    try {
      // Check if already connected and disconnect first
      if (this.terminal.getConnectionStatus() === 'connected') {
        console.log('Disconnecting from existing reader...');
        await this.terminal.disconnectReader();
        this.state.isConnected = false;
        this.state.currentReader = null;
      }

      const reader = await this.findAvailableReader();
      const connectResult = await this.terminal.connectReader(reader);
      
      if (connectResult.error) {
        throw new Error(`Error connecting to reader: ${connectResult.error.message}`);
      }

      this.state.currentReader = connectResult.reader || reader;
      this.state.isConnected = true;
      console.log('Connected to reader successfully', this.state.currentReader);
      
      if (!this.state.currentReader) {
        throw new Error('Failed to connect: No reader available');
      }
      return this.state.currentReader;
    } catch (error) {
      this.handleError(error, 'Failed to connect to reader');
      throw error;
    }
  }

  /**
   * Creates a payment intent with the specified amount
   * @param amount - The payment amount in whole currency units (e.g., euros)
   * @returns Promise<string> - The client secret for the payment intent
   * @throws Error if the payment intent creation fails
   */
  async createPaymentIntent(amount: number): Promise<string> {
    this.state.isLoading = true;
    this.state.lastError = null;

    try {
      const amountInCents = Math.round(amount * 100);
      console.log('Creating payment intent for amount:', amountInCents);

      const response = await fetch(CREATE_PAYMENT_INTENT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({amount: amountInCents, currency: 'eur'}),
      });

      const responseJson = await response.json();
      console.log('Server response payment intent:', responseJson);
      const clientSecret = responseJson.data?.client_secret;
      if (!clientSecret) {
        throw new Error('Failed to create payment intent or missing client secret');
      }
      return clientSecret;
    } catch (error) {
      this.handleError(error, 'Error creating payment intent');
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Helper function to handle timeouts
   * @param promise - The promise to handle
   * @param timeoutMs - The timeout in milliseconds
   * @param timeoutError - The error to throw if the operation times out
   * @returns Promise<T> - The result of the promise
   */
  private withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    timeoutError?: Error
  ): Promise<T> {
    let timeoutId: NodeJS.Timeout;
    const error = timeoutError || new Error('Operation timed out');

    return new Promise<T>((resolve, reject) => {
      timeoutId = setTimeout(() => reject(error), timeoutMs);
      promise.then(resolve, reject);
    }).finally(() => {
      clearTimeout(timeoutId);
    });
  }

  /**
   * Collects the payment method using the Stripe Terminal
   * Note: Stripe Terminal SDK does not support AbortController for cancellation.
   * We use a custom timeout implementation with Promise.race instead.
   * 
   * @param clientSecret - The client secret for the payment intent
   * @param timeoutMs - The timeout in milliseconds
   * @returns Promise<PaymentIntent> - The payment intent
   * @throws Error if the payment collection fails or times out
   */
  async collectPaymentMethod(clientSecret: string, timeoutMs: number = DEFAULT_PAYMENT_TIMEOUT_MS): Promise<PaymentIntent> {
    if (!this.terminal) {
      throw new Error('Terminal is not initialized');
    }

    console.log('Starting to collect payment...');

    try {
      const result = await this.withTimeout(
        this.terminal.collectPaymentMethod(clientSecret),
        timeoutMs,
        new Error('Payment collection timed out')
      ) as CollectResult;

      console.log('CollectPaymentMethod succeeded, returning payment intent');
      return result.paymentIntent;
    } catch (error) {
      console.warn('Error during payment collection', error);
      console.log('Attempting to cancel collectPaymentMethod now...');
      try {
        await this.terminal.cancelCollectPaymentMethod();
        console.log('collectPaymentMethod cancelled successfully');
      } catch (cancelError) {
        console.warn('Error cancelling collectPaymentMethod', cancelError);
      }
      throw error;
    }
  }

  /**
   * Processes the payment using the Stripe Terminal
   * @param paymentIntent - The payment intent to process
   * @returns Promise<ProcessPaymentResult> - The result of the payment processing
   * @throws Error if the payment processing fails
   */
  async processTerminalPayment(paymentIntent: PaymentIntent): Promise<ProcessPaymentResult> {
    if (!this.terminal) {
      await this.initialize();
      if (!this.terminal) throw new Error('Terminal is not initialized');
    }

    this.state.isLoading = true;
    this.state.lastError = null;

    try {
      const processResult = await this.terminal.processPayment(paymentIntent)
      if (processResult.error) {
        throw new Error(`Error processing payment: ${processResult.error.message}`);
      }
      console.log('Payment processed successfully:', processResult);
      return processResult;
    } catch (error) {
      this.handleError(error, 'Error processing payment');
      throw error;
    } finally {
      this.state.isLoading = false;
    }
  }

  /**
   * Centralized error handling
   * @param error - The error to handle
   * @param message - Optional additional error message
   * @private
   */
  private handleError(error: any, message?: string): void {
    const errorMessage = message ? `${message}: ${error.message} || error`: error.message || error;
    console.error(errorMessage);
    this.state.lastError = errorMessage;
  }  
}

// Export at the module level, not inside the class
export const stripeTerminal = new StripeTerminalService();
