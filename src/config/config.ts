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
  baseUrl: import.meta.env.VITE_API_BASEURL as string,
  timeoutMs: 25000,
  currency: 'eur',// In config.ts
  logLevel: 'info',
  endpoints: {
    connectionToken: '/connection-token',
    locationId: '/get-location-id',
    paymentIntent: '/create-payment-intent'
  }
}