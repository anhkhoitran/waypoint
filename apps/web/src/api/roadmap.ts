import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { RoadmapGenerateResponse, RoadmapItemRecord, RoadmapItemStatus } from '@waypoint/shared';
import { apiFetch } from './client';

export function useRoadmap() {
  return useQuery({
    queryKey: ['roadmap'],
    queryFn: () => apiFetch<RoadmapItemRecord[]>('/roadmap'),
  });
}

export function useGenerateRoadmap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<RoadmapGenerateResponse>('/roadmap/generate', { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap'] });
    },
  });
}

export function useUpdateRoadmapItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: RoadmapItemStatus }) =>
      apiFetch<RoadmapItemRecord>(`/roadmap/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: ['roadmap'] });
      const previous = queryClient.getQueryData<RoadmapItemRecord[]>(['roadmap']);
      queryClient.setQueryData<RoadmapItemRecord[]>(['roadmap'], (old) =>
        old?.map((item) =>
          item.id === id
            ? { ...item, status, completedAt: status === 'done' ? new Date() : null }
            : item,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['roadmap'], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['roadmap'] });
    },
  });
}
