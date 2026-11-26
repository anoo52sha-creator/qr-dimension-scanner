import React, { useState } from 'react';
import { Server, CheckCircle2, AlertTriangle, RotateCcw, Save } from 'lucide-react';
import {
  checkHealth,
  getApiBaseUrl,
  getDefaultApiBaseUrl,
  setCustomApiBaseUrl,
} from '../services/api';
import type { HealthStatus } from '../types/scan';

interface SettingsScreenProps {
  onHealthUpdated: (health: HealthStatus) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ onHealthUpdated }) => {
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<HealthStatus | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomApiBaseUrl(apiUrl);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleTestConnection = async () => {
    setCustomApiBaseUrl(apiUrl);
    setTesting(true);
    const health = await checkHealth();
    setTestResult(health);
    onHealthUpdated(health);
    setTesting(false);
  };

  const handleReset = () => {
    const def = getDefaultApiBaseUrl();
    setApiUrl(def);
    setCustomApiBaseUrl('');
    setTestResult(null);
  };

  return (
    <div className="screen-content">
      <div className="card">
        <div className="section-header">
          <h2>
            <Server size={18} /> Backend &amp; Database Settings
          </h2>
        </div>
        <p className="helper-text">
          Configure the HTTPS URL of your deployed Render Node.js backend. Database credentials are
          kept strictly on the server and never stored in the Android app.
        </p>

        <form onSubmit={handleSave} className="settings-form">
          <label className="field-label">
            <span>Backend API Base URL (HTTPS)</span>
            <input
              type="url"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://your-service.onrender.com"
              className="text-input"
              required
            />
          </label>

          <div className="settings-actions">
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={15} /> Save URL
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
              <RotateCcw size={15} /> Reset Default
            </button>
          </div>
        </form>

        {savedNotice && (
          <div className="alert alert-success">
            <CheckCircle2 size={16} /> Backend API URL saved.
          </div>
        )}

        {testResult && (
          <div
            className={`alert ${
              testResult.backend === 'connected' && testResult.database === 'connected'
                ? 'alert-success'
                : 'alert-danger'
            }`}
          >
            <div className="alert-title-row">
              {testResult.database === 'connected' ? (
                <CheckCircle2 size={17} />
              ) : (
                <AlertTriangle size={17} />
              )}
              <strong>
                Backend: {testResult.backend} • PostgreSQL: {testResult.database}
              </strong>
            </div>
            {testResult.error && <p>{testResult.error}</p>}
          </div>
        )}
      </div>

      <div className="card">
        <h3>Application Architecture</h3>
        <ul className="info-list">
          <li>
            <strong>Scanner Engine:</strong> @capacitor-mlkit/barcode-scanning
          </li>
          <li>
            <strong>JSON Handling:</strong> 100% schema-less dynamic JSONB + raw TEXT preservation
          </li>
          <li>
            <strong>PostgreSQL Table:</strong> <code>qr_scan_records</code>
          </li>
          <li>
            <strong>Security:</strong> No DB credentials bundled in frontend or APK
          </li>
        </ul>
      </div>
    </div>
  );
};
