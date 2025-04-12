# Timeout Configuration

This document describes the timeout configuration settings used in the Stripe Terminal POS application.

## Overview

The application uses different timeout settings for different purposes:

1. **Terminal Payment Timeout** - Controls how long customers have to complete a payment at the terminal
2. **HTTP Request Timeout** - Controls how long the application waits for API responses

These timeouts are defined in the `TerminalConfig` interface in `src/config/config.ts`.

## Configuration Properties

### Terminal Payment Timeout (`timeoutMs`)

```typescript
timeoutMs: number;    // For terminal payment process 
```

- **Default Value**: 60000ms (1 minute)
- **Purpose**: Defines how long customers have to complete their payment at the terminal before the payment is automatically cancelled
- **Usage**: 
  - Used by `TerminalService` in the `collectPaymentMethod` function to set a timeout for the payment collection process
  - Used by UI components like `PaymentCountdown.vue` to display a countdown timer to the user

### HTTP Request Timeout (`httpTimeoutMs`)

```typescript
httpTimeoutMs: number // For HTTP requests
```

- **Default Value**: 10000ms (10 seconds)
- **Purpose**: Defines how long the application waits for HTTP responses from the API before timing out
- **Usage**:
  - Used by `ApiClient` when creating the Axios instance to set the request timeout

## Configuration Example

```typescript
// Default configuration for the terminal
export const DEFAULT_CONFIG: TerminalConfig= {
  baseUrl: import.meta.env.VITE_API_BASEURL as string,
  timeoutMs: 60000, // 1 minute waiting before payment is cancelled
  httpTimeoutMs: 10000, // 10 seconds for HTTP requests
  currency: 'eur',
  logLevel: 'info',
  endpoints: {
    connectionToken: '/connection-token',
    locationId: '/get-location-id',
    paymentIntent: '/create-payment-intent'
  }
}
```

## Best Practices

### Terminal Payment Timeout

- **Recommended Range**: 30000ms - 120000ms (30 seconds to 2 minutes)
- **Considerations**:
  - Too short: Customers may not have enough time to complete their payment
  - Too long: Increases wait time if a customer abandons the payment process

### HTTP Request Timeout

- **Recommended Range**: 5000ms - 30000ms (5 seconds to 30 seconds)
- **Considerations**:
  - Too short: May cause timeouts for valid but slow API responses
  - Too long: Poor user experience if API is unresponsive

## Implementation Notes

The separation of timeout concerns was implemented to address an issue where the terminal payment timeout (1 minute) was incorrectly being used for HTTP requests, which typically need much shorter timeouts.

## Related Components

- **src/services/terminal-service.ts** - Uses `timeoutMs` for payment collection timeout
- **src/services/api-client.ts** - Uses `httpTimeoutMs` for HTTP request timeout
- **src/components/PaymentCountdown.vue** - Uses `timeoutMs` for displaying countdown timer