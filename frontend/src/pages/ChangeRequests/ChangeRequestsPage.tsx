import { useDeferredValue, useEffect, useState } from 'react';
import { ChangeRequestTable } from '../../components/approvals/ChangeRequestTable';
import { approveChangeRequest, getChangeRequests, rejectChangeRequest } from '../../services/changeRequestService';

export function ChangeRequestsPage() {
  const [status, setStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'' | 'ChangeOwner' | 'ChangeDueDate' | 'IncreaseEstimatedEffort'>('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'impact'>('newest');
  const [data, setData] = useState<Awaited<ReturnType<typeof getChangeRequests>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionRequestId, setActionRequestId] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    void getChangeRequests({
      status,
      type: selectedType || undefined,
      search: deferredSearch || undefined,
      sort,
    })
      .then((response) => {
        if (isMounted) {
          setData(response);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError('Unable to load change requests.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [deferredSearch, selectedType, sort, status]);

  const reload = () =>
    getChangeRequests({
      status,
      type: selectedType || undefined,
      search: deferredSearch || undefined,
      sort,
    }).then((response) => setData(response));

  const handleApprove = async (id: string) => {
    setActionRequestId(id);
    setError(null);

    try {
      await approveChangeRequest(id);
      await reload();
    } catch {
      setError('Unable to approve the change request.');
    } finally {
      setActionRequestId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionRequestId(id);
    setError(null);

    try {
      await rejectChangeRequest(id);
      await reload();
    } catch {
      setError('Unable to reject the change request.');
    } finally {
      setActionRequestId(null);
    }
  };

  return (
    <ChangeRequestTable
      data={data}
      loading={loading}
      error={error}
      status={status}
      search={search}
      selectedType={selectedType}
      sort={sort}
      actionRequestId={actionRequestId}
      onStatusChange={setStatus}
      onSearchChange={setSearch}
      onTypeChange={setSelectedType}
      onSortChange={setSort}
      onApprove={handleApprove}
      onReject={handleReject}
    />
  );
}
