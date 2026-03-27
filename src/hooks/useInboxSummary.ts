import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { getInboxSummary, InboxSummary } from '@/lib/tasksApi';
import { useAuth } from '@/lib/AuthContext';

const INBOX_KEY = ['inbox-summary'];

export function useInboxSummary() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery<InboxSummary>({
    queryKey: INBOX_KEY,
    queryFn: getInboxSummary,
    enabled: !!user,
    refetchInterval: 30_000,
    staleTime: 10_000,
    retry: 1,
  });

  const qc = useQueryClient();
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: INBOX_KEY });
  }, [qc]);

  return {
    summary: data ?? { my_open_tasks: 0, waiting_my_reply: 0, unread_notifications: 0 },
    isLoading,
    refresh,
  };
}
