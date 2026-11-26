import type {
  DeviceInfoPayload,
  DuplicateCheckResponse,
  HealthStatus,
  PaginatedScansResponse,
  ScanRecord,
  StatsResponse,
} from '../types/scan';

const API_URL_STORAGE_KEY = 'qr_dimension_scanner_api_url';
const DEFAULT_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export function getApiBaseUrl(): string {
  const custom = localStorage.getItem(API_URL_STORAGE_KEY);
  if (custom && custom.trim().length > 0) {
    return custom.trim().replace(/\/+$/, '');
  }
  return DEFAULT_API_BASE_URL;
}

export function getDefaultApiBaseUrl(): string {
  return DEFAULT_API_BASE_URL;
}

export function setCustomApiBaseUrl(url: string): void {
  const cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) {
    localStorage.removeItem(API_URL_STORAGE_KEY);
  } else {
    localStorage.setItem(API_URL_STORAGE_KEY, cleaned);
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  data?: unknown;

  constructor(message: string, status: number, code?: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    throw new ApiError(
      'Backend API URL is not configured. Open Settings to set your HTTPS backend URL.',
      0,
      'NO_API_URL'
    );
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new ApiError(
      'No internet connection detected. Please reconnect to communicate with the server.',
      0,
      'OFFLINE'
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let data: Record<string, unknown> = {};
    if (text) {
      try {
        data = JSON.parse(text) as Record<string, unknown>;
      } catch {
        data = { error: text };
      }
    }

    if (!response.ok) {
      throw new ApiError(
        (data.error as string) || `Request failed with status ${response.status}`,
        response.status,
        data.code as string | undefined,
        data
      );
    }

    return data as unknown as T;
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Request timed out. Backend server may be waking up or unreachable.', 0, 'TIMEOUT');
    }
    throw new ApiError(
      'Unable to reach the backend server. Check your internet connection or API URL in Settings.',
      0,
      'NETWORK_ERROR'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function checkHealth(): Promise<HealthStatus> {
  try {
    return await requestJson<HealthStatus>('/api/health');
  } catch (err) {
    if (err instanceof ApiError && err.data && typeof err.data === 'object') {
      const data = err.data as Partial<HealthStatus>;
      return {
        status: 'error',
        backend: data.backend || 'disconnected',
        database: data.database || 'disconnected',
        timestamp: new Date().toISOString(),
        error: err.message,
      };
    }
    return {
      status: 'error',
      backend: 'disconnected',
      database: 'disconnected',
      timestamp: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

export function getStats(): Promise<StatsResponse> {
  return requestJson<StatsResponse>('/api/stats');
}

export function checkDuplicate(qrRawData: string): Promise<DuplicateCheckResponse> {
  return requestJson<DuplicateCheckResponse>('/api/scans/check-duplicate', {
    method: 'POST',
    body: JSON.stringify({ qr_raw_data: qrRawData }),
  });
}

export function saveScan(params: {
  qr_raw_data: string;
  qr_format?: string;
  scanned_at?: string;
  device_info?: DeviceInfoPayload | null;
  allow_duplicate?: boolean;
}): Promise<{ message: string; record: ScanRecord }> {
  return requestJson<{ message: string; record: ScanRecord }>('/api/scans', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export function getScans(params: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
} = {}): Promise<PaginatedScansResponse> {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  return requestJson<PaginatedScansResponse>(`/api/scans?${searchParams.toString()}`);
}

export function searchScans(params: {
  q: string;
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
}): Promise<PaginatedScansResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('q', params.q);
  if (params.page) searchParams.set('page', String(params.page));
  if (params.limit) searchParams.set('limit', String(params.limit));
  if (params.from) searchParams.set('from', params.from);
  if (params.to) searchParams.set('to', params.to);
  return requestJson<PaginatedScansResponse>(`/api/scans/search?${searchParams.toString()}`);
}

export function getScanById(id: number): Promise<{ record: ScanRecord }> {
  return requestJson<{ record: ScanRecord }>(`/api/scans/${id}`);
}
