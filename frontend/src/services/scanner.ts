import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import type { DeviceInfoPayload } from '../types/scan';

export interface ScanHardwareResult {
  rawValue: string;
  format: string;
}

export async function getDeviceMetadata(): Promise<DeviceInfoPayload> {
  try {
    const info = await Device.getInfo();
    return {
      platform: info.platform,
      model: info.model,
      manufacturer: info.manufacturer,
      osVersion: info.osVersion,
    };
  } catch {
    return {
      platform: Capacitor.getPlatform(),
    };
  }
}

export async function scanQrCodeWithCamera(): Promise<ScanHardwareResult> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error(
      'Native camera scanning requires the Android APK. Use the manual JSON QR tester below in browser mode.'
    );
  }

  const supported = await BarcodeScanner.isSupported();
  if (!supported.supported) {
    throw new Error('Barcode scanning is not supported on this device.');
  }

  let permission = await BarcodeScanner.checkPermissions();
  if (permission.camera !== 'granted' && permission.camera !== 'limited') {
    permission = await BarcodeScanner.requestPermissions();
  }

  if (permission.camera !== 'granted' && permission.camera !== 'limited') {
    throw new Error('Camera permission is required to scan QR codes.');
  }

  if (Capacitor.getPlatform() === 'android') {
    const moduleStatus = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (!moduleStatus.available) {
      await BarcodeScanner.installGoogleBarcodeScannerModule();
    }
  }

  const result = await BarcodeScanner.scan({
    formats: [BarcodeFormat.QrCode],
  });

  if (!result.barcodes || result.barcodes.length === 0) {
    throw new Error('Scan cancelled or no QR code detected.');
  }

  const first = result.barcodes[0];
  return {
    rawValue: first.rawValue || '',
    format: 'JSON',
  };
}
