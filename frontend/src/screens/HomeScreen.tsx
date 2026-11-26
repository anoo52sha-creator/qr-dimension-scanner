import React from 'react';
import {
  QrCode,
  History,
  Database,
  Server,
  RefreshCw,
  Clock,
  ChevronRight,
  Layers,
} from 'lucide-react';
import type { HealthStatus, ScanRecord, ScreenName, StatsResponse } from '../types/scan';
import { summarizeJsonPreview } from '../utils/jsonUtils';

interface HomeScreenProps {
  health: HealthStatus | null;
  stats: StatsResponse | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (screen: ScreenName) => void;
  onSelectRecord: (record: ScanRecord) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  health,
  stats,
  loading,
  onRefresh,
  onNavigate,
  onSelectRecord,
}) => {
  const backendConnected = health?.backend === 'connected';
  const dbConnected = health?.database === 'connected';

  return (
    <div className="screen-content">
      <div className="hero-card">
        <div className="hero-badge">Dynamic JSON + PostgreSQL</div>
        <h2>QR Dimension Scanner</h2>
        <p>
          Scan any QR code containing arbitrary JSON data. All properties, nested objects, arrays,
          and values are preserved dynamically.
        </p>

        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => onNavigate('scanner')}
          >
            <QrCode size={20} />
            SCAN QR CODE
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate('history')}
          >
            <History size={18} />
            Scan History
          </button>
        </div>
      </div>

      <div className="section-header">
        <h3>System Status</h3>
        <button
          type="button"
          className="icon-text-btn"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh status"
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          {loading ? 'Checking...' : 'Refresh'}
        </button>
      </div>

      <div className="status-grid">
        <div className="status-card">
          <div className="status-icon-row">
            <Server size={18} />
            <span>Backend API</span>
          </div>
          <div className={`status-pill ${backendConnected ? 'ok' : 'err'}`}>
            <span className="dot" />
            {backendConnected ? 'Connected' : 'Unavailable'}
          </div>
        </div>

        <div className="status-card">
          <div className="status-icon-row">
            <Database size={18} />
            <span>PostgreSQL</span>
          </div>
          <div className={`status-pill ${dbConnected ? 'ok' : 'err'}`}>
            <span className="dot" />
            {dbConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
      </div>

      {health?.error && !dbConnected && (
        <div className="alert alert-warning">
          <strong>Connection Notice:</strong> {health.error}
        </div>
      )}

      <div className="stats-card">
        <div className="stats-main">
          <div className="stats-icon">
            <Layers size={22} />
          </div>
          <div>
            <div className="stats-label">Total Saved Records</div>
            <div className="stats-value">{stats ? stats.totalRecords : '—'}</div>
          </div>
        </div>
      </div>

      <div className="section-header">
        <h3>Last Scanned Record</h3>
      </div>

      {stats?.latestScan ? (
        <button
          type="button"
          className="record-card clickable"
          onClick={() => onSelectRecord(stats.latestScan!)}
        >
          <div className="record-card-top">
            <span className="record-id">Record #{stats.latestScan.id}</span>
            <span className="format-badge">{stats.latestScan.qr_format}</span>
          </div>
          <div className="record-preview-text">
            {summarizeJsonPreview(stats.latestScan.qr_parsed_data)}
          </div>
          <div className="record-card-footer">
            <span className="record-time">
              <Clock size={13} />
              {new Date(stats.latestScan.scanned_at).toLocaleString()}
            </span>
            <span className="view-link">
              Details <ChevronRight size={14} />
            </span>
          </div>
        </button>
      ) : (
        <div className="empty-card">
          No records saved yet. Tap <strong>SCAN QR CODE</strong> to capture your first JSON QR.
        </div>
      )}
    </div>
  );
};
