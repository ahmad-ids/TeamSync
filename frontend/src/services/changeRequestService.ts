import { apiClient } from './apiClient';
import type {
  ChangeRequestListResponseModel,
  ChangeRequestModel,
  ChangeRequestOptionsModel,
} from '../types/domain';

export interface GetChangeRequestsParams {
  status?: 'Pending' | 'Approved' | 'Rejected';
  type?: 'ChangeOwner' | 'ChangeDueDate' | 'IncreaseEstimatedEffort';
  search?: string;
  sort?: 'newest' | 'oldest' | 'impact';
  taskId?: string;
}

export interface CreateChangeRequestPayload {
  taskId: string;
  requestType: 'ChangeOwner' | 'ChangeDueDate' | 'IncreaseEstimatedEffort';
  newValue: string;
  reason: string;
}

export async function getChangeRequests(params: GetChangeRequestsParams) {
  const response = await apiClient.get<ChangeRequestListResponseModel>('/change-requests', { params });
  return response.data;
}

export async function approveChangeRequest(id: string) {
  const response = await apiClient.post<ChangeRequestModel>(`/change-requests/${id}/approve`);
  return response.data;
}

export async function rejectChangeRequest(id: string) {
  const response = await apiClient.post<ChangeRequestModel>(`/change-requests/${id}/reject`);
  return response.data;
}

export async function createChangeRequest(payload: CreateChangeRequestPayload) {
  const response = await apiClient.post<ChangeRequestModel>('/change-requests', payload);
  return response.data;
}

export async function getChangeRequestOptions(taskId: string) {
  const response = await apiClient.get<ChangeRequestOptionsModel>(`/tasks/${taskId}/change-request-options`);
  return response.data;
}
