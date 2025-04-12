import type { CapacitorConfig } from '@capacitor/cli';

// Load environment variables using standard Node.js approach
const appId = process.env.VITE_APP_ID || 'io.ionic.starter';
const appName = process.env.VITE_APP_NAME || 'Stripe Terminal';

const config: CapacitorConfig = {
  appId,
  appName,
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
      backgroundColor: "#FC89A2",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: true,
      androidSpinnerStyle: "large",
      iosSpinnerStyle: "small",
      spinnerColor: "#ffffff",
      splashFullScreen: true,
      splashImmersive: true
    }
  }
};

export default config;
