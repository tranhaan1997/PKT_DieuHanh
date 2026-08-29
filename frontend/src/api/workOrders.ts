import api from './axios';
import type { WorkOrder, PaginatedResponse } from '../types';

export const getWorkOrders = (params?: Record<string, string>) =>
  api.get<PaginatedResponse<WorkOrder>>('/api/work-orders', { params });

export const getWorkOrder = (id: number) => api.get<WorkOrder>(`/api/work-orders/${id}`);

export const updateWorkOrder = (id: number, data: Partial<WorkOrder>) =>
  api.put<WorkOrder>(`/api/work-orders/${id}`, data);

export const deleteWorkOrder = (id: number) => api.delete(`/api/work-orders/${id}`);

export const exportWorkOrders = (params?: Record<string, string>) =>
  api.get('/api/work-orders/export', { params, responseType: 'blob' });

export const getWorkOrderLogs = (id: number) =>
  api.get<WorkOrderLog[]>(`/api/work-orders/${id}/logs`);

export const getMyWorkOrderLogs = (params: { search?: string; page?: number; limit?: number }) =>
  api.get<MyWorkOrderLogPage>('/api/work-orders/my-logs', { params }).then((r) => r.data);

export const bulkDeleteWorkOrders = (ids: number[]) =>
  api.post<{ deleted: number }>('/api/work-orders/bulk-delete', { ids }).then((r) => r.data);

export const getWoLabels = () =>
  api.get<string[]>('/api/work-orders/labels').then((r) => r.data);

export const deleteWorkOrdersByLabel = (label: string) =>
  api.delete<{ deleted: number }>(`/api/work-orders/by-label/${encodeURIComponent(label)}`).then((r) => r.data);

export const retrySheetSync = (id: number) =>
  api.post<{ success: boolean; error?: string }>(`/api/work-orders/${id}/sync-sheet`).then((r) => r.data);

export const dismissSheetSyncError = (id: number) =>
  api.post<WorkOrder>(`/api/work-orders/${id}/sync-sheet/dismiss`).then((r) => r.data);

export const importMaterials = (file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<{ updated: number; errors: string[]; total: number }>('/api/work-orders/import-materials', fd);
};

export interface WorkOrderLog {
  id: number;
  workOrderId: number;
  userId: number;
  changes: Record<string, { from: string | null; to: string | null }>;
  createdAt: string;
  user: { fullName: string; username: string; role: string };
}

export interface MyWorkOrderLog {
  id: number;
  workOrderId: number;
  userId: number;
  changes: Record<string, { from: string | null; to: string | null }>;
  createdAt: string;
  workOrder: {
    id: number;
    ticketNo: string;
    site: { siteCode: string; siteName: string } | null;
    solution: { solutionName: string } | null;
    period: { periodName: string } | null;
  };
}

export interface MyWorkOrderLogPage {
  items: MyWorkOrderLog[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
