import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createTask, getTaskDetails, getTaskFormOptions, previewTask, updateTask, type UpsertTaskPayload } from '../../services/taskService';
import type { TaskFormOptionsModel, TaskPreviewModel, TaskSpecialization } from '../../types/domain';
import { getWorkloadPriority, specializationLabel } from '../../utils/specialization';
import { appColors } from '../../theme/theme';
import { SectionCard } from './TaskFormParts';
import { TaskFormSidebar } from './TaskFormSidebar';
import './TaskFormPage.css';
type TaskPriorityValue = UpsertTaskPayload['priority'];
type TaskComplexityValue = UpsertTaskPayload['complexity'];
type TaskStatusValue = UpsertTaskPayload['status'];
type TaskFormState = Omit<UpsertTaskPayload, 'requiredSpecialization'> & {
  requiredSpecialization: Exclude<TaskSpecialization, 'Unknown'> | '';
};
type TaskPreviewInputState = Pick<
  TaskFormState,
  'assignedMemberId' | 'requiredSpecialization' | 'priority' | 'complexity' | 'estimatedEffortHours' | 'startDate' | 'dueDate' | 'status'
>;
type TaskPreviewDependencyState = Pick<
  TaskFormState,
  'assignedMemberId' | 'requiredSpecialization' | 'priority' | 'complexity' | 'estimatedEffortHours' | 'startDate' | 'dueDate' | 'status'
>;

const priorityOptions: TaskPriorityValue[] = ['Low', 'Medium', 'High', 'Critical'];
const statusOptions: Array<{ value: TaskStatusValue; label: string }> = [
  { value: 'New', label: 'New' },
  { value: 'InProgress', label: 'In Progress' },
  { value: 'Blocked', label: 'Blocked' },
  { value: 'Done', label: 'Done' },
];
const complexityOptions: Array<{ value: TaskComplexityValue; label: string }> = [
  { value: 'Simple', label: '1.0x (Simple)' },
  { value: 'Medium', label: '1.5x (Medium)' },
  { value: 'Complex', label: '2.0x (Complex)' },
];
function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}
function defaultStartDate() {
  return toDateInputValue(new Date());
}
function defaultDueDate() {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 5);
  return toDateInputValue(nextWeek);
}
function buildInitialForm(memberIdFromQuery: string | null): TaskFormState {
  return {
    title: '',
    description: '',
    assignedMemberId: memberIdFromQuery ?? '',
    requiredSpecialization: '',
    priority: 'Medium',
    complexity: 'Medium',
    estimatedEffortHours: 12,
    startDate: defaultStartDate(),
    dueDate: defaultDueDate(),
    status: 'New',
  };
}
function toPayload(form: TaskFormState): UpsertTaskPayload {
  return {
    ...form,
    requiredSpecialization: form.requiredSpecialization as UpsertTaskPayload['requiredSpecialization'],
    estimatedEffortHours: Number(form.estimatedEffortHours),
  };
}
function validateForm(form: TaskFormState) {
  if (!form.title.trim()) {
    return 'Task title is required.';
  }
  if (!form.description.trim()) {
    return 'Task description is required.';
  }
  if (!form.requiredSpecialization) {
    return 'Required role specialization is required.';
  }
  if (!form.assignedMemberId) {
    return 'Assigned member is required.';
  }
  if (!Number.isFinite(Number(form.estimatedEffortHours)) || Number(form.estimatedEffortHours) <= 0) {
    return 'Estimated effort hours must be greater than zero.';
  }
  if (form.dueDate < form.startDate) {
    return 'Due date must be on or after the start date.';
  }
  return null;
}

function validatePreviewInputs(form: TaskPreviewInputState) {
  if (!form.requiredSpecialization) {
    return 'Required role specialization is required.';
  }
  if (!form.assignedMemberId) {
    return 'Assigned member is required.';
  }
  if (!Number.isFinite(Number(form.estimatedEffortHours)) || Number(form.estimatedEffortHours) <= 0) {
    return 'Estimated effort hours must be greater than zero.';
  }
  if (form.dueDate < form.startDate) {
    return 'Due date must be on or after the start date.';
  }
  return null;
}

export function TaskFormPage() {
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [searchParams] = useSearchParams();
  const memberIdFromQuery = searchParams.get('memberId');
  const [form, setForm] = useState<TaskFormState>(() => buildInitialForm(memberIdFromQuery));
  const [options, setOptions] = useState<TaskFormOptionsModel | null>(null);
  const [preview, setPreview] = useState<TaskPreviewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [animatedPreviewPercentages, setAnimatedPreviewPercentages] = useState({
    current: 0,
    capacity: 0,
  });

  const isEdit = Boolean(taskId);
  const specializationOptions = useMemo(
    () =>
      Array.from(new Set((options?.members ?? []).map((member) => member.specialization))),
    [options],
  );
  const relevantMembers = useMemo(() => {
    if (!options || !form.requiredSpecialization) {
      return [];
    }

    return [...options.members]
      .filter((member) => member.specialization === form.requiredSpecialization)
      .sort((left, right) => {
        const statusDelta = getWorkloadPriority(left.workloadStatus) - getWorkloadPriority(right.workloadStatus);
        if (statusDelta !== 0) {
          return statusDelta;
        }

        if (left.capacityPercentage !== right.capacityPercentage) {
          return left.capacityPercentage - right.capacityPercentage;
        }

        return left.fullName.localeCompare(right.fullName);
      });
  }, [form.requiredSpecialization, options]);
  const selectedMember = useMemo(
    () => relevantMembers.find((member) => member.memberId === form.assignedMemberId) ?? null,
    [form.assignedMemberId, relevantMembers],
  );
  const previewDependencies = useMemo<TaskPreviewDependencyState>(
    () => ({
      assignedMemberId: form.assignedMemberId,
      requiredSpecialization: form.requiredSpecialization,
      priority: form.priority,
      complexity: form.complexity,
      estimatedEffortHours: form.estimatedEffortHours,
      startDate: form.startDate,
      dueDate: form.dueDate,
      status: form.status,
    }),
    [
      form.assignedMemberId,
      form.requiredSpecialization,
      form.priority,
      form.complexity,
      form.estimatedEffortHours,
      form.startDate,
      form.dueDate,
      form.status,
    ],
  );

  const assignmentGuidance = useMemo(() => {
    if (!form.requiredSpecialization) {
      return {
        severity: 'info' as const,
        message: 'Choose the task role first. Matching specialists will then be ranked by workload from Available to Overloaded.',
      };
    }

    if (relevantMembers.length === 0) {
      return {
        severity: 'error' as const,
        message: `No ${specializationLabel[form.requiredSpecialization]} specialists are available on this team.`,
      };
    }

    const firstStatus = relevantMembers[0]?.workloadStatus;
    if (firstStatus === 'Available') {
      return {
        severity: 'success' as const,
        message: `Showing ${specializationLabel[form.requiredSpecialization]} specialists with available capacity first.`,
      };
    }

    if (firstStatus === 'Moderate') {
      return {
        severity: 'warning' as const,
        message: `No available ${specializationLabel[form.requiredSpecialization]} specialists exist in this range. Moderate matches are being prioritized.`,
      };
    }

    return {
      severity: 'warning' as const,
      message: `All ${specializationLabel[form.requiredSpecialization]} specialists are overloaded. Suggestions remain limited to the correct role.`,
    };
  }, [form.requiredSpecialization, relevantMembers]);
  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      setLoading(true);
      setError(null);

      try {
        const [nextOptions, nextTask] = await Promise.all([
          getTaskFormOptions(),
          taskId ? getTaskDetails(taskId) : Promise.resolve(null),
        ]);

        if (!isMounted) {
          return;
        }

        setOptions(nextOptions);
        if (nextTask) {
          setForm({
            title: nextTask.title,
            description: nextTask.description,
            assignedMemberId: nextTask.assignedMemberId,
            requiredSpecialization: nextTask.requiredSpecialization === 'Unknown' ? '' : nextTask.requiredSpecialization,
            priority: nextTask.priority,
            complexity: nextTask.complexity,
            estimatedEffortHours: Number(nextTask.estimatedEffortHours),
            startDate: nextTask.startDate,
            dueDate: nextTask.dueDate,
            status: nextTask.status,
          });
        } else {
          const preferredMember =
            memberIdFromQuery
              ? nextOptions.members.find((member) => member.memberId === memberIdFromQuery) ?? null
              : null;
          const preferredMemberId = preferredMember?.memberId ?? '';
          const preferredSpecialization = preferredMember?.specialization ?? '';

          setForm((current) => ({
            ...current,
            requiredSpecialization: current.requiredSpecialization || preferredSpecialization,
            assignedMemberId: current.assignedMemberId || preferredMemberId,
          }));
        }
      } catch {
        if (isMounted) {
          setError('Unable to load task form data.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, [memberIdFromQuery, taskId]);

  useEffect(() => {
    if (!options || !form.requiredSpecialization) {
      return;
    }

    if (relevantMembers.some((member) => member.memberId === form.assignedMemberId)) {
      return;
    }

    setForm((current) => ({
      ...current,
      assignedMemberId: relevantMembers[0]?.memberId ?? '',
    }));
  }, [form.assignedMemberId, form.requiredSpecialization, options, relevantMembers]);

  useEffect(() => {
    const previewValidationError = validatePreviewInputs(previewDependencies);

    if (!options || previewValidationError) {
      setPreview(null);
      return;
    }

    let isMounted = true;
    const timeout = window.setTimeout(() => {
      setPreviewLoading(true);
      void previewTask({
        assignedMemberId: previewDependencies.assignedMemberId,
        requiredSpecialization: previewDependencies.requiredSpecialization as UpsertTaskPayload['requiredSpecialization'],
        priority: previewDependencies.priority,
        complexity: previewDependencies.complexity,
        estimatedEffortHours: Number(previewDependencies.estimatedEffortHours),
        startDate: previewDependencies.startDate,
        dueDate: previewDependencies.dueDate,
        status: previewDependencies.status,
        taskId,
      })
        .then((nextPreview) => {
          if (isMounted) {
            setPreview(nextPreview);
          }
        })
        .catch(() => {
          if (isMounted) {
            setPreview(null);
          }
        })
        .finally(() => {
          if (isMounted) {
            setPreviewLoading(false);
          }
        });
    }, 180);

    return () => {
      isMounted = false;
      window.clearTimeout(timeout);
    };
  }, [options, previewDependencies, taskId]);

  useEffect(() => {
    if (!preview) {
      setAnimatedPreviewPercentages({ current: 0, capacity: 0 });
      return;
    }

    let frame: number;
    const duration = 700;
    const targetCurrent = preview.currentTeamLoadPercentage;
    const targetCapacity = preview.capacityUtilizationPercentage;
    const start = performance.now();

    const step = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress * (2 - progress); // ease-out
      setAnimatedPreviewPercentages({
        current: targetCurrent * eased,
        capacity: targetCapacity * eased,
      });
      if (progress < 1) {
        frame = window.requestAnimationFrame(step);
      }
    };

    frame = window.requestAnimationFrame(step);
    return () => {
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [preview]);

  function updateField<K extends keyof TaskFormState>(field: K, value: TaskFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitError(null);
  }

  async function handleSubmit() {
    const validationMessage = validateForm(form);
    if (validationMessage) {
      setSubmitError(validationMessage);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = toPayload(form);
      const savedTask = isEdit && taskId ? await updateTask(taskId, payload) : await createTask(payload);
      navigate(`/tasks/${savedTask.id}`);
    } catch (submissionError: unknown) {
      const message =
        typeof submissionError === 'object' &&
        submissionError !== null &&
        'response' in submissionError &&
        typeof (submissionError as { response?: { data?: { detail?: string } } }).response?.data?.detail === 'string'
          ? (submissionError as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? 'Unable to save the task.'
          : 'Unable to save the task.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Paper sx={{ p: 4, borderRadius: 4, boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)' }}>
        <Stack spacing={1.75} alignItems="center">
          <CircularProgress />
          <Typography color="text.secondary" sx={{ fontSize: 14 }}>
            Loading task form...
          </Typography>
        </Stack>
      </Paper>
    );
  }

  if (error || !options) {
    return (
      <Paper sx={{ p: 4, borderRadius: 4, boxShadow: '0 14px 34px rgba(15, 23, 42, 0.08)' }}>
        <Stack spacing={2}>
          <Alert severity="error">{error ?? 'Task form data is unavailable.'}</Alert>
          <Button onClick={() => navigate(-1)} startIcon={<ArrowBackRoundedIcon />} sx={{ alignSelf: 'flex-start' }}>
            Go Back
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ md: 'center' }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Button
            onClick={() => navigate(-1)}
            variant="outlined"
            color="inherit"
            sx={{
              minWidth: 0,
              borderColor: appColors.light.border.default,
              color: appColors.light.text.secondary,
              borderRadius: 3,
              px: 1.25,
              py: 0.75,
              bgcolor: '#fff',
            }}
          >
            <ArrowBackRoundedIcon />
          </Button>
          <Typography sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 700, color: 'text.primary', letterSpacing: '-0.025em' }}>
            {isEdit ? 'Edit Task' : 'Create New Task'}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.25}>
          <Button
            variant="text"
            color="inherit"
            onClick={() => navigate(-1)}
            sx={{ color: 'text.secondary', fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : isEdit ? 'Save Changes' : 'Save Task'}
          </Button>
        </Stack>
      </Stack>

      {submitError ? <Alert severity="error">{submitError}</Alert> : null}

      <Box
        sx={{
          display: 'grid',
          gap: 2.5,
          gridTemplateColumns: { xs: '1fr', xl: 'minmax(0, 1.6fr) 340px' },
          alignItems: 'start',
        }}
      >
        <Stack spacing={2.5}>
          <SectionCard title="Basic Information">
            <Stack spacing={2}>
              <TextField
                label="Task Title"
                placeholder="e.g., Structural Analysis - Phase II"
                value={form.title}
                onChange={(event) => updateField('title', event.target.value)}
                fullWidth
                required
                inputProps={{ maxLength: 120 }}
              />
              <TextField
                label="Task Description"
                placeholder="Outline the expected deliverables and constraints."
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                multiline
                minRows={4}
                fullWidth
                required
              />
            </Stack>
          </SectionCard>

          <SectionCard title="Assignment">
            <Box
              sx={{
                display: 'grid',
                gap: 2.5,
                columnGap: { xs: 3, md: 3.5 },
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 230px' },
              }}
            >
              <Stack spacing={1.1}>
                <TextField
                  select
                  label="Required Role"
                  value={form.requiredSpecialization}
                  onChange={(event) => updateField('requiredSpecialization', event.target.value as TaskFormState['requiredSpecialization'])}
                  fullWidth
                  required
                  SelectProps={{ IconComponent: KeyboardArrowDownRoundedIcon }}
                >
                  {specializationOptions.map((specialization) => (
                    <MenuItem key={specialization} value={specialization}>
                      {specializationLabel[specialization]}
                    </MenuItem>
                  ))}
                </TextField>
                <Alert severity={assignmentGuidance.severity} sx={{ borderRadius: 3 }}>
                  {assignmentGuidance.message}
                </Alert>
                <TextField
                  select
                  label="Assigned Member"
                  value={form.assignedMemberId}
                  onChange={(event) => updateField('assignedMemberId', event.target.value)}
                  fullWidth
                  required
                  sx={{ mt: 1.25 }}
                  disabled={isEdit || !form.requiredSpecialization || relevantMembers.length === 0}
                  helperText={isEdit ? 'Use the reassignment flow from task details to change the assigned member.' : undefined}
                  SelectProps={{ IconComponent: KeyboardArrowDownRoundedIcon }}
                >
                  {relevantMembers.map((member) => (
                    <MenuItem key={member.memberId} value={member.memberId}>
                      {`${member.fullName} | ${member.jobTitle} | ${member.workloadStatus}`}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Paper
                className="task-form-member-availability"
                elevation={0}
              >
                <Stack spacing={0.45} className="task-form-member-availability__content">
                  <Typography className="task-form-member-availability__label">
                    Member availability
                  </Typography>
                  <Typography className="task-form-member-availability__value">
                    {selectedMember ? `${selectedMember.availabilityPercentage.toFixed(0)}%` : '--'}
                  </Typography>
                  <Typography className="task-form-member-availability__subtitle">
                    {selectedMember ? `${selectedMember.jobTitle} | ${selectedMember.workloadStatus}` : 'Select a role-aligned specialist.'}
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          </SectionCard>

          <SectionCard title="Task Configuration">
            <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' } }}>
              <Stack spacing={0.9}>
                <Typography sx={{ color: 'text.secondary', fontSize: 11.5, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Priority
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {priorityOptions.map((option) => {
                    const isSelected = form.priority === option;
                    return (
                      <Button
                        key={option}
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => updateField('priority', option)}
                        sx={{
                          borderRadius: 3,
                          fontSize: 13,
                          minWidth: 84,
                          borderColor: 'divider',
                          backgroundColor: isSelected ? appColors.light.primary.main : '#fff',
                          color: isSelected ? '#fff' : '#4f617c',
                          boxShadow: 'none',
                        }}
                      >
                        {option}
                      </Button>
                    );
                  })}
                </Box>
              </Stack>

              <TextField
                select
                label="Complexity"
                value={form.complexity}
                onChange={(event) => updateField('complexity', event.target.value as TaskComplexityValue)}
                fullWidth
                SelectProps={{ IconComponent: KeyboardArrowDownRoundedIcon }}
              >
                {complexityOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>

              <Stack spacing={0.9}>
                <Typography sx={{ color: 'text.secondary', fontSize: 11.5, fontWeight: 600, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Status
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {statusOptions.map((option) => {
                    const isSelected = form.status === option.value;
                    return (
                      <Button
                        key={option.value}
                        variant={isSelected ? 'contained' : 'outlined'}
                        onClick={() => updateField('status', option.value)}
                        sx={{
                          borderRadius: 3,
                          fontSize: 13,
                          minWidth: 100,
                          borderColor: 'divider',
                          color: isSelected ? '#fff' : appColors.light.primary.main,
                          backgroundColor: isSelected ? appColors.light.primary.main : '#fff',
                          boxShadow: 'none',
                          transition: 'background-color 180ms ease, color 180ms ease, border-color 180ms ease',
                          '&:hover': {
                            backgroundColor: isSelected ? appColors.light.primary.dark : '#eef2ff',
                            borderColor: isSelected ? appColors.light.primary.dark : '#bfd0ff',
                            color: isSelected ? '#fff' : appColors.light.primary.main,
                          },
                        }}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </Box>
              </Stack>
            </Box>
          </SectionCard>

          <SectionCard title="Estimation and Scheduling">
            <Box sx={{ display: 'grid', gap: 2.25, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
              <TextField
                label="Effort (Hours)"
                type="number"
                value={form.estimatedEffortHours}
                onChange={(event) => updateField('estimatedEffortHours', Number(event.target.value))}
                inputProps={{ min: 1, step: 0.5 }}
                fullWidth
              />
              <TextField
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={(event) => updateField('startDate', event.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="Due Date"
                type="date"
                value={form.dueDate}
                onChange={(event) => updateField('dueDate', event.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          </SectionCard>
        </Stack>

        <TaskFormSidebar
          preview={preview}
          previewLoading={previewLoading}
          animatedPreviewPercentages={animatedPreviewPercentages}
          effortHours={Number(form.estimatedEffortHours)}
          options={options}
          selectedMember={selectedMember}
        />
      </Box>
    </Stack>
  );
}

