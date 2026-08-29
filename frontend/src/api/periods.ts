import api from './axios';
import type { Period } from '../types';

export const getPeriods = () => api.get<Period[]>('/api/periods');

export const getPeriod = (id: number) => api.get<Period>(`/api/periods/${id}`);

export const createPeriod = (data: Partial<Period>) => api.post<Period>('/api/periods', data);

export const updatePeriod = (id: number, data: Partial<Period>) =>
  api.put<Period>(`/api/periods/${id}`, data);

export const deletePeriod = (id: number) => api.delete(`/api/periods/${id}`);

export const assignSupervisors = (id: number, userIds: number[]) =>
  api.post(`/api/periods/${id}/supervisors`, { userIds });

export const assignSolutions = (id: number, solutionIds: number[]) =>
  api.post<Period>(`/api/periods/${id}/solutions`, { solutionIds });

export const assignSites = (id: number, siteIds: number[]) =>
  api.post<Period>(`/api/periods/${id}/sites`, { siteIds });

export const generateWorkOrders = (id: number) =>
  api.post<{ message: string; created: number }>(`/api/periods/${id}/generate-workorders`);

export interface SolutionSheetConfig {
  sheetTab?: string;
  sheetStartRow?: number;
  sheetSiteCol?: string;
  sheetWrittenCol?: string;
  sheetActCol?: string;
  sheetTtkvCol?: string;
  sheetSiteRecvCol?: string;
  sheetPlanDateCol?: string;
  sheetExecutorCol?: string;
  sheetInstallCol?: string;
  sheetPhotoCol?: string;
  sheetIntegrationCol?: string;
  sheetNoteCol?: string;
  sheetIssueCol?: string;
  sheetCompletedDateCol?: string;
}

export const updateSolutionSheetConfig = (id: number, solutionId: number, config: SolutionSheetConfig) =>
  api.put<Period>(`/api/periods/${id}/solutions/${solutionId}/sheet-config`, config);

export const updateSolutionGenCol = (id: number, solutionId: number, genCol: string) =>
  api.put<Period>(`/api/periods/${id}/solutions/${solutionId}/gen-col`, { genCol });
