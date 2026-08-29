import api from './axios';

export interface Ttkv {
  code: string;
  name: string;
}

export const getTtkvs = () => api.get<Ttkv[]>('/api/ttkvs').then((r) => r.data);

export const createTtkv = (data: { code: string; name: string }) =>
  api.post<Ttkv>('/api/ttkvs', data).then((r) => r.data);

export const updateTtkv = (code: string, data: { name: string }) =>
  api.put<Ttkv>(`/api/ttkvs/${code}`, data).then((r) => r.data);

export const deleteTtkv = (code: string) =>
  api.delete(`/api/ttkvs/${code}`).then((r) => r.data);
