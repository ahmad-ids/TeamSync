import axios from 'axios';
import { readStoredSession } from './authStorage';
import { resolveApiBaseUrl } from './authEndpoints';

export const apiClient = axios.create({
  baseURL: resolveApiBaseUrl(),
  timeout: 10000,
});

apiClient.interceptors.request.use((config) => {
  const session = readStoredSession();
  if (session?.token) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  return config;
});
