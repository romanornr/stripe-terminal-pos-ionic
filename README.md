# Stripe Terminal POS Mobile App

A mobile Point of Sale (POS) application built with Ionic Vue and Stripe Terminal, designed to process in-person payments through a Stripe payment terminal.

## Features

## Features

- 💳 Process payments through Stripe Terminal
- 📱 Mobile-optimized interface for quick transactions
- ⚡ Real-time payment status updates
- 🔒 Secure payment processing
- 📊 Transaction history tracking
- 💶 Support for Euro currency
- 📲 One-handed operation optimized

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Ionic CLI
- Stripe Terminal device
- Stripe account with Terminal access enabled

1. Clone the repository:
   ```bash
   git clone [your-repository-url]
   cd [repository-name]
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory and add:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=your_publishable_key
   VITE_API_URL=your_backend_api_url
   ```

4. Start the development server:
   ```bash
   ionic serve
   ```
## Installation

1. Clone the repository:
   ```bash
   git clone [your-repository-url]
   cd [repository-name]
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file in the root directory and add:
   ```env
   VITE_STRIPE_PUBLISHABLE_KEY=your_publishable_key
   VITE_API_URL=your_backend_api_url
   ```

4. Start the development server:
   ```bash
   ionic serve
   ```
## Building for Production

1. Build the application:
   ```bash
   ionic build
   ```

2. For iOS deployment:
   ```bash
   ionic cap add ios
   ionic cap open ios
   ```

3. For Android deployment:
   ```bash
   ionic cap add android
   ionic cap open android
   ```

## Project Structure

```
src/
├── views/              # Page components
│   ├── HomePage.vue    # Main payment interface
│   ├── HistoryPage.vue # Transaction history
│   └── TabsPage.vue    # Tab navigation
├── components/         # Reusable components
├── router/            # Route definitions
├── services/          # API and business logic
└── types/             # TypeScript type definitions
```

## Technology Stack

- 🎯 Ionic Framework - Mobile UI components
- ⚡ Vue 3 - Frontend framework
- 📘 TypeScript - Type safety
- 💳 Stripe Terminal SDK - Payment processing
- 📱 Capacitor - Native functionality

## Development

### Code Style
- Follow the Vue.js Style Guide
- Use TypeScript for type safety
- Implement proper error handling
- Write meaningful commit messages

### Testing
```bash
# Run unit tests
npm run test:unit

# Run end-to-end tests
npm run test:e2e
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

