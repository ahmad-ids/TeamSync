import axios from 'axios';

export function resolveMemberAccessMessage(error: unknown) {
  if (!axios.isAxiosError(error)) {
    return null;
  }

  const status = error.response?.status;
  if (status === 404) {
    return 'This account is not assigned as a team member.';
  }

  if (status === 403) {
    return 'You do not have member access for this workspace.';
  }

  return null;
}
