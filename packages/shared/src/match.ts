import type { SeniorityLevel, WorkMode } from './index.js';

export interface JobSkillInput {
  skill: string;
  confidence: number;
}

export interface MatchResult {
  /** 0-100. */
  score: number;
  matched: string[];
  missing: string[];
}

export interface MatchProfile {
  skills: string[];
  targetSeniority: SeniorityLevel;
  targetWorkModes: WorkMode[];
}

const SENIORITY_LADDER: SeniorityLevel[] = ['intern', 'junior', 'mid', 'senior', 'lead'];

/** exact 1.0, one rung apart 0.6, everything else (including "unknown" on either side) 0.2. */
function seniorityAlignment(target: SeniorityLevel, job: SeniorityLevel): number {
  if (target === job) return 1.0;
  const targetIdx = SENIORITY_LADDER.indexOf(target);
  const jobIdx = SENIORITY_LADDER.indexOf(job);
  if (targetIdx === -1 || jobIdx === -1) return 0.2; // one side is "unknown"
  return Math.abs(targetIdx - jobIdx) === 1 ? 0.6 : 0.2;
}

/** Full credit for a targeted mode, partial credit for a mismatch, neutral-ish when the job's mode is unknown. */
function workModeFit(targetModes: WorkMode[], jobMode: WorkMode): number {
  if (jobMode === 'unknown') return 0.7;
  return targetModes.includes(jobMode) ? 1.0 : 0.3;
}

/**
 * Scores how well a job fits a profile: skill coverage (70%, weighted by each
 * skill's extraction confidence), seniority alignment (20%), work-mode fit
 * (10%). Returns null when the job has no extracted skills at all — there's
 * nothing to score coverage against, and the UI hides the pill in that case
 * rather than showing a misleadingly low number.
 */
export function matchScore(
  profile: MatchProfile,
  jobSkills: JobSkillInput[],
  jobSeniority: SeniorityLevel,
  jobWorkMode: WorkMode,
): MatchResult | null {
  if (jobSkills.length === 0) return null;

  const profileSkills = new Set(profile.skills);
  const matched: string[] = [];
  const missing: string[] = [];
  let weightedMatched = 0;
  let totalWeight = 0;

  for (const js of jobSkills) {
    totalWeight += js.confidence;
    if (profileSkills.has(js.skill)) {
      matched.push(js.skill);
      weightedMatched += js.confidence;
    } else {
      missing.push(js.skill);
    }
  }

  const coverage = totalWeight > 0 ? weightedMatched / totalWeight : 0;
  const seniority = seniorityAlignment(profile.targetSeniority, jobSeniority);
  const workMode = workModeFit(profile.targetWorkModes, jobWorkMode);

  const score = Math.round((coverage * 0.7 + seniority * 0.2 + workMode * 0.1) * 100);

  return { score, matched, missing };
}
