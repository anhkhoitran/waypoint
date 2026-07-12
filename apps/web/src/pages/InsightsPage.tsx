import { Button, Card } from '@waypoint/ui';
import type { SkillCategory } from '@waypoint/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useGap, useInsightsSummary, useSkillDemand, useSkillTrend } from '../api/insights';
import { useProfile } from '../api/profile';
import { SkillDemandChart } from '../components/charts/SkillDemandChart';
import { SkillTrendChart } from '../components/charts/SkillTrendChart';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { usePageTitle } from '../lib/usePageTitle';

type CategoryFilter = 'all' | Extract<SkillCategory, 'frontend' | 'backend' | 'cloud'>;

const CATEGORY_TABS: Array<{ key: CategoryFilter; labelKey: string }> = [
  { key: 'all', labelKey: 'insights.categoryAll' },
  { key: 'frontend', labelKey: 'insights.categoryFrontend' },
  { key: 'backend', labelKey: 'insights.categoryBackend' },
  { key: 'cloud', labelKey: 'insights.categoryCloud' },
];

const WINDOW_OPTIONS = [
  { value: '7d', labelKey: 'insights.window7d' },
  { value: '30d', labelKey: 'insights.window30d' },
  { value: '90d', labelKey: 'insights.window90d' },
];

export function InsightsPage() {
  const { t } = useTranslation();
  usePageTitle(t('nav.marketInsights'));
  const navigate = useNavigate();
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
        title={t('insights.title')}
        subtitle={t('insights.subtitle')}
        actions={
          <select
            className="window-select"
            value={windowValue}
            onChange={(e) => setWindowValue(e.target.value)}
            aria-label={t('insights.timeWindowAriaLabel')}
          >
            {WINDOW_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {t(opt.labelKey)}
              </option>
            ))}
          </select>
        }
      />

      <div className="stat-tile-row">
        <div className="stat-tile">
          <div className="stat-tile-value">{summaryQuery.data?.jobsInWindow ?? '—'}</div>
          <div className="stat-tile-label">{t('insights.statJobsInWindow')}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">
            {summaryQuery.data ? `${summaryQuery.data.sourcesHealthy}/${summaryQuery.data.sourcesTotal}` : '—'}
          </div>
          <div className="stat-tile-label">{t('insights.statSourcesHealthy')}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value">{summaryQuery.data?.medianSalary ?? '—'}</div>
          <div className="stat-tile-label">{t('insights.statMedianSalary')}</div>
        </div>
        <div className="stat-tile">
          <div className="stat-tile-value" style={{ fontSize: 17 }}>
            {summaryQuery.data?.topGapSkills[0] ?? '—'}
          </div>
          <div className="stat-tile-label">{t('insights.statTopGapSkill')}</div>
        </div>
      </div>

      {demandQuery.isError ? (
        <div className="error-state">
          <Icon name="alert" size={16} />
          {t('common.loadError', { thing: t('insights.title') })}
        </div>
      ) : !hasAnyData && !demandQuery.isLoading ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="chart" size={24} />
          </span>
          <h2 className="empty-title">{t('insights.emptyTitle')}</h2>
          <p className="empty-blurb">{t('insights.emptyBlurb')}</p>
        </div>
      ) : (
        <>
          <Card className="insights-card">
            <div className="insights-card-header">
              <div>
                <h3 className="insights-card-title">{t('insights.skillDemandTitle')}</h3>
                <p className="insights-card-hint">{t('insights.skillDemandHint')}</p>
              </div>
              <div className="filter-row" style={{ marginBottom: 0 }}>
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    className={`filter-chip${category === tab.key ? ' active' : ''}`}
                    onClick={() => setCategory(tab.key)}
                  >
                    {t(tab.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            {demandQuery.isLoading ? (
              <div className="skeleton-card" style={{ height: 240 }} />
            ) : demandData.length === 0 ? (
              <p className="profile-section-hint">{t('insights.noSkillsInCategory')}</p>
            ) : (
              <SkillDemandChart data={demandData} profileSkills={profileSkills} />
            )}
          </Card>

          <Card className="insights-card">
            <div className="insights-card-header">
              <div>
                <h3 className="insights-card-title">{t('insights.trendTitle')}</h3>
                <p className="insights-card-hint">{t('insights.trendHint')}</p>
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
            ) : trendQuery.isError ? (
              <div className="error-state">
                <Icon name="alert" size={16} />
                {t('common.loadError', { thing: t('insights.trendTitle') })}
              </div>
            ) : trendQuery.data ? (
              <SkillTrendChart trend={trendQuery.data} />
            ) : (
              <p className="profile-section-hint">{t('insights.pickSkillsHint')}</p>
            )}
          </Card>

          <Card className="insights-card" style={{ marginBottom: 0 }}>
            <div className="insights-card-header">
              <div>
                <h3 className="insights-card-title">{t('insights.yourGapTitle')}</h3>
                <p className="insights-card-hint">{t('insights.yourGapHint')}</p>
              </div>
            </div>
            {gapQuery.isLoading ? (
              <div className="skeleton-card" style={{ height: 160 }} />
            ) : gapQuery.isError ? (
              <div className="error-state">
                <Icon name="alert" size={16} />
                {t('common.loadError', { thing: t('insights.yourGapTitle') })}
              </div>
            ) : (gapQuery.data?.length ?? 0) === 0 ? (
              <p className="profile-section-hint">{t('insights.noGap')}</p>
            ) : (
              <div className="gap-list">
                {gapQuery.data!.slice(0, 10).map((g) => (
                  <div key={g.skill} className="gap-row">
                    <span className="gap-row-skill">{g.skill}</span>
                    <span className="gap-row-meta">
                      {t('insights.jobsAndShare', { count: g.jobCount, pct: Math.round(g.share * 100) })}
                    </span>
                    <Button variant="ghost" onClick={() => navigate('/roadmap')}>
                      {t('insights.addToRoadmap')}
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
