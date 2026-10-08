import { apiClient } from './apiClient';
import { AxiosError } from 'axios';
import type {
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResponse,
  OAuthExchangeRequest,
  RegisterRequest,
  RegisterResponse,
  ResetPasswordRequest,
} from '../types/auth';

export interface ExternalProvidersResponse {
  clickup: boolean;
}

export interface ClickUpWorkspace {
  workspaceId: string;
  workspaceName: string;
}

export interface ClickUpConnection {
  workspaceId: string;
  workspaceName: string;
  isActive: boolean;
}

export interface ClickUpDiscoveryStructure {
  workspaceId: string;
  workspaceName: string;
  spaceCount: number;
  folderCount: number;
  listCount: number;
}

export interface ClickUpDiscoveryTask {
  id: string;
}

interface ExternalProvidersApiResponse {
  clickup: boolean;
}

interface ClickUpWorkspacesApiResponseItem {
  workspaceId: string;
  workspaceName: string;
}

interface ClickUpConnectionApiResponse {
  workspaceId: string;
  workspaceName: string;
  isActive: boolean;
}

interface ClickUpDiscoveryStructureApiResponse {
  workspaceId: string;
  workspaceName: string;
  spaceCount: number;
  folderCount: number;
  listCount: number;
}

interface WaitForAuthServiceOptions {
  timeoutMs?: number;
  intervalMs?: number;
}

const defaultWaitForAuthServiceOptions: Required<WaitForAuthServiceOptions> = {
  timeoutMs: 12000,
  intervalMs: 600,
};

export async function login(request: LoginRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/login', request);
  return response.data;
}

export async function register(request: RegisterRequest): Promise<RegisterResponse> {
  const response = await apiClient.post<RegisterResponse>('/auth/register', request);
  return response.data;
}

export async function requestPasswordReset(request: ForgotPasswordRequest): Promise<void> {
  await apiClient.post('/auth/forgot-password', request);
}

export async function resetPassword(request: ResetPasswordRequest): Promise<void> {
  await apiClient.post('/auth/reset-password', request);
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me');
  return response.data;
}

export async function getExternalProviders(): Promise<ExternalProvidersResponse> {
  const response = await requestExternalProviders();
  return mapExternalProviders(response.data);
}

export async function waitForAuthServiceReady(
  options: WaitForAuthServiceOptions = {},
): Promise<ExternalProvidersResponse> {
  const { timeoutMs, intervalMs } = {
    ...defaultWaitForAuthServiceOptions,
    ...options,
  };

  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;

  while (true) {
    try {
      const response = await requestExternalProviders();
      return mapExternalProviders(response.data);
    } catch (error) {
      lastError = error;
      if (!isRetryableAuthStartupError(error) || Date.now() >= deadline) {
        throw error;
      }

      await delay(intervalMs);
    }
  }
}

export function isRetryableAuthStartupError(error: unknown): boolean {
  if (!(error instanceof AxiosError)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return error.response.status === 502
    || error.response.status === 503
    || error.response.status === 504;
}

async function requestExternalProviders() {
  const response = await apiClient.get<ExternalProvidersApiResponse>('/auth/external/providers');
  return response;
}

function mapExternalProviders(response: ExternalProvidersApiResponse): ExternalProvidersResponse {
  return {
    clickup: response.clickup,
  };
}

function delay(durationMs: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

export async function exchangeOAuthTicket(request: OAuthExchangeRequest): Promise<LoginResponse> {
  const response = await apiClient.post<LoginResponse>('/auth/external/exchange', request);
  return response.data;
}

export async function getClickUpWorkspaces(ticket: string): Promise<ClickUpWorkspace[]> {
  const response = await apiClient.get<ClickUpWorkspacesApiResponseItem[]>('/integrations/clickup/workspaces', {
    params: { ticket },
  });

  return response.data.map((workspace) => ({
    workspaceId: workspace.workspaceId,
    workspaceName: workspace.workspaceName,
  }));
}

export async function connectClickUpWorkspace(ticket: string, workspaceId: string): Promise<ClickUpConnection> {
  const response = await apiClient.post<ClickUpConnectionApiResponse>('/integrations/clickup/connect', {
    ticket,
    workspaceId,
  });

  return {
    workspaceId: response.data.workspaceId,
    workspaceName: response.data.workspaceName,
    isActive: response.data.isActive,
  };
}

export async function getClickUpConnection(): Promise<ClickUpConnection | null> {
  const response = await apiClient.get<ClickUpConnectionApiResponse | null>('/integrations/clickup/connection');
  if (!response.data) {
    return null;
  }

  return {
    workspaceId: response.data.workspaceId,
    workspaceName: response.data.workspaceName,
    isActive: response.data.isActive,
  };
}

export async function getClickUpDiscoveryStructure(): Promise<ClickUpDiscoveryStructure | null> {
  const response = await apiClient.get<ClickUpDiscoveryStructureApiResponse | null>('/integrations/clickup/discovery/structure');
  if (!response.data) {
    return null;
  }

  return {
    workspaceId: response.data.workspaceId,
    workspaceName: response.data.workspaceName,
    spaceCount: response.data.spaceCount,
    folderCount: response.data.folderCount,
    listCount: response.data.listCount,
  };
}

export async function getClickUpDiscoveryTasks(limit = 100): Promise<ClickUpDiscoveryTask[]> {
  const response = await apiClient.get<ClickUpDiscoveryTask[]>('/integrations/clickup/discovery/tasks', {
    params: {
      includeClosed: true,
      limit,
    },
  });

  return response.data.map((task) => ({ id: task.id }));
}
