import React, { useCallback, useEffect, useState } from 'react';
import { Home, QrCode, History, Settings, CheckCircle2, X } from 'lucide-react';
import { HomeScreen } from './screens/HomeScreen';
import { ScannerScreen } from './screens/ScannerScreen';
import { JsonPreviewScreen } from './screens/JsonPreviewScreen';
import { HistoryScreen } from './screens/HistoryScreen';
import { RecordDetailScreen } from './screens/RecordDetailScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { checkHealth, getStats } from './services/api';
import type { HealthStatus, JsonValue, ScanRecord, ScreenName, StatsResponse } from './types/scan';

export const App: React.FC = () => {
  const [screen, setScreen] = useState<ScreenName>('home');
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const [pendingScan, setPendingScan] = useState<{
    raw: string;
    parsed: JsonValue;
  } | null>(null);

  const [selectedRecord, setSelectedRecord] = useState<ScanRecord | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refreshDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    const h = await checkHealth();
    setHealth(h);
    if (h.backend === 'connected' && h.database === 'connected') {
      try {
        const s = await getStats();
        setStats(s);
      } catch {
        // Keep existing stats if stats call fails
      }
    }
    setLoadingDashboard(false);
  }, []);

  useEffect(() => {
    refreshDashboard();
  }, [refreshDashboard]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 4000);
  };

  const handleValidScan = (rawJson: string, parsedJson: JsonValue) => {
    setPendingScan({ raw: rawJson, parsed: parsedJson });
    setScreen('preview');
  };

  const handleSavedRecord = (record: ScanRecord) => {
    setPendingScan(null);
    setSelectedRecord(record);
    setScreen('details');
    showToast(`Saved Record #${record.id} to PostgreSQL.`);
    refreshDashboard();
  };

  const handleCancelPreview = () => {
    setPendingScan(null);
    setScreen('scanner');
  };

  const handleOpenRecord = (record: ScanRecord) => {
    setSelectedRecord(record);
    setScreen('details');
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-title">
          <QrCode size={22} />
          <h1>QR Dimension Scanner</h1>
        </div>
        <span
          className={`header-dot ${
            health?.database === 'connected' ? 'connected' : 'disconnected'
          }`}
          title={`Backend: ${health?.backend || 'unknown'}, DB: ${health?.database || 'unknown'}`}
        />
      </header>

      {toast && (
        <div className="toast-banner">
          <CheckCircle2 size={17} />
          <span>{toast}</span>
          <button type="button" className="toast-close" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}

      <main className="app-main">
        {screen === 'home' && (
          <HomeScreen
            health={health}
            stats={stats}
            loading={loadingDashboard}
            onRefresh={refreshDashboard}
            onNavigate={setScreen}
            onSelectRecord={handleOpenRecord}
          />
        )}

        {screen === 'scanner' && (
          <ScannerScreen
            onValidScan={handleValidScan}
            onCancel={() => setScreen('home')}
          />
        )}

        {screen === 'preview' && pendingScan && (
          <JsonPreviewScreen
            rawJson={pendingScan.raw}
            parsedJson={pendingScan.parsed}
            onSaved={handleSavedRecord}
            onCancel={handleCancelPreview}
          />
        )}

        {screen === 'history' && <HistoryScreen onSelectRecord={handleOpenRecord} />}

        {screen === 'details' && selectedRecord && (
          <RecordDetailScreen
            record={selectedRecord}
            onBack={() => setScreen('history')}
          />
        )}

        {screen === 'settings' && (
          <SettingsScreen onHealthUpdated={(h) => setHealth(h)} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button
          type="button"
          className={`nav-item ${screen === 'home' ? 'active' : ''}`}
          onClick={() => {
            setScreen('home');
            refreshDashboard();
          }}
        >
          <Home size={20} />
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`nav-item ${screen === 'scanner' || screen === 'preview' ? 'active' : ''}`}
          onClick={() => setScreen('scanner')}
        >
          <QrCode size={20} />
          <span>Scan</span>
        </button>

        <button
          type="button"
          className={`nav-item ${screen === 'history' || screen === 'details' ? 'active' : ''}`}
          onClick={() => setScreen('history')}
        >
          <History size={20} />
          <span>History</span>
        </button>

        <button
          type="button"
          className={`nav-item ${screen === 'settings' ? 'active' : ''}`}
          onClick={() => setScreen('settings')}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
