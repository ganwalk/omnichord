import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ganwalk.omnisound',
  appName: 'OmniSound',
  webDir: 'dist',
  backgroundColor: '#0e0a06',
  android: {
    // Audio should start the instant a pad is touched.
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0e0a06',
      overlaysWebView: false,
    },
  },
};

export default config;
