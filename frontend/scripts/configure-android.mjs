import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve(
  process.cwd(),
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml'
);

if (!fs.existsSync(manifestPath)) {
  console.log('[Android Config] AndroidManifest.xml not found, skipping.');
  process.exit(0);
}

let manifest = fs.readFileSync(manifestPath, 'utf8');

if (!manifest.includes('android.permission.CAMERA')) {
  manifest = manifest.replace(
    '<uses-permission android:name="android.permission.INTERNET" />',
    '<uses-permission android:name="android.permission.INTERNET" />\n    <uses-permission android:name="android.permission.CAMERA" />'
  );
}

if (!manifest.includes('android.hardware.camera')) {
  manifest = manifest.replace(
    '<application',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />\n\n    <application'
  );
}

fs.writeFileSync(manifestPath, manifest, 'utf8');
console.log('[Android Config] Updated AndroidManifest.xml with CAMERA permissions.');
