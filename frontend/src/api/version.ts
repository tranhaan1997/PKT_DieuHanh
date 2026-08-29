import api from './axios';

export interface VersionInfo {
  version: string;
  buildSha: string;
}

export const getBackendVersion = () =>
  api.get<VersionInfo>('/api/version').then((r) => r.data);

export const frontendVersion: VersionInfo = {
  version: import.meta.env.VITE_APP_VERSION ?? 'dev',
  buildSha: (import.meta.env.VITE_BUILD_SHA ?? 'local').slice(0, 7),
};
