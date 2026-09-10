import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.resuloto.resulotoApp',
  appName: 'ResuLoto',
  webDir: 'dist/platform/browser',
  server: { androidScheme: 'https', iosScheme: 'https' },
};

export default config;
