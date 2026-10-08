import { resolveAuthBackendOrigin } from './authEndpoints';

type ExternalProvider = 'clickup';
type ExternalAuthFlow = 'login' | 'signup';

export function buildExternalAuthStartUrl(provider: ExternalProvider, flow: ExternalAuthFlow): string {
  const origin = resolveAuthBackendOrigin();
  const startUrl = new URL(`/api/auth/external/${provider}/start`, origin);
  startUrl.searchParams.set('flow', flow);
  startUrl.searchParams.set('frontendOrigin', window.location.origin);
  return startUrl.toString();
}
