import { Button, Card } from '@waypoint/ui';
import type { SkillCategory } from '@waypoint/shared';
import { useEffect, useState } from 'react';
import { useGap, useInsightsSummary, useSkillDemand, useSkillTrend } from '../api/insights';
import { useProfile } from '../api/profile';
import { SkillDemandChart } from '../components/charts/SkillDemandChart';
import { SkillTrendChart } from '../components/charts/SkillTrendChart';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';

type CategoryFilter = 'all' | Extract<SkillCategory, 'frontend' | 'backend' | 'cloud'>;

const CATEGORY_TABS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'frontend', label: 'Frontend' },
  { key: 'backend', label: 'Backend' },
  { key: 'cloud', label: 'Cloud' },
];

const WINDOW_OPTIONS = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function InsightsPage() {
  const [windowValue, setWindowValue] = useState('30d');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [trendSkills, setTrendSkills] = useState<string[] | null>(null);

  const summaryQuery = useInsightsSummary();
  const demandQuery = useSkillDemand(windowValue);
  const gapQuery = useGap();
  const profileQuery = useProfile();

  // Default the trend selection to the top 3 gap skills, once loaded.
  useEffect(() => {
    if (trendSkills === null && gapQuery.data) {
      setTrendSkills(gapQuery.data.slice(0, 3).map((g) => g.skill));
    }
  }, [gapQuery.data, trendSkills]);

  const trendQuery = useSkillTrend(trendSkills ?? [], '90d', 'week');

  const profileSkills = new Set(profileQuery.data?.skills ?? []);
  const demandData = (demandQuery.data ?? [])
    .filter((d) => category === 'all' || d.category === category)
    .slice(0, 15);

  const hasAnyData = (demandQuery.data?.length ?? 0) > 0;

  return (
    <>
      <PageHeader
        title="Market Insights"
        subtitle="What the market actually demands, extracted from every job description we crawl."
        actions={
          <select
            className="window-select"
            value={windowValue}
            onChange={(e) => setWindowValue(e.target.value)}
            aria-label="Time window"
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="stat-tile-row">
        <div className="stat-tile">
          <div className="stat-tile-value">{summaryQuery.data?.jobsInWindow ?? '—'}</div>
          <div className="stat-tile-label">Jobs in last 30 days</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">
            {summaryQuery.data ? `${summaryQuery.data.sourcesHealthy}/${summaryQuery.data.sourcesTotal}` : '—'}
          </div>
          <div className="stat-tile-label">Sources healthy</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{summaryQuery.data?.medianSalary ?? '—'}</div>
          <div className="stat-tile-label">Median salary (USD-parseable)</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value" style={{ fontSize: 17 }}>
            {summaryQuery.data?.topGapSkills[0] ?? '—'}
          </div>
          <div className="stat-tile-label">Top skill gap</div>
        </div>
      </div>

      {!hasAnyData && !demandQuery.isLoading ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="chart" size={24} />
          </span>
          <h2 className="empty-title">No data in this window yet</h2>
          <p className="empty-blurb">
            Run a crawl from the Job Radar, then come back — insights need extracted
            skills to chart anything.
          </p>
        </div>
      ) : (
        <>
          <Card className="insights-card">
            <div className="insights-card-header">
              <div>
                <h3 className="insights-card-title">Skill demand</h3>
                <p className="insights-card-hint">
                  Share of jobs in this window mentioning each skill. Accent bars are
                  in your profile; outlined bars are gaps.
                </p>
              </div>
              <div className="filter-row" style={{ marginBottom: 0 }}>
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={`filter-chip${category === tab.key ? ' active' : ''}`}
                    onClick={() => setCategory(tab.key)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            {demandQuery.isLoading ? (
              <div className="skeleton-card" style={{ height: 240 }} />
            ) : demandData.length === 0 ? (
              <p className="profile-section-hint">No skills in this category yet.</p>
            ) : (
              <SkillDemandChart data={demandData} profileSkills={profileSkills} />
            )}
          </Card>

          <Card className="insights-card">
            <div className="insights-card-header">
              <div>
                <h3 className="insights-card-title">Trend</h3>
                <p className="insights-card-hint">Weekly mentions over the last 90 days.</p>
              </div>
              <div className="filter-row" style={{ marginBottom: 0 }}>
                {(gapQuery.data ?? []).slice(0, 8).map((g) => {
                  const active = (trendSkills ?? []).includes(g.skill);
                  return (
                    <button
                      key={g.skill}
                      className={`filter-chip${active ? ' active' : ''}`}
                      onClick={() =>
                        setTrendSkills((prev) => {
                          const current = prev ?? [];
                          if (active) return current.filter((s) => s !== g.skill);
                          if (current.length >= 3) return current; // keep the 1-3 comfortable zone
                          return [...current, g.skill];
                        })
                      }
                    >
                      {g.skill}
                    </button>
                  );
                })}
              </div>
            </div>
            {trendQuery.isLoading ? (
              <div className="skeleton-card" style={{ height: 260 }} />
            ) : trendQuery.data ? (
              <SkillTrendChart trend={trendQuery.data} />
            ) : (
              <p className="profile-section-hint">Pick up to 3 skills above to chart their trend.</p>
            )}
          </Card>

          <Card className="insights-card" style={{ marginBottom: 0 }}>
            <div className="insights-card-header">
              <div>
                <h3 className="insights-card-title">Your gap</h3>
                <p className="insights-card-hint">
                  Skills the market wants most that aren't in your profile yet.
                </p>
              </div>
            </div>
            {gapQuery.isLoading ? (
              <div className="skeleton-card" style={{ height: 160 }} />
            ) : (gapQuery.data?.length ?? 0) === 0 ? (
              <p className="profile-section-hint">No gap — your profile covers current demand.</p>
            ) : (
              <div className="gap-list">
                {gapQuery.data!.slice(0, 10).map((g) => (
                  <div key={g.skill} className="gap-row">
                    <span className="gap-row-skill">{g.skill}</span>
                    <span className="gap-row-meta">
                      {g.jobCount} jobs · {Math.round(g.share * 100)}%
                    </span>
                    <Button variant="ghost" disabled title="Roadmap generation arrives in Phase 3">
                      → Add to roadmap
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
