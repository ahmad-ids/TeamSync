import { apiClient } from './apiClient';
import type { MemberWorkloadDetailsModel, WorkloadPeriod, WorkloadSort, WorkloadSummaryModel } from '../types/domain';

export interface WorkloadQuery {
  period: WorkloadPeriod;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy: WorkloadSort;
}

export async function getWorkloadSummary(query: WorkloadQuery) {
  const response = await apiClient.get<WorkloadSummaryModel>('/workload', {
    params: {
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
      search: query.search,
      sortBy: query.sortBy,
    },
  });

  return response.data;
}

export async function getMemberWorkloadDetails(
  memberId: string,
  query: Pick<WorkloadQuery, 'period' | 'startDate' | 'endDate'>,
) {
  const response = await apiClient.get<MemberWorkloadDetailsModel>(`/members/${memberId}/workload`, {
    params: {
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    },
  });

  return response.data;
}

export async function getMyWorkloadDetails(
  query: Pick<WorkloadQuery, 'period' | 'startDate' | 'endDate'>,
) {
  const response = await apiClient.get<MemberWorkloadDetailsModel>('/members/me/workload', {
    params: {
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
    },
  });

  return response.data;
}
