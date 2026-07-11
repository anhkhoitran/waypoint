import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Profile, ProfileInput } from '@waypoint/shared';
import { apiFetch } from './client';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: () => apiFetch<Profile>('/profile'),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProfileInput) =>
      apiFetch<Profile>('/profile', { method: 'PUT', body: JSON.stringify(input) }),
    onSuccess: (updated) => {
      queryClient.setQueryData(['profile'], updated);
      // Match scores on the Radar depend on the profile.
      void queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}
