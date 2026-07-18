import { useQuery } from '@tanstack/react-query';
import type {
  InsightsSummary,
  RoleFunctionSplitItem,
  SalaryBySeniorityItem,
  SeniorityLevel,
  SkillDemandItem,
  SkillTrendResponse,
  TopCompanyItem,
  VolumeBySourceResponse,
  WorkModeSplitItem,
} from '@waypoint/shared';
import { apiFetch, buildQueryString } from './client';

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
      apiFetch<SkillDemandItem[]>(`/insights/skill-demand${buildQueryString({ window, seniority })}`),
  });
}

export function useSkillTrend(skills: string[], window: string, bucket: 'day' | 'week' = 'week') {
  return useQuery({
    queryKey: ['insights', 'skill-trend', skills, window, bucket],
    queryFn: () =>
      apiFetch<SkillTrendResponse>(
        `/insights/skill-trend${buildQueryString({ skills, window, bucket })}`,
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

export function useWorkModeSplit(window: string) {
  return useQuery({
    queryKey: ['insights', 'work-mode-split', window],
    queryFn: () =>
      apiFetch<WorkModeSplitItem[]>(`/insights/work-mode-split${buildQueryString({ window })}`),
  });
}

export function useSalaryBySeniority(window: string) {
  return useQuery({
    queryKey: ['insights', 'salary-by-seniority', window],
    queryFn: () =>
      apiFetch<SalaryBySeniorityItem[]>(`/insights/salary-by-seniority${buildQueryString({ window })}`),
  });
}

export function useVolumeBySource(weeks = 8) {
  return useQuery({
    queryKey: ['insights', 'volume-by-source', weeks],
    queryFn: () =>
      apiFetch<VolumeBySourceResponse>(`/insights/volume-by-source${buildQueryString({ weeks })}`),
  });
}

export function useTopCompanies(window: string, limit = 6) {
  return useQuery({
    queryKey: ['insights', 'top-companies', window, limit],
    queryFn: () =>
      apiFetch<TopCompanyItem[]>(`/insights/top-companies${buildQueryString({ window, limit })}`),
  });
}

export function useRoleFunctions(window: string) {
  return useQuery({
    queryKey: ['insights', 'role-functions', window],
    queryFn: () =>
      apiFetch<RoleFunctionSplitItem[]>(`/insights/role-functions${buildQueryString({ window })}`),
  });
}
