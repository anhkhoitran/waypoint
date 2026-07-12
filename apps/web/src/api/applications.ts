import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApplicationBoard,
  ApplicationCreateInput,
  ApplicationEventInput,
  ApplicationEventRecord,
  ApplicationRecord,
  ApplicationStage,
  ApplicationStats,
  ApplicationUpdateInput,
} from '@waypoint/shared';
import { apiFetch } from './client';

export function useApplicationsBoard() {
  return useQuery({
    queryKey: ['applications', 'board'],
    queryFn: () => apiFetch<ApplicationBoard>('/applications'),
  });
}

export function useApplicationsStats() {
  return useQuery({
    queryKey: ['applications', 'stats'],
    queryFn: () => apiFetch<ApplicationStats>('/applications/stats'),
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: ['applications', 'detail', id],
    queryFn: () => apiFetch<ApplicationRecord>(`/applications/${id}`),
    enabled: id !== null,
  });
}

export function useCreateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationCreateInput) =>
      apiFetch<ApplicationRecord>('/applications', { method: 'POST', body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useUpdateApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApplicationUpdateInput }) =>
      apiFetch<ApplicationRecord>(`/applications/${id}`, { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useUpdateApplicationStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: ApplicationStage }) =>
      apiFetch<ApplicationRecord>(`/applications/${id}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      }),
    onMutate: async ({ id, stage }) => {
      await queryClient.cancelQueries({ queryKey: ['applications', 'board'] });
      const previous = queryClient.getQueryData<ApplicationBoard>(['applications', 'board']);
      if (previous) {
        const next: ApplicationBoard = JSON.parse(JSON.stringify(previous));
        for (const column of Object.values(next)) {
          const idx = column.findIndex((a: ApplicationRecord) => a.id === id);
          if (idx !== -1) {
            const [moved] = column.splice(idx, 1);
            if (moved) next[stage].unshift({ ...moved, stage });
            break;
          }
        }
        queryClient.setQueryData(['applications', 'board'], next);
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(['applications', 'board'], context.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });
}

export function useAddApplicationEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApplicationEventInput }) =>
      apiFetch<ApplicationEventRecord>(`/applications/${id}/events`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: (_data, { id }) => {
      void queryClient.invalidateQueries({ queryKey: ['applications', 'detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['applications', 'stats'] });
    },
  });
}
