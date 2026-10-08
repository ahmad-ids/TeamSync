import { useEffect, useState } from 'react';
import { getMyWorkloadDetails } from '../../services/workloadService';
import { resolveMemberAccessMessage } from './memberAccess';

export function useMemberAccessState() {
  const [isLoading, setIsLoading] = useState(true);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError('');

      try {
        await getMyWorkloadDetails({ period: 'thisWeek' });
        if (!isCancelled) {
          setAccessDeniedMessage(null);
        }
      } catch (loadError: unknown) {
        if (!isCancelled) {
          const accessMessage = resolveMemberAccessMessage(loadError);
          setAccessDeniedMessage(accessMessage);
          setError(accessMessage ? '' : 'Unable to verify member access right now.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, []);

  return {
    isLoading,
    accessDeniedMessage,
    error,
  };
}
