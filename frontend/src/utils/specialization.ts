import type { TaskSpecialization, WorkloadStatus } from '../types/domain';

export const specializationLabel: Record<TaskSpecialization, string> = {
  Unknown: 'Unspecified',
  Frontend: 'Frontend',
  Backend: 'Backend',
  Qa: 'QA',
  UiUx: 'UI/UX',
  DevOps: 'DevOps',
  BusinessAnalysis: 'Business Analysis',
  ProjectCoordination: 'Project Coordination',
  Security: 'Security',
  Data: 'Data',
};

export const assignmentSpecializations = [
  'Frontend',
  'Backend',
  'Qa',
  'UiUx',
  'DevOps',
  'BusinessAnalysis',
  'ProjectCoordination',
  'Security',
  'Data',
] as const satisfies readonly TaskSpecialization[];

export function getWorkloadPriority(status: WorkloadStatus) {
  switch (status) {
    case 'Available':
      return 0;
    case 'Moderate':
      return 1;
    case 'Overloaded':
      return 2;
    default:
      return 3;
  }
}
