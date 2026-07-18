import { Badge, Button, Card } from '@waypoint/ui';
import type { JobQuery, JobRecord } from '@waypoint/shared';
import { SOURCE_LABELS } from '@waypoint/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useJobs, useRunCrawl, useUpdateJob } from '../api/jobs';
import { Icon } from '../components/Icon';
import { JobDetailDrawer } from '../components/JobDetailDrawer';
import { JobFilterPanel } from '../components/JobFilterPanel';
import { PageHeader } from '../components/PageHeader';
import { SourceHealthPanel } from '../components/SourceHealthPanel';
import { TrackApplicationButton } from '../components/TrackApplicationButton';
import { scoreTone, workModeTone } from '../lib/jobTone';
import { activeFilterCount, EMPTY_FILTERS, filtersToQuery, type RadarFilters } from '../lib/radarFilters';
import { timeAgo } from '../lib/time';
import { usePageTitle } from '../lib/usePageTitle';
import { useToast } from '../toast';

type SortKey = 'newest' | 'match' | 'salary';

export function RadarPage() {
  const { t } = useTranslation();
  usePageTitle(t('nav.jobRadar'));
  const { showToast } = useToast();
  const [filters, setFilters] = useState<RadarFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const query: JobQuery = { ...filtersToQuery(filters), q: search.trim() || undefined, sort };

  const jobsQuery = useJobs(query);
  const updateJob = useUpdateJob();
  const runCrawl = useRunCrawl();

  const jobs = jobsQuery.data?.items ?? [];
  const filterCount = activeFilterCount(filters);
  const isFiltered = filterCount > 0 || search.trim().length > 0;
  const selectedJob = jobs.find((job) => job.id === selectedJobId) ?? null;

  const isRemoteOnly = filters.workModes.length === 1 && filters.workModes[0] === 'remote';
  const isVietnamOnly = filters.sources.length === 1 && filters.sources[0] === 'itviec';
  const isSeniorPlus = filters.seniorities.length === 2 && filters.seniorities.includes('senior');

  // Quick chips merge one dimension into the current filters — they're
  // shortcuts, not a mutually exclusive radio group, so they stack with
  // whatever's set in the full filter panel.
  const quickChips: Array<{ key: string; label: string; active: boolean; onClick: () => void }> = [
    {
      key: 'all',
      label: t('radar.filters.allSources'),
      active: filterCount === 0,
      onClick: () => setFilters(EMPTY_FILTERS),
    },
    {
      key: 'remote',
      label: t('radar.filters.remote'),
      active: isRemoteOnly,
      onClick: () => setFilters((prev) => ({ ...prev, workModes: isRemoteOnly ? [] : ['remote'] })),
    },
    {
      key: 'vietnam',
      label: t('radar.filters.vietnam'),
      active: isVietnamOnly,
      onClick: () => setFilters((prev) => ({ ...prev, sources: isVietnamOnly ? [] : ['itviec'] })),
    },
    {
      key: 'senior',
      label: t('radar.filters.senior'),
      active: isSeniorPlus,
      onClick: () =>
        setFilters((prev) => ({ ...prev, seniorities: isSeniorPlus ? [] : ['senior', 'lead'] })),
    },
    {
      key: 'saved',
      label: t('radar.filters.saved'),
      active: filters.savedOnly,
      onClick: () => setFilters((prev) => ({ ...prev, savedOnly: !prev.savedOnly })),
    },
  ];

  const pills: Array<{ key: string; label: string; onRemove: () => void }> = [
    ...filters.sources.map((v) => ({
      key: `source-${v}`,
      label: SOURCE_LABELS[v],
      onRemove: () => setFilters((prev) => ({ ...prev, sources: prev.sources.filter((s) => s !== v) })),
    })),
    ...filters.workModes.map((v) => ({
      key: `workMode-${v}`,
      label: t(`workMode.${v}`),
      onRemove: () => setFilters((prev) => ({ ...prev, workModes: prev.workModes.filter((w) => w !== v) })),
    })),
    ...filters.seniorities.map((v) => ({
      key: `seniority-${v}`,
      label: t(`seniority.${v}`),
      onRemove: () =>
        setFilters((prev) => ({ ...prev, seniorities: prev.seniorities.filter((s) => s !== v) })),
    })),
  ];
  if (filters.salary !== 'any') {
    pills.push({
      key: 'salary',
      label: filters.salary === 'has' ? t('radar.filterPanel.hasSalary') : `$${filters.salary}k+`,
      onRemove: () => setFilters((prev) => ({ ...prev, salary: 'any' })),
    });
  }
  if (filters.posted !== 'any') {
    pills.push({
      key: 'posted',
      label: filters.posted === '24h' ? t('radar.filterPanel.last24h') : t('radar.filterPanel.lastWeek'),
      onRemove: () => setFilters((prev) => ({ ...prev, posted: 'any' })),
    });
  }
  if (filters.match !== 'any') {
    pills.push({
      key: 'match',
      label: `${filters.match}%+`,
      onRemove: () => setFilters((prev) => ({ ...prev, match: 'any' })),
    });
  }
  if (filters.savedOnly) {
    pills.push({
      key: 'saved',
      label: t('radar.filters.saved'),
      onRemove: () => setFilters((prev) => ({ ...prev, savedOnly: false })),
    });
  }

  const handleRunCrawl = () => {
    runCrawl.mutate(undefined, {
      onSuccess: (data) => {
        showToast(t('radar.started', { sources: data.enqueued.map((s) => SOURCE_LABELS[s]).join(', ') }));
      },
      onError: () => showToast(t('radar.crawlError'), 'error'),
    });
  };

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
              ) : null}
              <Button onClick={handleRunCrawl} disabled={runCrawl.isPending}>
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
          {quickChips.map((chip) => (
            <button
              key={chip.key}
              className={`filter-chip${chip.active ? ' active' : ''}`}
              onClick={chip.onClick}
            >
              {chip.label}
            </button>
          ))}
        </div>
        <button
          className={`filter-panel-toggle${filtersOpen ? ' active' : ''}`}
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <Icon name="filter" size={13} />
          {t('radar.filterPanel.title')}
          {filterCount > 0 ? <Badge tone="accent">{filterCount}</Badge> : null}
        </button>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          aria-label={t('radar.sortAriaLabel')}
        >
          <option value="newest">{t('radar.sortNewest')}</option>
          <option value="match">{t('radar.sortBestMatch')}</option>
          <option value="salary">{t('radar.sortSalary')}</option>
        </select>
      </div>

      {filtersOpen && jobsQuery.data ? (
        <JobFilterPanel
          filters={filters}
          facets={jobsQuery.data.facets}
          resultsCount={jobs.length}
          onChange={setFilters}
          onClearAll={() => {
            setFilters(EMPTY_FILTERS);
            setSearch('');
          }}
        />
      ) : null}

      {pills.length > 0 ? (
        <div className="active-pill-row">
          {pills.map((pill) => (
            <button key={pill.key} className="active-pill" onClick={pill.onRemove}>
              {pill.label}
              <Icon name="x" size={11} />
            </button>
          ))}
        </div>
      ) : null}

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
            <Card
              key={job.id}
              className="job-card"
              onClick={() => setSelectedJobId(job.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedJobId(job.id);
                }
              }}
            >
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
                      aria-label={job.saved ? t('radar.unsave') : t('radar.save')}
                      onClick={() =>
                        updateJob.mutate({ id: job.id, patch: { saved: !job.saved } })
                      }
                    >
                      <Icon name={job.saved ? 'bookmark-filled' : 'bookmark'} size={15} />
                    </button>
                    <button
                      className="icon-button"
                      title={t('radar.hide')}
                      aria-label={t('radar.hide')}
                      onClick={() => updateJob.mutate({ id: job.id, patch: { hidden: true } })}
                    >
                      <Icon name="eye-off" size={15} />
                    </button>
                    <TrackApplicationButton jobId={job.id} />
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
