import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.monia.app',
  appName: 'MonIA',
  webDir: 'dist',
  overrideUserAgent: 'Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36',
  server: {
    url: 'https://karlosmontoya91.github.io/App-MonIA/',
    cleartext: true,
    allowNavigation: [
      'app-monia.firebaseapp.com',
      'accounts.google.com'
    ]
  }
};

export default config;
