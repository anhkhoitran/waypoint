import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ReviewCardRecord, ReviewStats, Sm2Grade } from '@waypoint/shared';
import { apiFetch } from './client';

export function useReviewQueue(limit = 20) {
  return useQuery({
    queryKey: ['review', 'queue', limit],
    queryFn: () => apiFetch<ReviewCardRecord[]>(`/review/queue?limit=${limit}`),
  });
}

export function useReviewStats() {
  return useQuery({
    queryKey: ['review', 'stats'],
    queryFn: () => apiFetch<ReviewStats>('/review/stats'),
    // Keeps the sidebar due-count badge fresh without a manual refresh.
    refetchInterval: 60_000,
  });
}

export function useGradeCard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, grade }: { id: string; grade: Sm2Grade }) =>
      apiFetch<ReviewCardRecord>(`/review/cards/${id}/grade`, {
        method: 'POST',
        body: JSON.stringify({ grade }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['review'] });
    },
  });
}
