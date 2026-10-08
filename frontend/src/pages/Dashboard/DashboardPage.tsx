import { Alert, CircularProgress } from '@mui/material';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { WorkloadOverview } from '../../components/dashboard/WorkloadOverview';
import { getClickUpConnection } from '../../services/authService';
import { getWorkloadSummary } from '../../services/workloadService';
import type { WorkloadPeriod, WorkloadSort, WorkloadSummaryModel } from '../../types/domain';

export function DashboardPage() {
  const [period, setPeriod] = useState<WorkloadPeriod>('thisWeek');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<WorkloadSort>('workload');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [data, setData] = useState<WorkloadSummaryModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [clickUpConnectionStatus, setClickUpConnectionStatus] = useState<
    'loading' | 'connected' | 'disconnected' | 'error'
  >('loading');
  const [clickUpWorkspaceName, setClickUpWorkspaceName] = useState('');

  useEffect(() => {
    let isCancelled = false;

    async function load() {
      setIsLoading(true);
      setError('');

      try {
        const result = await getWorkloadSummary({
          period,
          startDate: period === 'custom' ? customStartDate : undefined,
          endDate: period === 'custom' ? customEndDate : undefined,
          sortBy,
        });

        if (!isCancelled) {
          setData(result);
        }
      } catch {
        if (!isCancelled) {
          setData(null);
          setError('Unable to load workload data right now.');
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    if (clickUpConnectionStatus === 'loading') {
      return;
    }

    if (period === 'custom' && (!customStartDate || !customEndDate)) {
      setError('');
      setIsLoading(false);
      setData(null);
      return;
    }

    void load();

    return () => {
      isCancelled = true;
    };
  }, [period, customStartDate, customEndDate, sortBy, clickUpConnectionStatus]);

  useEffect(() => {
    let isCancelled = false;

    async function loadClickUpConnection() {
      setClickUpConnectionStatus('loading');

      try {
        const connection = await getClickUpConnection();
        if (isCancelled) {
          return;
        }

        if (connection?.isActive && connection.workspaceName) {
          setClickUpWorkspaceName(connection.workspaceName);
          setClickUpConnectionStatus('connected');
        } else {
          setClickUpWorkspaceName('');
          setClickUpConnectionStatus('disconnected');
        }
      } catch {
        if (!isCancelled) {
          setClickUpWorkspaceName('');
          setClickUpConnectionStatus('error');
        }
      }
    }

    void loadClickUpConnection();

    return () => {
      isCancelled = true;
    };
  }, []);

  if (isLoading && !data) {
    return (
      <LoadingShell>
        <CircularProgress />
      </LoadingShell>
    );
  }

  if (error && !data) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <WorkloadOverview
      data={data}
      error={error}
      isLoading={isLoading}
      clickUpConnectionStatus={clickUpConnectionStatus}
      clickUpWorkspaceName={clickUpWorkspaceName}
      period={period}
      search={search}
      sortBy={sortBy}
      viewMode={viewMode}
      customStartDate={customStartDate}
      customEndDate={customEndDate}
      onPeriodChange={setPeriod}
      onSearchChange={setSearch}
      onSortChange={setSortBy}
      onViewModeChange={setViewMode}
      onCustomStartDateChange={setCustomStartDate}
      onCustomEndDateChange={setCustomEndDate}
    />
  );
}

// Styled components
const LoadingShell = styled.div`
  display: grid;
  place-items: center;
  min-height: 320px;
`;
