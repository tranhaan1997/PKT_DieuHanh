import api from './axios';

export interface AppNotification {
  id: number;
  workOrderId: number;
  type: 'MATERIAL_UPDATED' | 'CONSTRUCTION_COMPLETED' | 'INTEGRATION_COMPLETED' | 'TICKET_READY';
  message: string;
  read: boolean;
  createdAt: string;
  workOrder: {
    ticketNo: string;
    site: { siteCode: string; siteName: string } | null;
    period: { periodName: string } | null;
  };
}

export interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export const getNotifications = () => api.get<NotificationsResponse>('/api/notifications');
export const markNotifRead = (id: number) => api.put(`/api/notifications/${id}/read`);
export const markAllNotifsRead = () => api.put('/api/notifications/read-all');
