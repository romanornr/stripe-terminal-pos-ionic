// src/types.ts

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

interface PaymentIntentResponse {
  success: boolean;
  data?: PaymentIntent;
  error?: string;
}

export type { PaymentIntent, PaymentIntentResponse };