import { apiClient } from './apiClient';
import type { TaskDetailsModel, TaskFormOptionsModel, TaskPreviewModel, TaskSpecialization } from '../types/domain';

export interface UpsertTaskPayload {
  title: string;
  description: string;
  assignedMemberId: string;
  requiredSpecialization: TaskSpecialization;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  complexity: 'Simple' | 'Medium' | 'Complex';
  estimatedEffortHours: number;
  startDate: string;
  dueDate: string;
  status: 'New' | 'InProgress' | 'Blocked' | 'Done';
}

export interface TaskPreviewPayload {
  assignedMemberId: string;
  requiredSpecialization: TaskSpecialization;
  priority: UpsertTaskPayload['priority'];
  complexity: UpsertTaskPayload['complexity'];
  estimatedEffortHours: number;
  startDate: string;
  dueDate: string;
  status: UpsertTaskPayload['status'];
  taskId?: string;
}

export interface CreateReassignmentPayload {
  proposedAssigneeId: string;
}

export interface UpdateTaskStatusPayload {
  status: TaskDetailsModel['status'];
}

export async function getTaskDetails(taskId: string) {
  const response = await apiClient.get<TaskDetailsModel>(`/tasks/${taskId}`);
  return response.data;
}

export async function getTaskFormOptions() {
  const response = await apiClient.get<TaskFormOptionsModel>('/tasks/form-options');
  return response.data;
}

export async function previewTask(payload: TaskPreviewPayload) {
  const response = await apiClient.post<TaskPreviewModel>('/tasks/preview', payload);
  return response.data;
}

export async function createTask(payload: UpsertTaskPayload) {
  const response = await apiClient.post<TaskDetailsModel>('/tasks', payload);
  return response.data;
}

export async function updateTask(taskId: string, payload: UpsertTaskPayload) {
  const response = await apiClient.put<TaskDetailsModel>(`/tasks/${taskId}`, payload);
  return response.data;
}

export async function deleteTask(taskId: string) {
  await apiClient.delete(`/tasks/${taskId}`);
}

export async function reassignTask(taskId: string, payload: CreateReassignmentPayload) {
  const response = await apiClient.post<TaskDetailsModel>(`/tasks/${taskId}/reassign`, payload);
  return response.data;
}

export async function acknowledgeTask(taskId: string) {
  await apiClient.post(`/tasks/${taskId}/acknowledge`);
}

export async function updateTaskStatus(taskId: string, payload: UpdateTaskStatusPayload) {
  const response = await apiClient.post<TaskDetailsModel>(`/tasks/${taskId}/status`, payload);
  return response.data;
}
