import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.t20manager.app',
  appName: 'T20 Manager',
  webDir: 'dist',
  android: {
    backgroundColor: '#0F172A',
    allowMixedContent: false,
  },
};

export default config;
