import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Code2, ListTree } from 'lucide-react';
import type { JsonValue } from '../types/scan';
import { copyToClipboard } from '../utils/jsonUtils';

interface JsonTreeViewerProps {
  data: JsonValue;
  rawJson: string;
}

interface JsonNodeProps {
  label?: string;
  value: JsonValue;
  depth: number;
  expandSignal: { version: number; expanded: boolean };
}

const JsonNode: React.FC<JsonNodeProps> = ({ label, value, depth, expandSignal }) => {
  const isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isExpandable = isObject || isArray;

  const [isExpanded, setIsExpanded] = useState<boolean>(depth < 2);

  React.useEffect(() => {
    if (expandSignal.version > 0) {
      setIsExpanded(expandSignal.expanded);
    }
  }, [expandSignal]);

  if (!isExpandable) {
    let valueClass = 'json-val-string';
    let displayValue = '';

    if (value === null) {
      valueClass = 'json-val-null';
      displayValue = 'null';
    } else if (typeof value === 'boolean') {
      valueClass = 'json-val-boolean';
      displayValue = String(value);
    } else if (typeof value === 'number') {
      valueClass = 'json-val-number';
      displayValue = String(value);
    } else {
      valueClass = 'json-val-string';
      displayValue = `"${value}"`;
    }

    return (
      <div className="json-leaf" style={{ paddingLeft: `${depth * 14}px` }}>
        {label !== undefined && <span className="json-key">"{label}": </span>}
        <span className={valueClass}>{displayValue}</span>
      </div>
    );
  }

  const entries = isArray
    ? value.map((item, idx) => [String(idx), item] as const)
    : Object.entries(value);
  const openBracket = isArray ? '[' : '{';
  const closeBracket = isArray ? ']' : '}';

  return (
    <div className="json-branch">
      <button
        type="button"
        className="json-toggle-row"
        style={{ paddingLeft: `${depth * 14}px` }}
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <span className="json-caret">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        {label !== undefined && <span className="json-key">"{label}": </span>}
        <span className="json-bracket">{openBracket}</span>
        {!isExpanded && (
          <span className="json-collapsed-hint">
            {isArray ? ` ${entries.length} items ` : ` ${entries.length} keys `}
            {closeBracket}
          </span>
        )}
      </button>

      {isExpanded && (
        <div>
          {entries.length === 0 ? (
            <div className="json-empty" style={{ paddingLeft: `${(depth + 1) * 14}px` }}>
              (empty)
            </div>
          ) : (
            entries.map(([k, v]) => (
              <JsonNode
                key={`${label ?? 'root'}-${k}`}
                label={isArray ? `[${k}]` : k}
                value={v}
                depth={depth + 1}
                expandSignal={expandSignal}
              />
            ))
          )}
          <div className="json-bracket-close" style={{ paddingLeft: `${depth * 14 + 18}px` }}>
            {closeBracket}
          </div>
        </div>
      )}
    </div>
  );
};

export const JsonTreeViewer: React.FC<JsonTreeViewerProps> = ({ data, rawJson }) => {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const [copied, setCopied] = useState(false);
  const [expandSignal, setExpandSignal] = useState({ version: 0, expanded: true });

  const prettyJson = React.useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return rawJson;
    }
  }, [data, rawJson]);

  const handleCopy = async () => {
    await copyToClipboard(rawJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="json-viewer-card">
      <div className="json-viewer-toolbar">
        <div className="json-viewer-tabs">
          <button
            type="button"
            className={`chip-btn ${viewMode === 'tree' ? 'active' : ''}`}
            onClick={() => setViewMode('tree')}
          >
            <ListTree size={14} /> Tree
          </button>
          <button
            type="button"
            className={`chip-btn ${viewMode === 'raw' ? 'active' : ''}`}
            onClick={() => setViewMode('raw')}
          >
            <Code2 size={14} /> Pretty JSON
          </button>
        </div>

        <div className="json-viewer-actions">
          {viewMode === 'tree' && (
            <>
              <button
                type="button"
                className="chip-btn"
                onClick={() => setExpandSignal((s) => ({ version: s.version + 1, expanded: true }))}
              >
                Expand All
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={() => setExpandSignal((s) => ({ version: s.version + 1, expanded: false }))}
              >
                Collapse
              </button>
            </>
          )}
          <button type="button" className="chip-btn copy-btn" onClick={handleCopy}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy JSON'}
          </button>
        </div>
      </div>

      {viewMode === 'tree' ? (
        <div className="json-tree-container">
          <JsonNode value={data} depth={0} expandSignal={expandSignal} />
        </div>
      ) : (
        <pre className="json-raw-pre">{prettyJson}</pre>
      )}
    </div>
  );
};
