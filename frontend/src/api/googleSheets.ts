import api from './axios';

export interface WoPreviewItem {
  siteCode: string;
  solutionCode: string;
  solutionName?: string;
  siteFound: boolean;
  solutionFound: boolean;
  alreadyExists: boolean;
}

export interface SheetPreview {
  periodCode: string;
  periodName: string;
  /** Solutions assigned to this period */
  periodSolutions: { code: string; name: string }[];
  /** Sheet columns that exist in system but NOT assigned to this period (will be ignored) */
  notInPeriod: string[];
  items: WoPreviewItem[];
  toCreate: number;
  alreadyExists: number;
  siteNotFound: string[];
  /** Solution codes in sheet not found in system DB at all */
  solutionNotFound: string[];
  /** Mã trạm xuất hiện ở nhiều hơn 1 dòng trong Sheet */
  duplicateSites: string[];
  errors: string[];
}

export interface SheetImportResult {
  created: number;
  skipped: number;
  errors: string[];
  total?: number;
}

export interface SheetStatus {
  title: string;
  url: string;
}

export const getSheetStatus = () =>
  api.get<SheetStatus>('/api/google-sheets/status').then((r) => r.data);

export const previewWOsFromSheet = (periodCode: string) =>
  api.get<SheetPreview>(`/api/google-sheets/preview/${encodeURIComponent(periodCode)}`).then((r) => r.data);

export const importWOsFromSheet = (periodCode: string) =>
  api.post<SheetImportResult>('/api/google-sheets/import-workorders', { periodCode }).then((r) => r.data);

export interface StatusSyncItem {
  siteCode: string;
  current: { writtenTicket: string; actReceivedMaterial: string; ttkvReceivedMaterial: string; siteReceivedMaterial: string };
  sheet: { writtenTicket: string; actReceivedMaterial: string; ttkvReceivedMaterial: string; siteReceivedMaterial: string };
  changed: boolean;
}

export interface StatusSyncPreview {
  periodCode: string;
  solutionCode: string;
  items: StatusSyncItem[];
  toUpdate: number;
  unchanged: number;
  siteNotFound: string[];
  /** Mã trạm xuất hiện ở nhiều hơn 1 dòng trong Sheet */
  duplicateSites: string[];
  errors: string[];
}

export interface StatusSyncResult {
  updated: number;
  errors: string[];
}

export const previewStatusSync = (periodCode: string, solutionId: number) =>
  api.get<StatusSyncPreview>(`/api/google-sheets/status-preview/${encodeURIComponent(periodCode)}/${solutionId}`).then((r) => r.data);

export const syncStatusesFromSheet = (periodCode: string, solutionId: number) =>
  api.post<StatusSyncResult>('/api/google-sheets/sync-status', { periodCode, solutionId }).then((r) => r.data);

export interface ProgressFields {
  planDate?: string;
  executorName?: string;
  installationStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  photoStatus?: 'NOT_TAKEN' | 'TAKEN';
  integrationStatus?: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
  note?: string;
  issue?: string;
  completedDate?: string;
}

export interface ProgressSyncItem {
  siteCode: string;
  current: ProgressFields;
  sheet: ProgressFields;
  changed: boolean;
}

export interface ProgressSyncPreview {
  periodCode: string;
  solutionCode: string;
  items: ProgressSyncItem[];
  toUpdate: number;
  unchanged: number;
  siteNotFound: string[];
  errors: string[];
}

export const previewProgressSync = (periodCode: string, solutionId: number) =>
  api.get<ProgressSyncPreview>(`/api/google-sheets/progress-preview/${encodeURIComponent(periodCode)}/${solutionId}`).then((r) => r.data);

export const syncProgressFromSheet = (periodCode: string, solutionId: number) =>
  api.post<StatusSyncResult>('/api/google-sheets/sync-progress', { periodCode, solutionId }).then((r) => r.data);
