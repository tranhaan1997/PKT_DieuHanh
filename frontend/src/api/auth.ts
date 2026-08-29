import api from './axios';
import type { User } from '../types';

export const logout = () => api.post('/api/auth/logout');

export const getMe = () => api.get<User>('/api/auth/me');

export const refreshTokens = () =>
  api.post<{ accessToken: string; user: User }>('/api/auth/refresh');
