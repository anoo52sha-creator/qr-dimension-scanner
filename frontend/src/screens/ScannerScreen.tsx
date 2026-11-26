import React, { useState } from 'react';
import { QrCode, AlertTriangle, RotateCcw, FileJson, ChevronDown, ChevronUp } from 'lucide-react';
import { scanQrCodeWithCamera } from '../services/scanner';
import { validateAndParseJson } from '../utils/jsonUtils';
import type { JsonValue } from '../types/scan';

interface ScannerScreenProps {
  onValidScan: (rawJson: string, parsedJson: JsonValue) => void;
  onCancel: () => void;
}

export const ScannerScreen: React.FC<ScannerScreenProps> = ({ onValidScan, onCancel }) => {
  const [scanning, setScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [invalidRaw, setInvalidRaw] = useState<string | null>(null);
  const [showManualTester, setShowManualTester] = useState(false);
  const [manualInput, setManualInput] = useState('');

  const processRawPayload = (raw: string) => {
    setErrorMsg(null);
    setInvalidRaw(null);

    const validation = validateAndParseJson(raw);
    if (!validation.valid) {
      setErrorMsg(validation.error);
      setInvalidRaw(validation.raw);
      return;
    }

    onValidScan(validation.raw, validation.parsed);
  };

  const handleStartCameraScan = async () => {
    setScanning(true);
    setErrorMsg(null);
    setInvalidRaw(null);

    try {
      const result = await scanQrCodeWithCamera();
      processRawPayload(result.rawValue);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to scan QR code.';
      setErrorMsg(message);
    } finally {
      setScanning(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    processRawPayload(manualInput);
  };

  return (
    <div className="screen-content">
      <div className="scanner-card">
        <div className="scanner-reticle">
          <QrCode size={64} strokeWidth={1.6} />
        </div>
        <h2>Scan Dynamic JSON QR</h2>
        <p>
          Point your Android camera at any QR code containing JSON. The app will read the complete
          payload, validate JSON syntax, and preview all properties before saving.
        </p>

        <button
          type="button"
          className="btn btn-primary btn-lg btn-full"
          onClick={handleStartCameraScan}
          disabled={scanning}
        >
          <QrCode size={20} />
          {scanning ? 'Opening Camera...' : 'SCAN QR CODE'}
        </button>

        <button type="button" className="btn btn-ghost btn-full" onClick={onCancel}>
          Back to Home
        </button>
      </div>

      {errorMsg && (
        <div className="alert alert-danger">
          <div className="alert-title-row">
            <AlertTriangle size={18} />
            <strong>QR Validation / Scan Error</strong>
          </div>
          <p>{errorMsg}</p>
          {invalidRaw !== null && (
            <div className="invalid-raw-box">
              <div className="invalid-raw-label">Raw Scanned Content (Cannot Save Invalid JSON):</div>
              <code>{invalidRaw || '(empty)'}</code>
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleStartCameraScan}
            disabled={scanning}
          >
            <RotateCcw size={15} />
            Rescan QR Code
          </button>
        </div>
      )}

      <div className="card">
        <button
          type="button"
          className="collapsible-header"
          onClick={() => setShowManualTester((prev) => !prev)}
        >
          <span className="collapsible-title">
            <FileJson size={17} />
            Manual / Browser JSON Payload Tester
          </span>
          {showManualTester ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showManualTester && (
          <form onSubmit={handleManualSubmit} className="manual-form">
            <p className="helper-text">
              For testing on desktop browsers or validating arbitrary JSON structures before
              building the APK:
            </p>
            <textarea
              rows={5}
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder='{"PartNo":"ABC001","OuterDiameter":25.5,"Tags":["A","B"]}'
              className="textarea-code"
            />
            <div className="sample-chips">
              <button
                type="button"
                className="chip-btn"
                onClick={() =>
                  setManualInput(JSON.stringify({ Length: 120, Width: 50, Height: 30 }))
                }
              >
                Sample 1
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() =>
                  setManualInput(
                    JSON.stringify({
                      Product: { ID: 'P1001', Dimensions: { X: 120, Y: 50, Z: 30 } },
                      Measurements: [
                        { Name: 'M1', Value: 10, Valid: true },
                        { Name: 'M2', Value: 20, Notes: null },
                      ],
                    })
                  )
                }
              >
                Sample Nested
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => setManualInput('{invalid_json: true')}
              >
                Sample Invalid
              </button>
            </div>
            <button type="submit" className="btn btn-secondary btn-full">
              Validate &amp; Preview JSON
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
