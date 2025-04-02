// src/config/config.ts

// Terminal configuration interface
export interface TerminalConfig {
  baseUrl: string;
  timeoutMs: number;
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
  baseUrl: 'http://192.168.2.6:4242',
  timeoutMs: 25000,
  currency: 'eur',
  logLevel: 'info',
  endpoints: {
    connectionToken: '/connection-token',
    locationId: '/get-location-id',
    paymentIntent: '/create-payment-intent'
  }
}