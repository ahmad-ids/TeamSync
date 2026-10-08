import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { getMyWorkloadDetails } from '../../services/workloadService';
import { acknowledgeTask, updateTaskStatus } from '../../services/taskService';
import type { MemberWorkloadDetailsModel, TaskSummaryModel, WorkloadPeriod } from '../../types/domain';
import { resolveRequestError, toStatusLabel } from '../TaskDetails/TaskDetailsParts';
import { resolveMemberAccessMessage } from './memberAccess';

export type MemberTaskStatusFilter = 'all' | TaskSummaryModel['status'];
export type MemberTaskSortMode = 'dueDate' | 'priority' | 'effort';

export function resolveMemberTaskDisplayStatus(task: TaskSummaryModel): TaskSummaryModel['status'] {
  return task.isAcknowledged ? task.status : 'New';
}

export function useMemberWorkloadState() {
  const [data, setData] = useState<MemberWorkloadDetailsModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);
  const [memberActionSuccess, setMemberActionSuccess] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [period, setPeriod] = useState<WorkloadPeriod>('thisWeek');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<MemberTaskStatusFilter>('all');
  const [taskSortMode, setTaskSortMode] = useState<MemberTaskSortMode>('dueDate');
  const deferredTaskSearch = useDeferredValue(taskSearch);

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError('');
      setAccessDeniedMessage(null);

      try {
        const result = await getMyWorkloadDetails({
          period,
          startDate: period === 'custom' ? customStartDate : undefined,
          endDate: period === 'custom' ? customEndDate : undefined,
        });

        if (!isCancelled) {
          setData(normalizeMemberWorkload(result));
        }
      } catch (loadError: unknown) {
        if (!isCancelled) {
          const accessMessage = resolveMemberAccessMessage(loadError);
          if (accessMessage) {
            setData(null);
            setError('');
            setAccessDeniedMessage(accessMessage);
          } else {
            setAccessDeniedMessage(null);
            setError('Unable to load your workload right now.');
          }
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (period === 'custom' && (!customStartDate || !customEndDate)) {
      setError('');
      setAccessDeniedMessage(null);
      setIsLoading(false);
      setData(null);
      return;
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, [customEndDate, customStartDate, period]);

  async function handleUpdateMemberTaskStatus(task: TaskSummaryModel, status: TaskSummaryModel['status']) {
    setUpdatingTaskId(task.id);
    setMemberActionError(null);
    setMemberActionSuccess(null);

    try {
      const updatedTask = await updateTaskStatus(task.id, { status });
      setData((current) => applyTaskUpdate(current, task.id, {
        status: normalizeTaskStatus(updatedTask.status),
        isAcknowledged: updatedTask.isAcknowledged,
        acknowledgedAt: updatedTask.acknowledgedAt,
      }));
      setMemberActionSuccess(`${task.title} moved to ${toStatusLabel(status)}.`);
    } catch (submissionError: unknown) {
      setMemberActionError(resolveRequestError(submissionError, 'Unable to update the task status right now.'));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  async function handleAcknowledgeMemberTask(task: TaskSummaryModel) {
    setUpdatingTaskId(task.id);
    setMemberActionError(null);
    setMemberActionSuccess(null);

    try {
      await acknowledgeTask(task.id);
      setData((current) =>
        applyTaskUpdate(current, task.id, {
          isAcknowledged: true,
          acknowledgedAt: new Date().toISOString(),
        }),
      );
      setMemberActionSuccess(`${task.title} acknowledged successfully.`);
    } catch (submissionError: unknown) {
      setMemberActionError(resolveRequestError(submissionError, 'Unable to acknowledge the task right now.'));
    } finally {
      setUpdatingTaskId(null);
    }
  }

  const filteredTasks = useMemo(
    () =>
      (data?.tasks ?? [])
        .filter((task) => taskStatusFilter === 'all' || resolveMemberTaskDisplayStatus(task) === taskStatusFilter)
        .filter((task) => matchesTask(task, deferredTaskSearch))
        .sort((left, right) => {
          if (taskSortMode === 'effort') {
            return right.estimatedEffortHours - left.estimatedEffortHours || right.calculatedWeight - left.calculatedWeight;
          }

          if (taskSortMode === 'priority') {
            const rank: Record<TaskSummaryModel['priority'], number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
            return rank[right.priority] - rank[left.priority] || new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
          }

          return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
        }),
    [data?.tasks, deferredTaskSearch, taskSortMode, taskStatusFilter],
  );

  return {
    data,
    isLoading,
    error,
    accessDeniedMessage,
    memberActionError,
    memberActionSuccess,
    updatingTaskId,
    period,
    setPeriod,
    customStartDate,
    setCustomStartDate,
    customEndDate,
    setCustomEndDate,
    taskSearch,
    setTaskSearch,
    taskStatusFilter,
    setTaskStatusFilter,
    taskSortMode,
    setTaskSortMode,
    filteredTasks,
    handleAcknowledgeMemberTask,
    handleUpdateMemberTaskStatus,
  };
}

function normalizeTaskStatus(status: string): TaskSummaryModel['status'] {
  return status === 'Completed' ? 'Done' : (status as TaskSummaryModel['status']);
}

function normalizeMemberWorkload(data: MemberWorkloadDetailsModel): MemberWorkloadDetailsModel {
  return {
    ...data,
    tasks: data.tasks.map((task) => ({
      ...task,
      status: normalizeTaskStatus(task.status),
    })),
  };
}

function applyTaskUpdate(
  data: MemberWorkloadDetailsModel | null,
  taskId: string,
  patch: Partial<Pick<TaskSummaryModel, 'status' | 'isAcknowledged' | 'acknowledgedAt'>>,
) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    tasks: data.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            ...(patch.status ? { status: patch.status } : {}),
            ...(patch.isAcknowledged !== undefined ? { isAcknowledged: patch.isAcknowledged } : {}),
            ...(patch.acknowledgedAt !== undefined ? { acknowledgedAt: patch.acknowledgedAt } : {}),
          }
        : task,
    ),
  };
}

function matchesTask(task: TaskSummaryModel, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const displayStatus = resolveMemberTaskDisplayStatus(task);

  return [
    task.title,
    displayStatus,
    task.priority,
    task.complexity,
    `${task.estimatedEffortHours}`,
    `${task.calculatedWeight}`,
  ].some((value) => value.toLowerCase().includes(normalized));
}
