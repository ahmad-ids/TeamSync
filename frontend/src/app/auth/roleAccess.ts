const roleNames = ['TeamLeader', 'Member'] as const;

export type AuthRole = (typeof roleNames)[number];

export function normalizeRole(role: string | null | undefined): AuthRole {
  if (typeof role !== 'string') {
    return 'Member';
  }

  const normalized = role.trim().toLowerCase();
  if (normalized === 'teamleader') {
    return 'TeamLeader';
  }

  return 'Member';
}

export function resolveHomePathByRole(role: string | null | undefined): string {
  return normalizeRole(role) === 'Member' ? '/member' : '/';
}

export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  const normalizedRole = normalizeRole(role);
  const path = normalizePath(pathname);

  if (normalizedRole === 'Member') {
    return (
      path === '/member'
      || path === '/member/tasks'
      || path === '/member/change-requests'
      || path === '/member/history'
      || isTaskDetailsPath(path)
    );
  }

  return (
    path === '/'
    || path === '/change-requests'
    || path === '/tasks/new'
    || isTaskDetailsPath(path)
    || isTaskEditPath(path)
    || isMemberDetailsPath(path)
  );
}

export function getNavigationItemsByRole(role: string | null | undefined) {
  const normalizedRole = normalizeRole(role);
  if (normalizedRole === 'Member') {
    return [
      { label: 'Dashboard', to: '/member' },
      { label: 'My Tasks', to: '/member/tasks' },
      { label: 'My Change Requests', to: '/member/change-requests' },
      { label: 'Activity', to: '/member/history' },
    ] as const;
  }

  return [
    { label: 'Workload', to: '/' },
    { label: 'Create Task', to: '/tasks/new' },
    { label: 'Change Requests', to: '/change-requests' },
  ] as const;
}

function normalizePath(pathname: string): string {
  if (!pathname) {
    return '/';
  }

  const withoutQuery = pathname.split('?')[0].split('#')[0];
  return withoutQuery.endsWith('/') && withoutQuery !== '/'
    ? withoutQuery.slice(0, -1)
    : withoutQuery;
}

function isTaskDetailsPath(pathname: string): boolean {
  const match = /^\/tasks\/([^/]+)$/.exec(pathname);
  if (!match) {
    return false;
  }

  const taskId = match[1].toLowerCase();
  return taskId !== 'new' && taskId !== 'edit';
}

function isTaskEditPath(pathname: string): boolean {
  return /^\/tasks\/[^/]+\/edit$/.test(pathname);
}

function isMemberDetailsPath(pathname: string): boolean {
  return /^\/members\/[^/]+$/.test(pathname);
}
