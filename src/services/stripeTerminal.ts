import { json } from 'stream/consumers';
import { ref } from 'vue';

// -- INTERFACES --

interface StripeTerminalObject {
  create: (options: StripeTerminalOptions) => StripeTerminalObject
}

interface StripeTerminalObject {
  discoverReaders: (options: DiscoverReaderOptions) => Promise<DiscoverResult>;
  connectReader: (reader: Reader) => Promise<ConnectResult>;
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
  //private locationId: string | null = null;
  private _locationId: string | null = null;
  private reader: any = null;

  /** Reactive ref to indicate if the terminal is connected */
  public isConnected = ref(false);

  /** Base URL for your backend server */
  private baseUrl = 'http://localhost:4242';

  constructor(baseUrl = 'http://localhost:4242') {
    this.baseUrl = baseUrl;
  }

  /**
   * Initializes the Stripe Terminal (creates the Terminal instance)
   * If already initialized, returns the existing instance
   * @returns Promise<any> - The initialized terminal
   * @throws Error if the terminal initialization fails
   */
  async initialize() {
    if (this.terminal) return this.terminal;

    this.terminal = StripeTerminal.create({
      onFetchConnectionToken: async () => {
        const response = await fetch(CONNECTION_TOKEN_ENDPOINT, {
          method: 'POST',
        });
        const responseJson = await response.json();
        console.log('Response from connection token endpoint', responseJson)
        return responseJson.data?.secret;
      },
      onUnexpectedReaderDisconnect: () => {
        console.log('Reader disconnected unexpectedly');
        this.isConnected.value = false;
        this.reader = null;
      }
    });
    return this.terminal;
  }

  /**
   * Gets the location ID from the server
   * @returns Promise<string> - The location ID
   * @throws Error if the location ID is not found
   */
  async getLocationId(): Promise<string> {
    if (this._locationId) return this._locationId;

    const response = await fetch(GET_LOCATION_ID_ENDPOINT);
    const responseJson = await response.json();
    console.log('Response from get-location-id endpoint', responseJson.data.location_id)

    const locationId  = responseJson.data.location_id;


    // Error handling in no locationId is found
    if (typeof locationId !== 'string' || locationId.trim() === '') {
      console.log('Invalid locationID received from backend', locationId)
      throw new Error('Error: Invalid location ID received from backend')
    }

    this._locationId = locationId;
    return this._locationId;
    // if (this.locationId) return this.locationId;

    // const response = await fetch(`${this.baseUrl}/get-location-id`);
    // const { locationId } = await response.json();
    // this.locationId = locationId;
    // return this.locationId;
  }

  /**
   * Discovers a reader
   * @returns Promise<any> - The discovered reader
   * @throws Error if the reader discovery fails
   */
  async discoverReaders() {
    if (!this.terminal) await this.initialize();

    const locationId = await this.getLocationId();
    const discoverResult = await this.terminal.discoverReaders({ location: locationId });

    if (discoverResult.error) {
      throw new Error(`Error discovering reader: ${discoverResult.error.message}`);
    }

    console.log('Discover result backend', discoverResult)

    if (!discoverResult.discoveredReaders?.length) {
      throw new Error('No readers found. Make sure your device on the same network')
    }

    return discoverResult.discoveredReaders[0];
  }

  /**
   * Connects and initializes the reader
   * @returns Promise<any> - The connected reader
   * @throws Error if the reader connection fails
   */
  async connectAndInitializeReader() {
    if (!this.terminal) await this.initialize();

    // if already connected, skip
    if (this.isConnected.value && this.reader) {
      return this.reader;
    }

    try {
      const reader = await this.discoverReaders();
      const connectResult = await this.terminal.connectReader(reader);

      if (connectResult.error) {
        throw new Error(`Error connecting to reader: ${connectResult.error.message}`);
      }

      this.reader = reader;
      this.isConnected.value = true;
      console.log('Reader connected successfully at the backend', this.reader);

      return this.reader;
    } catch (error) {
      console.error('Error connecting to reader', error);
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

}

// Export at the module level, not inside the class
export const stripeTerminal = new StripeTerminalService();
