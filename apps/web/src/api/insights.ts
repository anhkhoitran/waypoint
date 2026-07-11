import { useQuery } from '@tanstack/react-query';
import type {
  InsightsSummary,
  SeniorityLevel,
  SkillDemandItem,
  SkillTrendResponse,
} from '@waypoint/shared';
import { apiFetch } from './client';

function qs(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function useInsightsSummary() {
  return useQuery({
    queryKey: ['insights', 'summary'],
    queryFn: () => apiFetch<InsightsSummary>('/insights/summary'),
  });
}

export function useSkillDemand(window: string, seniority?: SeniorityLevel) {
  return useQuery({
    queryKey: ['insights', 'skill-demand', window, seniority],
    queryFn: () =>
      apiFetch<SkillDemandItem[]>(`/insights/skill-demand${qs({ window, seniority })}`),
  });
}

export function useSkillTrend(skills: string[], window: string, bucket: 'day' | 'week' = 'week') {
  return useQuery({
    queryKey: ['insights', 'skill-trend', skills, window, bucket],
    queryFn: () =>
      apiFetch<SkillTrendResponse>(
        `/insights/skill-trend${qs({ skills: skills.join(','), window, bucket })}`,
      ),
    enabled: skills.length > 0,
  });
}

export function useGap() {
  return useQuery({
    queryKey: ['insights', 'gap'],
    queryFn: () => apiFetch<SkillDemandItem[]>('/insights/gap'),
  });
}
