import { Button, Card } from '@waypoint/ui';
import { SKILL_TAXONOMY, type SeniorityLevel, type SkillCategory, type WorkMode } from '@waypoint/shared';
import { useEffect, useState } from 'react';
import { useProfile, useUpdateProfile } from '../api/profile';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';

const CATEGORY_ORDER: SkillCategory[] = [
  'language',
  'frontend',
  'backend',
  'database',
  'cloud',
  'devops',
  'practice',
];

const CATEGORY_LABELS: Record<SkillCategory, string> = {
  language: 'Languages',
  frontend: 'Frontend',
  backend: 'Backend',
  database: 'Databases',
  cloud: 'Cloud',
  devops: 'DevOps',
  practice: 'Practices',
};

const SKILLS_BY_CATEGORY: Record<SkillCategory, string[]> = CATEGORY_ORDER.reduce(
  (acc, category) => {
    acc[category] = SKILL_TAXONOMY.filter((s) => s.category === category).map((s) => s.name);
    return acc;
  },
  {} as Record<SkillCategory, string[]>,
);

const SENIORITY_OPTIONS: SeniorityLevel[] = ['intern', 'junior', 'mid', 'senior', 'lead'];
const WORK_MODE_OPTIONS: WorkMode[] = ['remote', 'hybrid', 'onsite'];

interface FormState {
  skills: Set<string>;
  yearsOfExperience: number;
  targetSeniority: SeniorityLevel;
  targetWorkModes: Set<WorkMode>;
  locationsText: string;
  hoursPerWeek: number;
}

export function ProfilePage() {
  const profileQuery = useProfile();
  const updateProfile = useUpdateProfile();
  const [form, setForm] = useState<FormState | null>(null);

  // Seed local form state once the profile loads; further server updates
  // (e.g. from another tab) don't clobber in-progress edits.
  useEffect(() => {
    if (profileQuery.data && !form) {
      setForm({
        skills: new Set(profileQuery.data.skills),
        yearsOfExperience: profileQuery.data.yearsOfExperience,
        targetSeniority: profileQuery.data.targetSeniority,
        targetWorkModes: new Set(profileQuery.data.targetWorkModes),
        locationsText: profileQuery.data.locations.join(', '),
        hoursPerWeek: profileQuery.data.hoursPerWeek,
      });
    }
  }, [profileQuery.data, form]);

  if (profileQuery.isLoading || !form) {
    return (
      <>
        <PageHeader title="Profile" subtitle="Your skills and preferences, used to score and match jobs." />
        <div className="skeleton-card" />
      </>
    );
  }

  if (profileQuery.isError) {
    return (
      <>
        <PageHeader title="Profile" subtitle="Your skills and preferences, used to score and match jobs." />
        <div className="error-state">
          <Icon name="alert" size={16} />
          Couldn’t load your profile — is the API running on :3001?
        </div>
      </>
    );
  }

  const toggleSkill = (skill: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.skills);
      if (next.has(skill)) next.delete(skill);
      else next.add(skill);
      return { ...prev, skills: next };
    });
  };

  const toggleWorkMode = (mode: WorkMode) => {
    setForm((prev) => {
      if (!prev) return prev;
      const next = new Set(prev.targetWorkModes);
      if (next.has(mode)) next.delete(mode);
      else next.add(mode);
      return { ...prev, targetWorkModes: next };
    });
  };

  const handleSave = () => {
    updateProfile.mutate({
      skills: [...form.skills],
      yearsOfExperience: form.yearsOfExperience,
      targetSeniority: form.targetSeniority,
      targetWorkModes: [...form.targetWorkModes],
      locations: form.locationsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      hoursPerWeek: form.hoursPerWeek,
    });
  };

  return (
    <>
      <PageHeader
        title="Profile"
        subtitle="Your skills and preferences, used to score and match jobs."
      />

      <Card style={{ maxWidth: 720 }}>
        <div className="profile-section">
          <h3 className="profile-section-title">Skills</h3>
          <p className="profile-section-hint">Click to add or remove — used to compute match scores.</p>
          {CATEGORY_ORDER.map((category) => (
            <div key={category} className="skill-category-block">
              <p className="skill-category-label">{CATEGORY_LABELS[category]}</p>
              <div className="chip-row">
                {SKILLS_BY_CATEGORY[category].map((skill) => (
                  <button
                    key={skill}
                    className={`filter-chip${form.skills.has(skill) ? ' active' : ''}`}
                    onClick={() => toggleSkill(skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">Years of experience</h3>
          <div className="stepper">
            <button
              className="icon-button"
              onClick={() => setForm((p) => p && { ...p, yearsOfExperience: Math.max(0, p.yearsOfExperience - 1) })}
              aria-label="Decrease years of experience"
            >
              <Icon name="minus" size={14} />
            </button>
            <span className="stepper-value">{form.yearsOfExperience}</span>
            <button
              className="icon-button"
              onClick={() => setForm((p) => p && { ...p, yearsOfExperience: p.yearsOfExperience + 1 })}
              aria-label="Increase years of experience"
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">Target seniority</h3>
          <div className="chip-row">
            {SENIORITY_OPTIONS.map((level) => (
              <button
                key={level}
                className={`filter-chip${form.targetSeniority === level ? ' active' : ''}`}
                onClick={() => setForm((p) => p && { ...p, targetSeniority: level })}
              >
                {level}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">Target work modes</h3>
          <div className="chip-row">
            {WORK_MODE_OPTIONS.map((mode) => (
              <button
                key={mode}
                className={`filter-chip${form.targetWorkModes.has(mode) ? ' active' : ''}`}
                onClick={() => toggleWorkMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        <div className="profile-section">
          <h3 className="profile-section-title">Study hours per week</h3>
          <p className="profile-section-hint">Used to pace the Phase 3 prep roadmap into weekly chunks.</p>
          <div className="stepper">
            <button
              className="icon-button"
              onClick={() => setForm((p) => p && { ...p, hoursPerWeek: Math.max(1, p.hoursPerWeek - 1) })}
              aria-label="Decrease study hours per week"
            >
              <Icon name="minus" size={14} />
            </button>
            <span className="stepper-value">{form.hoursPerWeek}</span>
            <button
              className="icon-button"
              onClick={() => setForm((p) => p && { ...p, hoursPerWeek: Math.min(80, p.hoursPerWeek + 1) })}
              aria-label="Increase study hours per week"
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        </div>

        <div className="profile-section" style={{ marginBottom: 0 }}>
          <h3 className="profile-section-title">Locations</h3>
          <p className="profile-section-hint">Comma-separated (e.g. Ho Chi Minh City, Remote).</p>
          <input
            className="profile-text-input"
            type="text"
            value={form.locationsText}
            onChange={(e) => setForm((p) => p && { ...p, locationsText: e.target.value })}
          />
        </div>

        <div className="profile-save-row">
          <Button onClick={handleSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? 'Saving…' : 'Save profile'}
          </Button>
          {updateProfile.isSuccess ? (
            <span className="inline-status">Saved.</span>
          ) : updateProfile.isError ? (
            <span className="inline-status" style={{ color: 'var(--danger)' }}>
              Couldn’t save — check your inputs.
            </span>
          ) : null}
        </div>
      </Card>
    </>
  );
}
