import React, { useEffect, useState } from 'react';
import { Save, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { JsonTreeViewer } from '../components/JsonTreeViewer';
import { ApiError, checkDuplicate, saveScan } from '../services/api';
import { getDeviceMetadata } from '../services/scanner';
import { countJsonMetrics } from '../utils/jsonUtils';
import type { DuplicateCheckResponse, JsonValue, ScanRecord } from '../types/scan';

interface JsonPreviewScreenProps {
  rawJson: string;
  parsedJson: JsonValue;
  onSaved: (record: ScanRecord) => void;
  onCancel: () => void;
}

export const JsonPreviewScreen: React.FC<JsonPreviewScreenProps> = ({
  rawJson,
  parsedJson,
  onSaved,
  onCancel,
}) => {
  const [dupInfo, setDupInfo] = useState<DuplicateCheckResponse | null>(null);
  const [checkingDup, setCheckingDup] = useState(true);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const metrics = React.useMemo(() => countJsonMetrics(parsedJson), [parsedJson]);

  useEffect(() => {
    let active = true;
    setCheckingDup(true);
    checkDuplicate(rawJson)
      .then((res) => {
        if (active) setDupInfo(res);
      })
      .catch(() => {
        // If offline or unreachable during pre-check, SAVE will still enforce server validation
      })
      .finally(() => {
        if (active) setCheckingDup(false);
      });
    return () => {
      active = false;
    };
  }, [rawJson]);

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg(null);

    try {
      const deviceInfo = await getDeviceMetadata();
      const response = await saveScan({
        qr_raw_data: rawJson,
        qr_format: 'JSON',
        scanned_at: new Date().toISOString(),
        device_info: deviceInfo,
        allow_duplicate: confirmDuplicate,
      });

      onSaved(response.record);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === 'DUPLICATE_QR') {
        setDupInfo({
          isDuplicate: true,
          existingCount: 1,
          latestMatch: (err.data as { latestMatch?: { id: number; scanned_at: string } })
            ?.latestMatch || null,
        });
        setErrorMsg(
          'Duplicate QR detected on server. Check "Confirm saving duplicate record" below if you still want to save it.'
        );
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to save scan to PostgreSQL.');
      }
    } finally {
      setSaving(false);
    }
  };

  const requiresDupConfirmation = dupInfo?.isDuplicate && !confirmDuplicate;

  return (
    <div className="screen-content">
      <div className="card">
        <div className="preview-header">
          <div>
            <h2>Scanned JSON Preview</h2>
            <p className="helper-text">
              Type: <strong>{metrics.topLevelType}</strong> • Keys:{' '}
              <strong>{metrics.totalKeys}</strong> • Depth: <strong>{metrics.maxDepth}</strong>
            </p>
          </div>
          <span className="valid-badge">
            <CheckCircle2 size={14} /> Valid JSON
          </span>
        </div>

        {checkingDup && (
          <div className="info-banner">
            <Loader2 size={15} className="spin" /> Checking for duplicate QR payloads...
          </div>
        )}

        {dupInfo?.isDuplicate && (
          <div className="alert alert-warning">
            <div className="alert-title-row">
              <AlertTriangle size={18} />
              <strong>Duplicate QR Payload Detected</strong>
            </div>
            <p>
              This exact JSON payload already exists in PostgreSQL ({dupInfo.existingCount}{' '}
              {dupInfo.existingCount === 1 ? 'record' : 'records'}
              {dupInfo.latestMatch
                ? `, latest #${dupInfo.latestMatch.id} at ${new Date(
                    dupInfo.latestMatch.scanned_at
                  ).toLocaleString()}`
                : ''}
              ).
            </p>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={confirmDuplicate}
                onChange={(e) => setConfirmDuplicate(e.target.checked)}
              />
              <span>Yes, save a duplicate record anyway</span>
            </label>
          </div>
        )}

        {errorMsg && (
          <div className="alert alert-danger">
            <strong>Save Failed:</strong> {errorMsg}
          </div>
        )}
      </div>

      <JsonTreeViewer data={parsedJson} rawJson={rawJson} />

      <div className="sticky-action-bar">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
          disabled={saving}
        >
          <X size={18} />
          CANCEL
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving || Boolean(requiresDupConfirmation)}
        >
          {saving ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
          {saving ? 'Saving to PostgreSQL...' : 'SAVE'}
        </button>
      </div>
    </div>
  );
};
