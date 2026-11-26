export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export interface DeviceInfoPayload {
  platform?: string;
  model?: string;
  manufacturer?: string;
  osVersion?: string;
  appVersion?: string;
}

export interface ScanRecord {
  id: number;
  qr_raw_data: string;
  qr_parsed_data: JsonValue;
  qr_format: string;
  scanned_at: string;
  device_info: DeviceInfoPayload | null;
  created_at: string;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  backend: 'connected' | 'disconnected';
  database: 'connected' | 'disconnected';
  timestamp: string;
  dbTime?: string;
  error?: string;
}

export interface StatsResponse {
  totalRecords: number;
  latestScan: ScanRecord | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedScansResponse {
  data: ScanRecord[];
  pagination: PaginationInfo;
  query?: string;
}

export interface DuplicateCheckResponse {
  isDuplicate: boolean;
  existingCount: number;
  latestMatch: {
    id: number;
    scanned_at: string;
    created_at?: string;
  } | null;
}

export type ScreenName = 'home' | 'scanner' | 'preview' | 'history' | 'details' | 'settings';
