import React, { useState } from 'react';
import { ArrowLeft, Copy, Download, Check, Calendar, Smartphone } from 'lucide-react';
import { JsonTreeViewer } from '../components/JsonTreeViewer';
import { copyToClipboard, downloadJsonFile } from '../utils/jsonUtils';
import type { ScanRecord } from '../types/scan';

interface RecordDetailScreenProps {
  record: ScanRecord;
  onBack: () => void;
}

export const RecordDetailScreen: React.FC<RecordDetailScreenProps> = ({ record, onBack }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(record.qr_raw_data);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="screen-content">
      <div className="detail-top-bar">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onBack}>
          <ArrowLeft size={16} /> Back
        </button>
        <div className="detail-top-actions">
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopy}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => downloadJsonFile(`qr-scan-${record.id}.json`, record.qr_raw_data)}
          >
            <Download size={15} /> Download
          </button>
        </div>
      </div>

      <div className="card">
        <div className="record-card-top">
          <h2>Record #{record.id}</h2>
          <span className="format-badge">{record.qr_format}</span>
        </div>

        <div className="meta-list">
          <div className="meta-row">
            <span className="meta-label">
              <Calendar size={14} /> Scanned At
            </span>
            <span className="meta-value">{new Date(record.scanned_at).toLocaleString()}</span>
          </div>
          <div className="meta-row">
            <span className="meta-label">
              <Calendar size={14} /> Stored At
            </span>
            <span className="meta-value">{new Date(record.created_at).toLocaleString()}</span>
          </div>
          {record.device_info && (
            <div className="meta-row">
              <span className="meta-label">
                <Smartphone size={14} /> Device
              </span>
              <span className="meta-value">
                {[record.device_info.manufacturer, record.device_info.model, record.device_info.platform]
                  .filter(Boolean)
                  .join(' • ') || 'Unknown'}
              </span>
            </div>
          )}
        </div>
      </div>

      <JsonTreeViewer data={record.qr_parsed_data} rawJson={record.qr_raw_data} />
    </div>
  );
};
