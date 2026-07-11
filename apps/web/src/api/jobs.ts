import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  CrawlRunRecord,
  JobListResponse,
  JobPatch,
  JobQuery,
  JobSource,
} from '@waypoint/shared';
import { apiFetch } from './client';

function buildQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useJobs(query: JobQuery) {
  return useQuery({
    queryKey: ['jobs', query],
    queryFn: () => apiFetch<JobListResponse>(`/jobs${buildQueryString(query)}`),
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: JobPatch }) =>
      apiFetch(`/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      const previous = queryClient.getQueriesData<JobListResponse>({ queryKey: ['jobs'] });
      queryClient.setQueriesData<JobListResponse>({ queryKey: ['jobs'] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          // A hidden job should vanish from the list immediately; a saved
          // toggle just flips the field in place.
          items: patch.hidden
            ? old.items.filter((job) => job.id !== id)
            : old.items.map((job) => (job.id === id ? { ...job, ...patch } : job)),
        };
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      context?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useCrawlRuns() {
  return useQuery({
    queryKey: ['crawl-runs'],
    queryFn: () => apiFetch<CrawlRunRecord[]>('/crawl/runs'),
    // Poll while a crawl might be in flight so source health updates without a manual refresh.
    refetchInterval: 5000,
  });
}

export function useRunCrawl() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (source?: JobSource) =>
      apiFetch<{ enqueued: JobSource[] }>(`/crawl/run${buildQueryString({ source })}`, {
        method: 'POST',
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['crawl-runs'] });
      // Crawls finish asynchronously; give it a few seconds then refetch the list too.
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ['jobs'] }), 4000);
    },
  });
}
