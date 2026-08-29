import api from './axios';

export interface UserOption {
  id: number;
  fullName: string;
  role: string;
  username: string;
  department?: string;
}

export const getUsers = () => api.get<UserOption[]>('/api/users');
