import { ref } from 'vue';

// Declare StripeTerminal as any because it's a global from the <script> tag
declare const StripeTerminal: any;

class StripeTerminalService {
  private terminal: any = null;
  private locationId: string | null = null;
  private reader: any = null;

  // Reactive ref to indicate if the terminal is connected
  public isConnected = ref(false);

  // Initialize the Terminal (create a new instance)
  // If already initialized, return the existing instance
  async initialize() {
	if (this.terminal) return this.terminal;

  this.terminal = StripeTerminal.create({
    onFetchConnectionToken: async () => {
      const response = await fetch('http://localhost:4242/connection-token', {
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

  // Get the location ID from the server
  async getLocationId() {
    if (this.locationId) return this.locationId;

    const response = await fetch('http://localhost:4242/get-location-id');
    const { locationId } = await response.json();
    this.locationId = locationId;
    return this.locationId;
  }

  // Discover a reader
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
}

export const stripeTerminal = new StripeTerminalService();
