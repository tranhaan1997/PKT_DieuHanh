import api from './axios';
import type { Site, PaginatedResponse } from '../types';

export const getSites = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<Site>>('/api/sites', { params });

export const getSite = (id: number) => api.get<Site>(`/api/sites/${id}`);

export const createSite = (data: Partial<Site>) => api.post<Site>('/api/sites', data);

export const updateSite = (id: number, data: Partial<Site>) => api.put<Site>(`/api/sites/${id}`, data);

export const deleteSite = (id: number) => api.delete(`/api/sites/${id}`);

export const importSites = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<{ imported: number; updated: number; errors: string[] }>('/api/sites/import', fd);
};

export const exportSites = () =>
  api.get('/api/sites/export', { responseType: 'blob' });

export const downloadSiteTemplate = () =>
  api.get('/api/sites/template', { responseType: 'blob' });

export const bulkDeleteSites = (ids: number[]) =>
  api.delete<{ deleted: number; skipped: string[] }>('/api/sites/bulk', { data: { ids } });
