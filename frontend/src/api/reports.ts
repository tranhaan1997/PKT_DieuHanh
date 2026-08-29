import api from './axios';

export interface ReportFilter {
  periodId?: string;
  solutionId?: string;
}

export interface SummaryRow {
  solutionId: number;
  solutionName: string;
  total: number;
  written: number;
  actReceived: number;
  ttkvReceived: number;
  siteReceived: number;
  installInProgress: number;
  installCompleted: number;
  integrationCompleted: number;
  cancelled: number;
}

export interface SummaryByTtkv {
  ttkvCode: string;
  ttkvName: string;
  rows: SummaryRow[];
}

export interface SummaryReport {
  company: SummaryRow[];
  byTtkv: SummaryByTtkv[];
}

export interface StaffPerfRow {
  userId: number;
  fullName: string;
  woCount: number;
  avgHoursToUpdate: number | null;
}

export interface StaffPerformance {
  office: StaffPerfRow[];
  tech: StaffPerfRow[];
}

export interface MaterialBottleneck {
  stuckByStage: Array<{ stage: string; count: number; avgDaysStuck: number }>;
  stuckItems: Array<{ ticketNo: string; siteCode?: string; siteName?: string; stage: string; daysStuck: number }>;
  avgDaysPerStage: Array<{ stage: string; avgDays: number | null }>;
}

export interface IssueRow {
  ticketNo: string;
  siteName: string;
  solutionName: string;
  periodName: string;
  issue: string | null;
  techUpdatedByName: string;
  techUpdatedAt: string | null;
}

export interface TrendFilter {
  solutionId?: string;
}

export interface TrendRow {
  periodId: number;
  periodCode: string;
  periodName: string;
  total: number;
  written: number;
  installCompleted: number;
  integrationCompleted: number;
  cancelled: number;
}

const toParams = (f: ReportFilter | TrendFilter) => f as Record<string, string>;

export const getSummaryReport = (filter: ReportFilter) =>
  api.get<SummaryReport>('/api/reports/summary', { params: toParams(filter) }).then((r) => r.data);

export const exportSummaryReport = (filter: ReportFilter) =>
  api.get('/api/reports/summary/export', { params: toParams(filter), responseType: 'blob' });

export const getStaffPerformance = (filter: ReportFilter) =>
  api.get<StaffPerformance>('/api/reports/staff-performance', { params: toParams(filter) }).then((r) => r.data);

export const exportStaffPerformance = (filter: ReportFilter) =>
  api.get('/api/reports/staff-performance/export', { params: toParams(filter), responseType: 'blob' });

export const getMaterialBottleneck = (filter: ReportFilter) =>
  api.get<MaterialBottleneck>('/api/reports/material-bottleneck', { params: toParams(filter) }).then((r) => r.data);

export const exportMaterialBottleneck = (filter: ReportFilter) =>
  api.get('/api/reports/material-bottleneck/export', { params: toParams(filter), responseType: 'blob' });

export const getIssues = (filter: ReportFilter) =>
  api.get<IssueRow[]>('/api/reports/issues', { params: toParams(filter) }).then((r) => r.data);

export const exportIssues = (filter: ReportFilter) =>
  api.get('/api/reports/issues/export', { params: toParams(filter), responseType: 'blob' });

export const getTrend = (filter: TrendFilter) =>
  api.get<TrendRow[]>('/api/reports/trend', { params: toParams(filter) }).then((r) => r.data);

export const exportTrend = (filter: TrendFilter) =>
  api.get('/api/reports/trend/export', { params: toParams(filter), responseType: 'blob' });
