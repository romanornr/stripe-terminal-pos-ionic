import { json } from 'stream/consumers';
import { ref, reactive, toRefs } from 'vue';

// -- INTERFACES --

interface StripeTerminalObject {
  create: (options: StripeTerminalOptions) => StripeTerminalObject
}

interface StripeTerminalObject {
  //discoverReaders: (options: DiscoverReaderOptions) => Promise<DiscoverResult>;
  findAvailableReader: () => Promise<Reader>;
  //connectReader: (reader: Reader) => Promise<ConnectResult>;
  connectToReader: (reader: Reader) => Promise<ConnectResult>;
  collectPaymentMethod: (clientSecret: string) => Promise<CollectResult>;
  processPayment: (paymentIntent: any) => Promise<ProcessPaymentResult>;
}

interface StripeTerminalOptions {
  onFetchConnectionToken: () => Promise<string>;
  onUnexpectedReaderDisconnect: () => void;
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
  paymentIntent: any;
}

interface ProcessPaymentResult {
  error?: { message: string };
  paymentIntent?: any;
}

// Constants for API endpoints
const API_BASE_URL = 'http://localhost:4242';
const CONNECTION_TOKEN_ENDPOINT = `${API_BASE_URL}/connection-token`;
const GET_LOCATION_ID_ENDPOINT = `${API_BASE_URL}/get-location-id`;
const CREATE_PAYMENT_INTENT_ENDPOINT = `${API_BASE_URL}/create-payment-intent`;
const COLLECT_PAYMENT_METHOD_ENDPOINT = `${API_BASE_URL}/collect-payment-method`;
const PROCESS_PAYMENT_ENDPOINT = `${API_BASE_URL}/process-payment`;

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
  private reader: any = null;

    /** Reactive ref to indicate if the terminal is connected */
  public isConnected = ref(false);

  private state =  reactive<TerminalState>({
    isConnected: false,
    isLoading: false,
    lastError: null,
    currentReader: null,
  });

  // Expose the state as refs for readony
  public readonly stateRefs = toRefs(this.state)

  /** Base URL for your backend server */
  private baseUrl = 'http://localhost:4242';

  constructor(baseUrl = 'http://localhost:4242') {
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
      if (!this.state.currentReader) throw new Error('Failed to connect to reader');
      
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
  async connectAndInitializeReader() {
    if (!this.terminal) await this.initialize();

    try {
      const reader = await this.findAvailableReader();
      const connectResult = await this.terminal.connectReader(reader);
      
      if (connectResult.error) {
        throw new Error(`Error connecting to reader: ${connectResult.error.message}`);
      }

      this.state.currentReader = connectResult.reader || reader;
      this.state.isConnected = true;
      
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
   * @throws Error if client secret is missing or creation fails
   */
  async createPaymentIntent(amount: number) {
    try {
      const amountInCents = Math.round(amount * 100);
      console.log('Creating payment intent for amount:', amountInCents);

      const response = await fetch(`${this.baseUrl}/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: amountInCents,
          currency: 'eur'
        })
      });

      const responseJson = await response.json();
      console.log('Server response:', responseJson);

      const clientSecret = responseJson.data?.client_secret;
      if (!clientSecret) {
        throw new Error('Failed to create payment intent or missing client secret');
      }
      return clientSecret;
    } catch (error) {
      console.error('Create payment intent error:', error);
      throw error;
    }
  }

  /**
   * Wraps a promise with a timeout. If the promise does not resolve or reject within the specified time,
   * it will be rejected with a timeout error.
   * @template T - The type of the promise's result.
   * @param promise - The promise to wrap with a timeout.
   * @param timeoutMs - The timeout duration in milliseconds.
   * @param timeoutError - Optional custom error to throw when the timeout occurs. If not provided,
   *                       a default error message will be used.
   * @returns A promise that resolves or rejects based on the original promise and the timeout.
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
   * Collects the payment using the Stripe Terminal
   * @param clientSecret - The client secret for the payment intent
   * @param timeOutMs - The timeout in milliseconds
   * @returns Promise<any> - The result of the payment collection
   * @throws Error if the payment collection fails
   */
  async collectTerminalPayment(clientSecret: string, timeOutMs = 25000) {
    if(!this.terminal) {
      throw new Error('Terminal is not initialized');
    }

    console.log('Starting to collect payment...')

    try {
      // wrap the collectPaymentMethod with a timeout helper
      const result = await this.withTimeout(
        this.terminal.collectPaymentMethod(clientSecret),
        timeOutMs,
        new Error('Payment collection timed out')
      );
      console.log('CollectPaymentMethod succeeded, returning payment intent')
      return (result as CollectResult).paymentIntent; // Type assertion to access paymentIntent
    } catch (error) {
      console.warn('Error during payment collection', error)
      console.log('Attempting to cancel collectPaymentMethod now...')
      try { // cancel the collectPaymentMethod if it's still running
        await this.terminal.cancelCollectPaymentMethod();
        console.log('collectPaymentMethod cancelled successfully')
      } catch (error) {
        console.warn('Error cancelling collectPaymentMethod', error)
      }
      throw error;
    }
  }
  
  /**
   * Processes the payment using the Stripe Terminal
   * @param paymentIntent - The payment intent to process
   * @returns Promise<any> - The result of the payment processing
   * @throws Error if the payment processing fails
   */
  async processTerminalPayment(paymentIntent: any) {
    if (!this.terminal) {
      throw new Error('Terminal is not initialized');
    }

    const processResult = await this.terminal.processPayment(paymentIntent)
    if (processResult.error) {
      throw new Error(`Error processing payment: ${processResult.error.message}`);
    }

    return processResult;
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
