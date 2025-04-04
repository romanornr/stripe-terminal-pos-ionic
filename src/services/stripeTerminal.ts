import { json } from 'stream/consumers';
import { ref, reactive, toRefs } from 'vue';
import { Logger, ConsoleLogger } from '../logger/Logger';
import { DEFAULT_CONFIG } from '@/config/config';
import { StripeTerminal as CapacitorStripeTerminal /* , type Reader */ } from '@capacitor-community/stripe-terminal';
import type { PluginListenerHandle } from '@capacitor/core';

// -- INTERFACES --

interface StripeTerminalOptions {
  onFetchConnectionToken: () => Promise<string>;
  onUnexpectedReaderDisconnect: () => void;
  onReaderDisconnected: () => void;
}

interface Reader {
  id?: string;
  baseUrl?: string;
  deviceSoftwareVersion?: string;
  deviceType?: string;
  ipAddress?: string;
  label?: string;
  livemode?: boolean;
  location?: any;
  serialNumber: string;
  status?: string;
  locationId?: string;
  simulated?: boolean;
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
//declare const StripeTerminal: any; // removed because it's not used anymore since we're using the CapacitorStripeTerminal

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

  // Add listener handles - needed to remove listeners later
  private listenerHandles: PluginListenerHandle[] = [];

  constructor(baseUrl = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Initializes the Stripe Terminal using the Capacitor plugin.
   * 
   * @returns Promise<void>
   * @throws Error if the terminal initialization fails
   */
  async initialize(): Promise<void> {
    if (this.terminal) {
        logger.info('Terminal already initialized.');
        return;
    }

    this.state.isLoading = true;
    this.state.lastError = null;
    logger.info('Initializing Stripe Terminal via Capacitor...');

    try {
      await CapacitorStripeTerminal.initialize({
        tokenProviderEndpoint: CONNECTION_TOKEN_ENDPOINT,
        isTest: false // Or false depending on your environment
      });

      this.terminal = CapacitorStripeTerminal;

      // *** ADD LISTENERS ***
      await this.addTerminalListeners();

      this.state.isConnected = false;
      this.state.currentReader = null;

      logger.info('Stripe Terminal initialized successfully.');

      await this.getLocationId();

    } catch (error: any) {
      this.handleError(error, 'Failed to initialize Stripe Terminal');
      this.state.lastError = error.message || String(error);
      this.terminal = null;
    } finally {
      this.state.isLoading = false;
    }
  }

  // Method to set up listeners
  private async addTerminalListeners(): Promise<void> {
     this.removeTerminalListeners();

     try {
        let handle = await this.terminal.addListener('terminalDiscoveredReaders', (info: { readers: Reader[] }) => {
           // Log the raw info object
           logger.info('[EVENT] Raw readersDiscovered info:', JSON.stringify(info, null, 2));

           if (info.readers && info.readers.length > 0) {
               const discoveredReader = info.readers[0]; // Get the first reader

               // Log using camelCase properties now
               logger.info(`[EVENT] Discovered Reader Properties: serialNumber=${discoveredReader.serialNumber}, id=${discoveredReader.id}, ipAddress=${discoveredReader.ipAddress}, locationId=${discoveredReader.locationId}, label=${discoveredReader.label}`);

               // Check using the correct camelCase property
               if (discoveredReader && discoveredReader.serialNumber) {
                   this.state.currentReader = {
                       serialNumber: discoveredReader.serialNumber,
                       id: discoveredReader.id,
                       ipAddress: discoveredReader.ipAddress,
                       label: discoveredReader.label,
                       locationId: discoveredReader.locationId,
                   } as Reader;

                   logger.info("Set currentReader state with NEW plain object.");
               } else {
                   logger.error("Discovered reader object missing serialNumber or is invalid:", discoveredReader);
                   this.state.currentReader = null;
               }

           } else {
               logger.info("Readers discovered event fired, but list is empty or invalid.");
               this.state.currentReader = null;
           }
        });
        this.listenerHandles.push(handle);

        handle = await this.terminal.addListener('connectionStatusChange', (info: { status: string }) => {
           logger.info('[EVENT] Connection Status Change:', info.status);
           // Use ConnectionStatus enum values if available, otherwise compare strings
           const newConnectionState = (info.status?.toUpperCase() === 'CONNECTED'); // Match docs/enum?
           if (this.state.isConnected !== newConnectionState) {
                this.state.isConnected = newConnectionState;
                logger.info(`Set isConnected state to: ${this.state.isConnected}`);
                // Important: Only clear reader if DISCONNECTED
                if (!this.state.isConnected) {
                    this.state.currentReader = null;
                    logger.info("Cleared currentReader due to disconnection status.");
                }
                // DO NOT set currentReader here on connect, rely on connectReader success
           }
        });
        this.listenerHandles.push(handle);

        // Optional: Add listener for unexpected disconnect
         handle = await this.terminal.addListener('terminalUnexpectedReaderDisconnect', (info: { reader: Reader }) => {
            logger.warn('[EVENT] Unexpected Reader Disconnect:', info.reader?.serialNumber);
            this.handleError(new Error('Unexpected reader disconnect'), 'Reader disconnected unexpectedly');
            this.state.isConnected = false;
            this.state.currentReader = null;
         });
         this.listenerHandles.push(handle);

     } catch (listenerError) {
        this.handleError(listenerError, "Failed to add terminal listeners");
     }
  }

   // Method to clean up listeners
  private removeTerminalListeners(): void {
      this.listenerHandles.forEach(handle => handle.remove());
      this.listenerHandles = [];
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
  async findAvailableReader(): Promise<void> {
    if (!this.terminal) await this.initialize();
    if (!this.terminal) throw new Error('Terminal not initialized');

    this.state.isLoading = true;
    this.state.lastError = null;
    logger.info('Requesting reader discovery...');

    try {
      const locationId = await this.getLocationId();
      await this.terminal.discoverReaders({
        type: 'internet',
        locationId: locationId
      });
      logger.info('Discovery request sent.');
    } catch (error) {
      this.handleError(error, 'Failed to start reader discovery');
      this.state.isLoading = false;
      throw error;
    } finally {
      setTimeout(() => { this.state.isLoading = false; }, 5000);
    }
  }

  /**
   * Connects to a discovered internet reader.
   * @param reader - The reader object obtained from discoverReaders.
   * @returns Promise<Reader | null> - The connected reader, or null on failure before returning.
   * @throws Error if the reader connection fails catastrophically.
   */
  async connectToReader(reader: Reader): Promise<void> {
    if (!this.terminal) {
      await this.initialize();
      if (!this.terminal) throw new Error('Terminal initialization failed');
    }

    // *** Temporarily COMMENT OUT the check ***
    // if (!reader || !reader.serialNumber) {
    //     throw new Error('Invalid reader object provided for connection (missing serialNumber).');
    // }

    // Add logging right before the native call
    logger.info(`Attempting to call native connectReader directly with object:`, JSON.stringify(reader, null, 2));

    // Disconnect if already connected to a different reader
    if (this.state.isConnected && this.state.currentReader?.serialNumber !== reader.serialNumber) {
       logger.info('Disconnecting from previous reader...');
       await this.disconnectReader(); // Ensure you have this method
    }
    // If already connected to the same reader, return it
    if (this.state.isConnected && this.state.currentReader?.serialNumber === reader.serialNumber) {
        logger.info('Already connected to this reader.');
        return; // Return void
    }

    this.state.isLoading = true;
    this.state.lastError = null;
    logger.info(`Connecting to reader ${reader.serialNumber} using generic connectReader...`);

    try {
      // Call generic connectReader, passing the reader object
      await this.terminal.connectReader(reader);

      // If promise resolves, connection initiated successfully.
      // The 'connectionStatusChange' listener SHOULD update isConnected and potentially currentReader.
      // We might tentatively set the reader here, but the listener is more reliable.
      logger.info(`connectReader promise resolved for ${reader.serialNumber}. Waiting for connectionStatusChange event...`);
       // Tentatively set reader - listener should confirm/override
      this.state.currentReader = reader;
      // isConnected will be set by the listener

    } catch (error) { // Catches promise rejection
      this.handleError(error, `Failed to connect to reader ${reader.serialNumber}`);
      this.state.isConnected = false; // Ensure false on error
      this.state.currentReader = null;
      throw error; // Re-throw error after handling
    } finally {
      this.state.isLoading = false;
    }
  }

  // Ensure you have a disconnect method that uses the plugin
  async disconnectReader(): Promise<void> {
      if (!this.terminal || !this.state.isConnected) return;
      logger.info('Disconnecting reader via Capacitor...');
      try {
          // Use the plugin's disconnect method
          await this.terminal.disconnectReader();
          this.state.isConnected = false;
          this.state.currentReader = null;
          logger.info('Reader disconnected.');
      } catch(error) {
          this.handleError(error, 'Failed to disconnect reader');
          // Force state change even on error? Your choice.
          this.state.isConnected = false;
          this.state.currentReader = null;
      } finally {
          this.removeTerminalListeners();
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

  // Consider adding a cleanup method if your app structure allows
  // e.g., call removeTerminalListeners when the service instance is no longer needed
  cleanup(): void {
      this.removeTerminalListeners();
      // potentially call disconnectReader here too
  }
}

// Export at the module level, not inside the class
export const stripeTerminal = new StripeTerminalService();

// Ensure you export the types needed by listeners if defined here
// export { Reader }; // Export Reader if it's defined in this file
