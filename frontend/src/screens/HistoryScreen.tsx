import React, { useCallback, useEffect, useState } from 'react';
import {
  Search,
  Calendar,
  Copy,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Check,
} from 'lucide-react';
import { getScans, searchScans } from '../services/api';
import { copyToClipboard, downloadJsonFile, summarizeJsonPreview } from '../utils/jsonUtils';
import type { PaginationInfo, ScanRecord } from '../types/scan';

interface HistoryScreenProps {
  onSelectRecord: (record: ScanRecord) => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ onSelectRecord }) => {
  const [records, setRecords] = useState<ScanRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const loadRecords = useCallback(
    async (pageToLoad = 1) => {
      setLoading(true);
      setErrorMsg(null);
      try {
        const trimmed = searchQuery.trim();
        const response = trimmed
          ? await searchScans({
              q: trimmed,
              page: pageToLoad,
              limit: 15,
              from: fromDate || undefined,
              to: toDate || undefined,
            })
          : await getScans({
              page: pageToLoad,
              limit: 15,
              from: fromDate || undefined,
              to: toDate || undefined,
            });
        setRecords(response.data);
        setPagination(response.pagination);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load scan history.');
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, fromDate, toDate]
  );

  useEffect(() => {
    loadRecords(1);
  }, [loadRecords]);

  const handleCopy = async (record: ScanRecord) => {
    await copyToClipboard(record.qr_raw_data);
    setCopiedId(record.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadRecords(1);
  };

  return (
    <div className="screen-content">
      <div className="card">
        <div className="section-header">
          <h2>Scan History</h2>
          <button
            type="button"
            className="icon-text-btn"
            onClick={() => loadRecords(pagination.page)}
            disabled={loading}
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className="filter-form">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search any JSON key or value..."
              className="text-input with-icon"
            />
          </div>

          <div className="date-filter-row">
            <label className="date-field">
              <span>
                <Calendar size={13} /> From
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-input"
              />
            </label>
            <label className="date-field">
              <span>
                <Calendar size={13} /> To
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-input"
              />
            </label>
          </div>

          <div className="filter-actions">
            <button type="submit" className="btn btn-primary btn-sm">
              Apply Filter
            </button>
            {(searchQuery || fromDate || toDate) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setFromDate('');
                  setToDate('');
                }}
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {errorMsg && (
        <div className="alert alert-danger">
          <strong>Error:</strong> {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="empty-card">Loading scan records from PostgreSQL...</div>
      ) : records.length === 0 ? (
        <div className="empty-card">No matching scan records found.</div>
      ) : (
        <>
          <div className="results-meta">
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </div>

          <div className="history-list">
            {records.map((rec) => {
              const dt = new Date(rec.scanned_at);
              return (
                <div key={rec.id} className="record-card">
                  <div className="record-card-top">
                    <span className="record-id">ID #{rec.id}</span>
                    <span className="format-badge">{rec.qr_format}</span>
                  </div>

                  <div className="record-datetime">
                    {dt.toLocaleDateString()} • {dt.toLocaleTimeString()}
                  </div>

                  <div className="record-preview-text">
                    {summarizeJsonPreview(rec.qr_parsed_data)}
                  </div>

                  <div className="record-actions">
                    <button
                      type="button"
                      className="chip-btn primary"
                      onClick={() => onSelectRecord(rec)}
                    >
                      <Eye size={14} /> View JSON
                    </button>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() => handleCopy(rec)}
                    >
                      {copiedId === rec.id ? <Check size={14} /> : <Copy size={14} />}
                      {copiedId === rec.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      className="chip-btn"
                      onClick={() =>
                        downloadJsonFile(`qr-scan-${rec.id}.json`, rec.qr_raw_data)
                      }
                    >
                      <Download size={14} /> Download
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pagination-bar">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pagination.page <= 1}
              onClick={() => loadRecords(pagination.page - 1)}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="page-indicator">
              Page {pagination.page} / {pagination.totalPages}
            </span>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => loadRecords(pagination.page + 1)}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </>
      )}
    </div>
  );
};
