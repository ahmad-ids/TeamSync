import type { ChangeRequestModel, TaskSummaryModel, WorkloadCardModel } from '../types/domain';

export const workloadCards: WorkloadCardModel[] = [
  { memberId: '1', fullName: 'Maya Saab', email: 'maya@ids.local', jobTitle: 'Frontend Application Engineer', specialization: 'Frontend', teamName: 'Platform Delivery Team', totalTasks: 4, totalEffortHours: 22, totalWeight: 14.5, capacityPercentage: 58, status: 'Available' },
  { memberId: '2', fullName: 'Omar Khoury', email: 'omar@ids.local', jobTitle: 'QA Automation Engineer', specialization: 'Qa', teamName: 'Platform Delivery Team', totalTasks: 6, totalEffortHours: 31, totalWeight: 21.2, capacityPercentage: 84.8, status: 'Moderate' },
  { memberId: '3', fullName: 'Lea Haddad', email: 'lea@ids.local', jobTitle: 'Business Systems Analyst', specialization: 'BusinessAnalysis', teamName: 'Platform Delivery Team', totalTasks: 5, totalEffortHours: 38, totalWeight: 28.4, capacityPercentage: 113.6, status: 'Overloaded' },
];

export const memberTasks: TaskSummaryModel[] = [
  { id: 't1', title: 'Define approval audit trail', assignedMemberName: 'Maya Saab', dueDate: '2026-04-03', priority: 'High', complexity: 'Complex', status: 'InProgress', estimatedEffortHours: 10, calculatedWeight: 30, isAcknowledged: true },
  { id: 't2', title: 'Finalize task acknowledgement flow', assignedMemberName: 'Maya Saab', dueDate: '2026-04-05', priority: 'Medium', complexity: 'Medium', status: 'New', estimatedEffortHours: 6, calculatedWeight: 10.8, isAcknowledged: false },
];

export const changeRequests: ChangeRequestModel[] = [
  {
    id: 'cr1',
    taskId: 't1',
    taskTitle: 'Finalize dashboard sorting',
    requesterId: '1',
    requesterName: 'Maya Saab',
    assignedMemberName: 'Maya Saab',
    requestType: 'ChangeDueDate',
    requestTypeLabel: 'Duration Extension',
    oldValue: '2026-04-02',
    newValue: '2026-04-05',
    reason: 'Dependency completion moved the planned handoff.',
    submittedAt: '2026-03-31',
    status: 'Pending',
    impactPercentage: 14.3,
  },
];
