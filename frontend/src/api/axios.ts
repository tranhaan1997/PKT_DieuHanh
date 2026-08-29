import axios from 'axios';

let accessToken: string | null = null;

export const setAccessToken = (token: string | null) => { accessToken = token; };
export const getAccessToken = () => accessToken;

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  withCredentials: true,
  // Tránh request treo vô hạn (mạng di động chập chờn) — Google Sheets API
  // có thể chậm với sheet lớn, nên để dư thời gian thay vì timeout ngắn.
  timeout: 45_000,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: any) => void; reject: (e: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;
    const isRefreshEndpoint = originalRequest.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await api.post('/api/auth/refresh');
        setAccessToken(data.accessToken);
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        setAccessToken(null);
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

/** Rút thông báo lỗi dễ hiểu từ lỗi axios — xử lý riêng timeout/mất kết nối mạng. */
export function getApiErrorMessage(err: unknown, fallback = 'Đã có lỗi xảy ra'): string {
  const e = err as { code?: string; message?: string; response?: { data?: { message?: string | object } } };
  if (e?.code === 'ECONNABORTED') return 'Hết thời gian chờ phản hồi — mạng chậm hoặc Google Sheets xử lý quá lâu, vui lòng thử lại';
  if (!e?.response && e?.message?.toLowerCase().includes('network')) return 'Mất kết nối mạng — kiểm tra lại đường truyền và thử lại';
  const msg = e?.response?.data?.message;
  if (typeof msg === 'string') return msg;
  if (msg && typeof msg === 'object') return JSON.stringify(msg);
  return e?.message || fallback;
}

export default api;
