import { json } from 'stream/consumers';
import { ref } from 'vue';

// Declare StripeTerminal as any because it's a global from the <script> tag
declare const StripeTerminal: any;

/**
 * Service class for handling Stripe Terminal operations
 */
class StripeTerminalService {
  private terminal: any = null;
  private locationId: string | null = null;
  private reader: any = null;

  /** Reactive ref to indicate if the terminal is connected */
  public isConnected = ref(false);

  /** Base URL for your backend server */
  private baseUrl = 'http://localhost:4242';

  constructor(baseUrl = 'http://localhost:4242') {
    this.baseUrl = baseUrl;
  }

  /**
   * Initializes the Stripe Terminal
   * @returns Promise<any> - The initialized terminal
   * @throws Error if the terminal initialization fails
   */
  async initialize() {
    if (this.terminal) return this.terminal;

    this.terminal = StripeTerminal.create({
      onFetchConnectionToken: async () => {
        const response = await fetch(`${this.baseUrl}/connection-token`, {
          method: 'POST',
        });
        const responseJson = await response.json();
        console.log('Response', responseJson)
        return responseJson.data?.secret;
      },
      onUnexpectedReaderDisconnect: () => {
        console.log('Reader disconnected');
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
  async getLocationId() {
    if (this.locationId) return this.locationId;

    const response = await fetch(`${this.baseUrl}/get-location-id`);
    const { locationId } = await response.json();
    this.locationId = locationId;
    return this.locationId;
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

    try {
      // Simply collect the payment method first
      const collectResult = await this.terminal.collectPaymentMethod(clientSecret);
      
      if(collectResult.error) {
        throw new Error(`Error collecting payment: ${collectResult.error.message}`);
      }

      return collectResult.paymentIntent;
    } catch (error) {
      console.error('Collection error:', error);
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
