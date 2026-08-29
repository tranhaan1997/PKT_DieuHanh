import api from './axios';
import type { DashboardSummary } from '../types';

export const getDashboardSummary = (periodId?: number) =>
  api.get<DashboardSummary>('/api/dashboard/summary', { params: periodId ? { periodId } : {} });

export const getDashboardByPeriod = () => api.get('/api/dashboard/by-period');

export const getDashboardBySolution = (periodId?: number) =>
  api.get('/api/dashboard/by-solution', { params: periodId ? { periodId } : {} });

export const getDashboardByProvince = () => api.get('/api/dashboard/by-province');

export const getDashboardByTtkv = (periodId?: number) =>
  api.get('/api/dashboard/by-ttkv', { params: periodId ? { periodId } : {} });

export const getDashboardMaterialProgress = (periodId?: number) =>
  api.get('/api/dashboard/material-progress', { params: periodId ? { periodId } : {} });

export const getDashboardMaterialProgressByTtkv = (periodId?: number) =>
  api.get('/api/dashboard/material-progress-by-ttkv', { params: periodId ? { periodId } : {} });
