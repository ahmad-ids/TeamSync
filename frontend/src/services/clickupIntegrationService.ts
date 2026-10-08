import { apiClient } from './apiClient';
import type { ClickUpConnection, ClickUpWorkspace } from './authService';

export async function getClickUpWorkspaces(ticket: string): Promise<ClickUpWorkspace[]> {
  const response = await apiClient.get<ClickUpWorkspace[]>('/integrations/clickup/workspaces', {
    params: { ticket },
  });

  return response.data;
}

export async function connectClickUpWorkspace(ticket: string, workspaceId: string): Promise<ClickUpConnection> {
  const response = await apiClient.post<ClickUpConnection>('/integrations/clickup/connect', {
    ticket,
    workspaceId,
  });

  return response.data;
}

export async function getClickUpConnection(): Promise<ClickUpConnection | null> {
  const response = await apiClient.get<ClickUpConnection | null>('/integrations/clickup/connection');
  return response.data;
}
