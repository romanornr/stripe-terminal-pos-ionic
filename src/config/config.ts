// src/config/config.ts

// Terminal configuration interface
export interface TerminalConfig {
  baseUrl: string;
  timeoutMs: number;    // For terminal payment process 
  httpTimeoutMs: number // For HTTP requests
  currency: string;
  logLevel: string;
  endpoints: {
    connectionToken: string;
    locationId: string;
    paymentIntent: string
  }
}

// Default configuration for the terminal
export const DEFAULT_CONFIG: TerminalConfig= {
  baseUrl: import.meta.env.VITE_API_BASEURL as string,
  timeoutMs: 60000, // 1 minute waiting before payment is cancelled
  httpTimeoutMs: 10000, // 10 seconds
  currency: 'eur',  // In config.ts
  logLevel: 'info',
  endpoints: {
    connectionToken: '/connection-token',
    locationId: '/get-location-id',
    paymentIntent: '/create-payment-intent'
  }
}