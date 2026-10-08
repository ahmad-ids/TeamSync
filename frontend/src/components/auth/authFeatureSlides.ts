import type { AuthFeatureSlide } from './AuthFeatureSlider';

export const loginFeatureSlides: readonly AuthFeatureSlide[] = [
  {
    title: 'Pick up where your team left off.',
    description: 'Return to active tasks, current workload pressure, and pending updates without losing context.',
  },
  {
    title: 'Stay in control of execution.',
    description: 'Keep priorities visible so deadlines, ownership, and team capacity remain clear as work moves.',
  },
  {
    title: 'Maintain clarity through change.',
    description: 'Review task updates and change requests in one flow to keep delivery steady and aligned.',
  },
  {
    title: 'Turn daily progress into momentum.',
    description: 'Track work continuously and keep the next decision obvious for you and the team.',
  },
] as const;

export const signupFeatureSlides: readonly AuthFeatureSlide[] = [
  {
    title: 'Start with a clearer workflow.',
    description: 'Bring tasks, workload visibility, and request handling into one focused system from day one.',
  },
  {
    title: 'Build better team coordination.',
    description: 'Create shared visibility so assignments, priorities, and follow-through feel structured from the start.',
  },
  {
    title: 'Set up work that scales cleanly.',
    description: 'Track team capacity early and avoid the confusion that usually appears as work grows.',
  },
  {
    title: 'Create a stronger rhythm for delivery.',
    description: 'Give your team a better way to plan, adjust, and move work forward with confidence.',
  },
] as const;
