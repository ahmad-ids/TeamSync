export type WorkloadStatus = 'Available' | 'Moderate' | 'Overloaded';

export type WorkloadPeriod = 'thisWeek' | 'nextWeek' | 'custom';

export type WorkloadSort = 'workload' | 'workloadAsc' | 'effort' | 'tasks' | 'name';

export type TaskSpecialization =
  | 'Unknown'
  | 'Frontend'
  | 'Backend'
  | 'Qa'
  | 'UiUx'
  | 'DevOps'
  | 'BusinessAnalysis'
  | 'ProjectCoordination'
  | 'Security'
  | 'Data';

export interface WorkloadTeamModel {
  teamId: string;
  teamName: string;
}

export interface WorkloadCardModel {
  memberId: string;
  fullName: string;
  email: string;
  jobTitle: string;
  specialization: TaskSpecialization;
  teamName: string;
  totalTasks: number;
  totalEffortHours: number;
  totalWeight: number;
  capacityPercentage: number;
  status: WorkloadStatus;
  lastTaskDueDate?: string | null;
}

export interface WorkloadSummaryModel {
  startDate: string;
  endDate: string;
  totalTeamMembers: number;
  totalTasks: number;
  totalEffortHours: number;
  totalWeight: number;
  capacityPercentage: number;
  overloadedMembers: number;
  teams: WorkloadTeamModel[];
  members: WorkloadCardModel[];
}

export interface MemberWorkloadDetailsModel {
  memberId: string;
  fullName: string;
  jobTitle: string;
  email: string;
  teamName: string;
  startDate: string;
  endDate: string;
  totalTasks: number;
  taskDeltaFromPreviousPeriod: number;
  totalEffortHours: number;
  totalWeight: number;
  capacityPercentage: number;
  impactScore: number;
  blockedTasks: number;
  criticalTasks: number;
  insight: string;
  status: WorkloadStatus;
  prioritySplit: MemberPrioritySplitModel[];
  dailyEffortHours: number[];
  history: MemberActivityHistoryItemModel[];
  tasks: TaskSummaryModel[];
}

export interface MemberPrioritySplitModel {
  priority: 'Low' | 'Medium' | 'High' | 'Critical' | string;
  taskCount: number;
  weight: number;
}

export interface MemberActivityHistoryItemModel {
  id: string;
  taskId?: string | null;
  taskTitle: string;
  eventType: string;
  summary: string;
  details?: string | null;
  occurredAt: string;
  fromUserName?: string | null;
  toUserName?: string | null;
  actionByName?: string | null;
}

export interface TaskSummaryModel {
  id: string;
  title: string;
  dueDate: string;
  assignedMemberName: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  complexity: 'Simple' | 'Medium' | 'Complex';
  status: 'New' | 'InProgress' | 'Blocked' | 'Done';
  estimatedEffortHours: number;
  calculatedWeight: number;
  isAcknowledged: boolean;
  acknowledgedAt?: string | null;
}

export interface TaskFormMemberOptionModel {
  memberId: string;
  fullName: string;
  email: string;
  jobTitle: string;
  specialization: Exclude<TaskSpecialization, 'Unknown'>;
  capacityPercentage: number;
  availabilityPercentage: number;
  activeTaskCount: number;
  workloadStatus: WorkloadStatus;
}

export interface TaskFormOptionsModel {
  teamId: string;
  teamName: string;
  members: TaskFormMemberOptionModel[];
}

export interface TaskPreviewModel {
  calculatedWeight: number;
  complexityMultiplier: number;
  priorityMultiplier: number;
  currentTeamLoadPercentage: number;
  capacityUtilizationPercentage: number;
  availabilityPercentage: number;
  projectedIncreasePercentage: number;
  capacityStatus: string;
  impactMessage: string;
}

export interface TaskDetailsModel {
  id: string;
  title: string;
  description: string;
  assignedMemberId: string;
  assignedMemberName: string;
  assignedMemberEmail: string;
  createdById: string;
  createdByName: string;
  teamId: string;
  teamName: string;
  requiredSpecialization: TaskSpecialization;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  complexity: 'Simple' | 'Medium' | 'Complex';
  estimatedEffortHours: number;
  startDate: string;
  dueDate: string;
  status: 'New' | 'InProgress' | 'Blocked' | 'Done';
  calculatedWeight: number;
  isAcknowledged: boolean;
  acknowledgedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  complexityMultiplier: number;
  priorityMultiplier: number;
  assigneeCapacityPercentageThisWeek: number;
  reassignmentRequests: TaskReassignmentRequestModel[];
  statusTimeline: TaskStatusTimelineItemModel[];
  changeAudit: TaskChangeAuditItemModel[];
  assigneeCapacity: TaskCapacityPointModel[];
}

export interface TaskReassignmentRequestModel {
  id: string;
  requestedById: string;
  requestedByName: string;
  currentAssigneeId: string;
  currentAssigneeName: string;
  proposedAssigneeId: string;
  proposedAssigneeName: string;
  proposedAssigneeEmail: string;
  proposedAssigneeJobTitle: string;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  currentAssigneeDecision: 'Pending' | 'Approved' | 'Rejected';
  currentAssigneeRespondedAt?: string | null;
  proposedAssigneeDecision: 'Pending' | 'Approved' | 'Rejected';
  proposedAssigneeRespondedAt?: string | null;
  createdAt: string;
  finalizedAt?: string | null;
}

export interface TaskStatusTimelineItemModel {
  id: string;
  label: string;
  description: string;
  occurredAt: string;
  isCurrent: boolean;
}

export interface TaskChangeAuditItemModel {
  id: string;
  field: string;
  oldValue: string;
  newValue: string;
  updatedByName: string;
  updatedAt: string;
  status: string;
  fromUserName?: string | null;
  toUserName?: string | null;
  actionByName?: string | null;
}

export interface TaskCapacityPointModel {
  dayLabel: string;
  capacityPercentage: number;
  isCurrentDay: boolean;
}

export interface ChangeRequestModel {
  id: string;
  taskId: string;
  taskTitle: string;
  requesterId: string;
  requesterName: string;
  assignedMemberName: string;
  requestType: 'ChangeOwner' | 'ChangeDueDate' | 'IncreaseEstimatedEffort';
  requestTypeLabel: string;
  oldValue: string;
  newValue: string;
  reason: string;
  submittedAt: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedAt?: string | null;
  reviewedByName?: string | null;
  impactPercentage: number;
}

export interface ChangeRequestMetricsModel {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  averageResponseHours: number;
  totalImpactPercentage: number;
  queueHealth: string;
  queueHealthDetail: string;
}

export interface ChangeRequestListResponseModel {
  metrics: ChangeRequestMetricsModel;
  requests: ChangeRequestModel[];
}

export interface ChangeRequestOwnerOptionModel {
  memberId: string;
  fullName: string;
  jobTitle: string;
  workloadStatus: 'Available' | 'Moderate' | 'Overloaded' | string;
}

export interface ChangeRequestOptionsModel {
  taskId: string;
  ownerCandidates: ChangeRequestOwnerOptionModel[];
}
