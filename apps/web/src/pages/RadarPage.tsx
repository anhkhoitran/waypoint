import { Badge, Button, Card } from '@waypoint/ui';
import type { JobQuery, JobRecord } from '@waypoint/shared';
import { SOURCE_LABELS } from '@waypoint/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJobs, useRunCrawl, useUpdateJob } from '../api/jobs';
import { Icon } from '../components/Icon';
import { JobDetailDrawer } from '../components/JobDetailDrawer';
import { PageHeader } from '../components/PageHeader';
import { SourceHealthPanel } from '../components/SourceHealthPanel';
import { scoreTone, workModeTone } from '../lib/jobTone';
import { timeAgo } from '../lib/time';

type FilterKey = 'all' | 'remote' | 'vietnam' | 'senior' | 'saved';

// "Vietnam" maps to itviec specifically — it's the only Vietnam-focused
// source with a working adapter today (topdev/vietnamworks are seeded but
// not yet crawled; see docs/plans/phase-1-crawler-and-job-feed.md).
const filterChips: Array<{ key: FilterKey; labelKey: string; query: Partial<JobQuery> }> = [
  { key: 'all', labelKey: 'radar.filters.allSources', query: {} },
  { key: 'remote', labelKey: 'radar.filters.remote', query: { workMode: 'remote' } },
  { key: 'vietnam', labelKey: 'radar.filters.vietnam', query: { source: 'itviec' } },
  { key: 'senior', labelKey: 'radar.filters.senior', query: { seniority: 'senior' } },
  { key: 'saved', labelKey: 'radar.filters.saved', query: { saved: true } },
];

export function RadarPage() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'match'>('newest');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const activeQuery = filterChips.find((f) => f.key === activeFilter)!.query;
  const query: JobQuery = { ...activeQuery, q: search.trim() || undefined, limit: 20, sort };

  const jobsQuery = useJobs(query);
  const updateJob = useUpdateJob();
  const runCrawl = useRunCrawl();

  const jobs = jobsQuery.data?.items ?? [];
  const isFiltered = activeFilter !== 'all' || search.trim().length > 0;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  return (
    <>
      <PageHeader
        title={t('radar.title')}
        subtitle={t('radar.subtitle')}
        actions={
          <>
            <Button variant="secondary" disabled title={t('radar.manageSourcesTooltip')}>
              {t('radar.manageSources')}
            </Button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {runCrawl.isPending ? (
                <span className="inline-status">
                  <span className="spin" style={{ display: 'inline-flex' }}>
                    <Icon name="spinner" size={13} />
                  </span>
                  {t('radar.enqueuing')}
                </span>
              ) : runCrawl.isSuccess && runCrawl.data ? (
                <span className="inline-status">
                  {t('radar.started', { sources: runCrawl.data.enqueued.map((s) => SOURCE_LABELS[s]).join(', ') })}
                </span>
              ) : null}
              <Button onClick={() => runCrawl.mutate(undefined)} disabled={runCrawl.isPending}>
                {t('radar.runCrawl')}
              </Button>
            </span>
          </>
        }
      />

      <SourceHealthPanel />

      <div className="toolbar-row">
        <div className="search-input-wrap">
          <Icon name="search" size={15} />
          <input
            className="search-input"
            type="text"
            placeholder={t('radar.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-row" style={{ marginBottom: 0 }}>
          {filterChips.map((chip) => (
            <button
              key={chip.key}
              className={`filter-chip${chip.key === activeFilter ? ' active' : ''}`}
              onClick={() => setActiveFilter(chip.key)}
            >
              {t(chip.labelKey)}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'newest' | 'match')}
          aria-label={t('radar.sortAriaLabel')}
        >
          <option value="newest">{t('radar.sortNewest')}</option>
          <option value="match">{t('radar.sortBestMatch')}</option>
        </select>
      </div>

      {jobsQuery.isLoading ? (
        <div className="job-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-card" />
          ))}
        </div>
      ) : jobsQuery.isError ? (
        <div className="error-state">
          <Icon name="alert" size={16} />
          {t('common.loadError', { thing: t('radar.title') })}
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="inbox" size={24} />
          </span>
          <h2 className="empty-title">
            {isFiltered ? t('radar.emptyTitleFiltered') : t('radar.emptyTitle')}
          </h2>
          <p className="empty-blurb">
            {isFiltered ? t('radar.emptyBlurbFiltered') : t('radar.emptyBlurb')}
          </p>
          {!isFiltered && (
            <Button onClick={() => runCrawl.mutate(undefined)} disabled={runCrawl.isPending}>
              {t('radar.runCrawl')}
            </Button>
          )}
        </div>
      ) : (
        <div className="job-list">
          {jobs.map((job: JobRecord) => (
            <Card key={job.id} className="job-card" onClick={() => setSelectedJobId(job.id)}>
              <div className="job-card-top">
                <span className="job-title">{job.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {job.matchScore ? (
                    <Badge tone={scoreTone(job.matchScore.score)}>
                      {t('radar.matchPill', { score: job.matchScore.score })}
                    </Badge>
                  ) : null}
                  {job.salaryText ? <span className="job-salary">{job.salaryText}</span> : null}
                  <div className="job-actions-row" onClick={(e) => e.stopPropagation()}>
                    <button
                      className={`icon-button${job.saved ? ' active' : ''}`}
                      title={job.saved ? t('radar.unsave') : t('radar.save')}
                      onClick={() =>
                        updateJob.mutate({ id: job.id, patch: { saved: !job.saved } })
                      }
                    >
                      <Icon name={job.saved ? 'bookmark-filled' : 'bookmark'} size={15} />
                    </button>
                    <button
                      className="icon-button"
                      title={t('radar.hide')}
                      onClick={() => updateJob.mutate({ id: job.id, patch: { hidden: true } })}
                    >
                      <Icon name="eye-off" size={15} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="job-meta">
                {job.company}
                <span aria-hidden="true">·</span>
                {job.location ?? t('radar.locationUnknown')}
              </div>
              <div className="job-badges">
                <Badge tone="accent">{SOURCE_LABELS[job.source]}</Badge>
                <Badge tone={workModeTone[job.workMode]}>{t(`workMode.${job.workMode}`)}</Badge>
                {job.seniority !== 'unknown' ? <Badge>{t(`seniority.${job.seniority}`)}</Badge> : null}
              </div>
              <div className="job-footer">
                <div className="tag-row">
                  {job.tags.map((tag) => (
                    <span key={tag} className="tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="clock" size={13} />
                  {timeAgo(job.postedAt)}
                </span>
              </div>
              {job.matchScore && job.matchScore.missing.length > 0 ? (
                <div className="job-gap">
                  {t('radar.gap', { skills: job.matchScore.missing.slice(0, 6).join(', ') })}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <JobDetailDrawer job={selectedJob} onClose={() => setSelectedJobId(null)} />
    </>
  );
}
