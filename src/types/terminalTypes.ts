// src/types/terminalTypes.ts

/**
 * Generic result type for terminal operations
 * Use this for any operation represents a successful or failed operation
 */
export type Result<T> =
  | { success: true, data: T }
  | { success: false, error: TerminalError };

/**
 * Result types for terminal operations
 */
export type DiscoverResult = Result<Reader[]>;
export type ConnectResult = Result<Reader>;
export type PaymentResult = Result<PaymentIntent>;
export type CollectResult = Result<PaymentIntent>;

export type ProcessPaymentResult<T> =
  | { success: true, paymentIntent: PaymentIntent }
  | { success: false, error: TerminalError };

/**
 * Error codes for terminal-related operations
 */
export type ErrorCode =
  | 'CONNECTION_TOKEN_FAILED'
  | 'NO_READERS_FOUND'
  | 'READER_CONNECTION_FAILED'
  | 'PAYMENT_INTENT_FAILED'
  | 'PAYMENT_COLLECTION_FAILED'
  | 'PAYMENT_PROCESSING_FAILED'
  | 'OPERATION_TIMEOUT'
  | 'CONFIG_INVALID'
  | 'READER_DISCONNECTION_FAILED'
  | 'LOCATION_ID_FETCH_FAILED';

/**
 * TerminalError extends the built-in Error class to provide a custom error type for terminal operations
 */
export class TerminalError extends Error {
  constructor(public code: ErrorCode, message?: string, public originalError?: unknown) {
    super(message);
    this.name = 'TerminalError';
  }
}

/**
 * Interface representing a Payment Intent
 * This is the type returned by the API when creating a payment intent
 */
export interface PaymentIntent {
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
  // Optional properties
  description?: string;
  shipping?: any;
  receipt_email?: string;
  last_payment_error?: any;
}

/**
 * Interface representing a Reader.
 * This is the type returned by the API when discovering readers
 */
export interface Reader {
  id: string;
  object: string;
  action: any;
  base_url: string;
  device_sw_version: string;
  device_type: string;
  ip_address: string;
  label: string;
  last_seen_at: number;
  livemode: boolean;
  location: string;
  metadata: Record<string, any>;
  serial_number: string;
  status: string;
}

// interface ProcessPaymentResult {
//   error?: { message: string };
//   paymentIntent?: PaymentIntent;
// }