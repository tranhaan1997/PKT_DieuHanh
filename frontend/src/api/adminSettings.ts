import api from './axios';

export interface GoogleSheetsConfig {
  hasServiceAccount: boolean;
}

export const getGoogleSheetsConfig = () =>
  api.get<GoogleSheetsConfig>('/api/admin/settings/google-sheets').then((r) => r.data);

export const saveGoogleSheetsConfig = (payload: {
  googleServiceAccountJson: string;
}) => api.put<{ success: boolean; error?: string }>('/api/admin/settings/google-sheets', payload).then((r) => r.data);

export const getSheetWriteBackConfig = () =>
  api.get<{ enabled: boolean }>('/api/admin/settings/sheet-write-back').then((r) => r.data);

export const saveSheetWriteBackConfig = (enabled: boolean) =>
  api.put<{ success: boolean; enabled: boolean }>('/api/admin/settings/sheet-write-back', { enabled }).then((r) => r.data);

export interface AutoStatusSyncConfig {
  enabled: boolean;
  intervalMinutes: number;
}

export interface AutoSyncUpdatedItem {
  periodCode: string;
  solutionCode: string;
  ticketNo: string;
  siteCode: string;
  siteName: string;
  changes: Record<string, { from: string; to: string }>;
}

export interface AutoSyncRun {
  id: number;
  startedAt: string;
  finishedAt: string;
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
  periodsProcessed: number;
  totalUpdated: number;
  errors: string[] | null;
  updatedItems: AutoSyncUpdatedItem[] | null;
}

export const getAutoStatusSyncConfig = () =>
  api.get<AutoStatusSyncConfig>('/api/admin/settings/auto-status-sync').then((r) => r.data);

export const saveAutoStatusSyncConfig = (payload: AutoStatusSyncConfig) =>
  api.put<{ success: boolean }>('/api/admin/settings/auto-status-sync', payload).then((r) => r.data);

export const getAutoStatusSyncRuns = () =>
  api.get<AutoSyncRun[]>('/api/admin/settings/auto-status-sync/runs').then((r) => r.data);

export const runAutoStatusSyncNow = () =>
  api.post<{ success: boolean; message?: string; run?: AutoSyncRun }>('/api/admin/settings/auto-status-sync/run-now').then((r) => r.data);
