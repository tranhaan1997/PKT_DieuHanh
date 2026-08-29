import api from './axios';
import type { Solution } from '../types';

export const getSolutions = () => api.get<Solution[]>('/api/solutions');

export const createSolution = (data: Partial<Solution>) => api.post<Solution>('/api/solutions', data);

export const updateSolution = (id: number, data: Partial<Solution>) =>
  api.put<Solution>(`/api/solutions/${id}`, data);

export const deleteSolution = (id: number) => api.delete(`/api/solutions/${id}`);

export const bulkDeleteSolutions = (ids: number[]) =>
  api.delete<{ deleted: number; skipped: string[] }>('/api/solutions/bulk', { data: { ids } });
