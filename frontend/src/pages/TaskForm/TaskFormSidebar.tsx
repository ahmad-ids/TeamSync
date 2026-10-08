import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Typography } from '@mui/material';
import type { TaskFormOptionsModel, TaskPreviewModel, TaskSpecialization } from '../../types/domain';
import { specializationLabel } from '../../utils/specialization';
import './TaskFormSidebar.css';

type TaskFormSidebarProps = {
  preview: TaskPreviewModel | null;
  previewLoading: boolean;
  animatedPreviewPercentages: {
    current: number;
    capacity: number;
  };
  effortHours: number;
  options: TaskFormOptionsModel;
  selectedMember: {
    fullName: string;
    specialization: Exclude<TaskSpecialization, 'Unknown'>;
    activeTaskCount: number;
    availabilityPercentage: number;
    jobTitle: string;
    workloadStatus: string;
  } | null;
};

type PreviewTone = 'balanced' | 'near-limit' | 'over-capacity';

const toneByStatus: Record<string, PreviewTone> = {
  Balanced: 'balanced',
  'Near Limit': 'near-limit',
  'Over Capacity': 'over-capacity',
};

const toneLabels: Record<PreviewTone, string> = {
  balanced: 'Balanced',
  'near-limit': 'Near Limit',
  'over-capacity': 'Over Capacity',
};

export function TaskFormSidebar({
  preview,
  previewLoading,
  animatedPreviewPercentages,
  effortHours,
  options,
  selectedMember,
}: TaskFormSidebarProps) {
  const tone = toneByStatus[preview?.capacityStatus ?? 'Balanced'] ?? 'balanced';
  const compactDetails = preview
    ? [
        { label: 'Effort', value: `${Number(effortHours).toFixed(1)}h` },
        { label: 'Complexity', value: `x${preview.complexityMultiplier.toFixed(1)}` },
        { label: 'Priority', value: `x${preview.priorityMultiplier.toFixed(1)}` },
      ]
    : [];

  return (
    <aside className="task-form-sidebar">
      <section className={`task-form-sidebar__panel task-form-sidebar__panel--${tone}`} aria-live="polite">
        <div className="task-form-sidebar__header">
          <div className="task-form-sidebar__heading-group">
            <Typography component="p" className="task-form-sidebar__eyebrow">
              Live Workload Preview
            </Typography>
            <Typography component="h3" className="task-form-sidebar__title">
              Workload impact at a glance
            </Typography>
            <Typography component="p" className="task-form-sidebar__subtitle">
              Real-time projection for the selected specialist, task effort, and remaining team capacity.
            </Typography>
          </div>

        </div>

        <div className="task-form-sidebar__body">
          {previewLoading ? (
            <div className="task-form-sidebar__loading" role="status" aria-live="polite">
              <span className="task-form-sidebar__spinner" aria-hidden="true" />
              <Typography component="p" className="task-form-sidebar__loading-text">
                Refreshing the live preview...
              </Typography>
            </div>
          ) : preview ? (
            <>
              <div className="task-form-sidebar__detail-strip">
                {compactDetails.map((item) => (
                  <div key={item.label} className="task-form-sidebar__detail-pill">
                    <Typography component="span" className="task-form-sidebar__detail-label">
                      {item.label}
                    </Typography>
                    <Typography component="strong" className="task-form-sidebar__detail-value">
                      {item.value}
                    </Typography>
                  </div>
                ))}
              </div>

              <div className={`task-form-sidebar__weight-panel task-form-sidebar__weight-panel--${tone}`}>
                <div className="task-form-sidebar__weight-copy">
                  <Typography component="p" className="task-form-sidebar__weight-label">
                    Calculated / Final Weight
                  </Typography>
                  <div className="task-form-sidebar__weight-value-row">
                    <Typography component="strong" className="task-form-sidebar__weight-value">
                      {preview.calculatedWeight.toFixed(1)}
                    </Typography>
                    <Typography component="span" className="task-form-sidebar__weight-unit">
                      pts
                    </Typography>
                    <span className={`task-form-sidebar__badge task-form-sidebar__badge--${tone}`}>
                      {toneLabels[tone]}
                    </span>
                  </div>
                </div>
              </div>

              <div className="task-form-sidebar__capacity-grid">
                <div className="task-form-sidebar__capacity-card task-form-sidebar__capacity-card--current">
                  <Typography component="span" className="task-form-sidebar__capacity-label">
                    Current Team Load
                  </Typography>
                  <Typography component="strong" className="task-form-sidebar__capacity-value">
                    {animatedPreviewPercentages.current.toFixed(1)}%
                  </Typography>
                </div>

                <div className="task-form-sidebar__capacity-card task-form-sidebar__capacity-card--after">
                  <Typography component="span" className="task-form-sidebar__capacity-label">
                    Capacity After Assignment
                  </Typography>
                  <Typography component="strong" className="task-form-sidebar__capacity-value">
                    {animatedPreviewPercentages.capacity.toFixed(1)}%
                  </Typography>
                </div>
              </div>
            </>
          ) : (
            <div className="task-form-sidebar__empty-state">
              <Typography component="p" className="task-form-sidebar__empty-text">
                Fill the assignment and scheduling fields to calculate the live workload impact.
              </Typography>

              <div className="task-form-sidebar__placeholder">
                <div className="task-form-sidebar__placeholder-line task-form-sidebar__placeholder-line--short" />
                <div className="task-form-sidebar__placeholder-grid">
                  <div className="task-form-sidebar__placeholder-card" />
                  <div className="task-form-sidebar__placeholder-card" />
                  <div className="task-form-sidebar__placeholder-card" />
                </div>
                <div className="task-form-sidebar__placeholder-footer">
                  <div className="task-form-sidebar__placeholder-pill" />
                  <div className="task-form-sidebar__placeholder-pill task-form-sidebar__placeholder-pill--wide" />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="task-form-sidebar__guidelines">
        <div className="task-form-sidebar__guidelines-header">
          <InfoOutlinedIcon className="task-form-sidebar__guidelines-icon" />
          <Typography component="p" className="task-form-sidebar__guidelines-eyebrow">
            Precision Guidelines
          </Typography>
        </div>

        <div className="task-form-sidebar__guidelines-list">
          <div className="task-form-sidebar__guideline">
            <Typography component="p" className="task-form-sidebar__guideline-text">
              Define success criteria clearly in the description.
            </Typography>
          </div>

          <div className="task-form-sidebar__guideline">
            <Typography component="p" className="task-form-sidebar__guideline-text">
              Medium and complex tasks should include enough effort detail to justify the multiplier.
            </Typography>
          </div>

          <div className="task-form-sidebar__guideline">
            <Typography component="p" className="task-form-sidebar__guideline-text">
              Due dates must stay on or after the start date and remain aligned with {options.teamName}.
            </Typography>
          </div>

          {selectedMember ? (
            <div className="task-form-sidebar__guideline">
              <Typography component="p" className="task-form-sidebar__guideline-text">
                {selectedMember.fullName} is the selected {specializationLabel[selectedMember.specialization]} specialist and currently has {selectedMember.activeTaskCount} active overlapping task{selectedMember.activeTaskCount === 1 ? '' : 's'}.
              </Typography>
            </div>
          ) : null}
        </div>
      </section>
    </aside>
  );
}
