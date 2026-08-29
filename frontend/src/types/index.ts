export type UserRole = 'ADMIN' | 'SUPERVISOR' | 'TECHNICIAN' | 'VIEWER';

export interface User {
  id: number;
  username: string;
  fullName: string;
  email?: string;
  role: UserRole;
  active: boolean;
  ssoId?: string | null;
  department?: string | null;
  phone?: string | null;
  position?: string | null;
  lastLogin?: string | null;
}

export interface TtkvRef {
  code: string;
  name: string;
}

export interface Site {
  id: number;
  siteCode: string;
  siteName: string;
  province?: string;
  district?: string;
  siteType?: string;
  ttkvCode?: string;
  ttkv?: TtkvRef;
  address?: string;
  managerName?: string;
  phone?: string;
  sector5G?: number;
  latitude?: number;
  longitude?: number;
  active: boolean;
}

export interface Solution {
  id: number;
  solutionCode: string;
  solutionName: string;
  description?: string;
  expectedDays: number;
  active: boolean;
}

export type PeriodStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

export interface Period {
  id: number;
  periodCode: string;
  periodName: string;
  startDate: string;
  endDate: string;
  status: PeriodStatus;
  createdAt: string;
  createdBy?: { fullName: string };
  _count?: { workOrders: number; periodSolutions: number; periodSites: number };
  siteCount?: number;
  googleSheetId?: string | null;
  googleSheetTab?: string | null;
  googleSheetStartRow?: number | null;
  googleSheetSiteCol?: string | null;
  periodSolutions?: Array<{
    solution: Solution;
    sheetTab?: string | null;
    sheetStartRow?: number | null;
    sheetSiteCol?: string | null;
    sheetWrittenCol?: string | null;
    sheetActCol?: string | null;
    sheetTtkvCol?: string | null;
    sheetSiteRecvCol?: string | null;
    sheetProgressStartCol?: string | null;
    genCol?: string | null;
  }>;
  periodSites?: Array<{ site: Site }>;
  periodUsers?: Array<{ user: User }>;
}

export type WrittenTicketStatus = 'EMPTY' | 'WRITTEN';
export type MaterialStatus = 'EMPTY' | 'RECEIVED' | 'TRANSFERRED';
export type InstallStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
export type PhotoStatus = 'NOT_TAKEN' | 'TAKEN';
export type SlaStatus = 'Đúng hạn' | 'Sắp quá hạn' | 'Quá hạn' | 'Hoàn thành';

export interface WorkOrder {
  id: number;
  ticketNo: string;
  periodId: number;
  siteId: number;
  solutionId: number;
  createdAt: string;
  writtenTicket: WrittenTicketStatus;
  actReceivedMaterial: MaterialStatus;
  ttkvReceivedMaterial: MaterialStatus;
  siteReceivedMaterial: MaterialStatus;
  planDate?: string;
  executorName?: string;
  installationStatus: InstallStatus;
  photoStatus: PhotoStatus;
  integrationStatus: InstallStatus;
  note?: string;
  issue?: string;
  completedDate?: string;
  label?: string;
  sheetRow?: number | null;
  sheetSyncedAt?: string | null;
  sheetSyncError?: string | null;
  officeUpdatedAt?: string;
  officeUpdatedBy?: { fullName: string };
  techUpdatedAt?: string;
  techUpdatedBy?: { fullName: string };
  slaStatus: SlaStatus;
  site?: Pick<Site, 'siteCode' | 'siteName' | 'province' | 'district' | 'address' | 'ttkv' | 'ttkvCode'>;
  solution?: Pick<Solution, 'solutionCode' | 'solutionName' | 'expectedDays'>;
  period?: Pick<Period, 'periodCode' | 'periodName' | 'status'>;
  createdBy?: { fullName: string };
}

export interface DashboardSummary {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  overdue: number;
  nearDeadline: number;
  hasIssue: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
