import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.qrdimensionscanner.app',
  appName: 'QR Dimension Scanner',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    BarcodeScanner: {
      // Uses Google ML Kit Barcode Scanning
    },
  },
};

export default config;
