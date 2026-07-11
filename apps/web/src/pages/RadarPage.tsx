import { Badge, Button, Card } from '@waypoint/ui';
import type { BadgeTone } from '@waypoint/ui';
import type { JobQuery, JobRecord, WorkMode } from '@waypoint/shared';
import { SOURCE_LABELS } from '@waypoint/shared';
import { useState } from 'react';
import { useJobs, useRunCrawl, useUpdateJob } from '../api/jobs';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { SourceHealthPanel } from '../components/SourceHealthPanel';
import { timeAgo } from '../lib/time';

type FilterKey = 'all' | 'remote' | 'vietnam' | 'senior' | 'saved';

// "Vietnam" maps to itviec specifically — it's the only Vietnam-focused
// source with a working adapter today (topdev/vietnamworks are seeded but
// not yet crawled; see docs/plans/phase-1-crawler-and-job-feed.md).
const filterChips: Array<{ key: FilterKey; label: string; query: Partial<JobQuery> }> = [
  { key: 'all', label: 'All sources', query: {} },
  { key: 'remote', label: 'Remote', query: { workMode: 'remote' } },
  { key: 'vietnam', label: 'Vietnam', query: { source: 'itviec' } },
  { key: 'senior', label: 'Senior', query: { seniority: 'senior' } },
  { key: 'saved', label: 'Saved', query: { saved: true } },
];

const workModeTone: Record<WorkMode, BadgeTone> = {
  remote: 'success',
  hybrid: 'info',
  onsite: 'warning',
  unknown: 'neutral',
};

export function RadarPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const activeQuery = filterChips.find((f) => f.key === activeFilter)!.query;
  const query: JobQuery = { ...activeQuery, q: search.trim() || undefined, limit: 20 };

  const jobsQuery = useJobs(query);
  const updateJob = useUpdateJob();
  const runCrawl = useRunCrawl();

  const jobs = jobsQuery.data?.items ?? [];
  const isFiltered = activeFilter !== 'all' || search.trim().length > 0;

  return (
    <>
      <PageHeader
        title="Job Radar"
        subtitle="Fresh roles from every source you track — deduplicated, normalized, scored."
        actions={
          <>
            <Button variant="secondary" disabled title="Source management arrives in a later phase">
              Manage sources
            </Button>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {runCrawl.isPending ? (
                <span className="inline-status">
                  <span className="spin" style={{ display: 'inline-flex' }}>
                    <Icon name="spinner" size={13} />
                  </span>
                  Enqueuing…
                </span>
              ) : runCrawl.isSuccess && runCrawl.data ? (
                <span className="inline-status">
                  Started: {runCrawl.data.enqueued.map((s) => SOURCE_LABELS[s]).join(', ')}
                </span>
              ) : null}
              <Button onClick={() => runCrawl.mutate(undefined)} disabled={runCrawl.isPending}>
                Run crawl
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
            placeholder="Search title or company…"
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
              {chip.label}
            </button>
          ))}
        </div>
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
          Couldn’t load jobs — is the API running on :3001?
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="inbox" size={24} />
          </span>
          <h2 className="empty-title">
            {isFiltered ? 'No jobs match these filters' : 'No jobs yet'}
          </h2>
          <p className="empty-blurb">
            {isFiltered
              ? 'Try a different source, clear the search, or run a fresh crawl.'
              : 'Run your first crawl to pull jobs from RemoteOK, WeWorkRemotely, HN Who’s Hiring, and ITviec.'}
          </p>
          {!isFiltered && (
            <Button onClick={() => runCrawl.mutate(undefined)} disabled={runCrawl.isPending}>
              Run crawl
            </Button>
          )}
        </div>
      ) : (
        <div className="job-list">
          {jobs.map((job: JobRecord) => (
            <Card key={job.id} className="job-card">
              <div className="job-card-top">
                <span className="job-title">{job.title}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {job.salaryText ? <span className="job-salary">{job.salaryText}</span> : null}
                  <div className="job-actions-row">
                    <button
                      className={`icon-button${job.saved ? ' active' : ''}`}
                      title={job.saved ? 'Unsave' : 'Save'}
                      onClick={() =>
                        updateJob.mutate({ id: job.id, patch: { saved: !job.saved } })
                      }
                    >
                      <Icon name={job.saved ? 'bookmark-filled' : 'bookmark'} size={15} />
                    </button>
                    <button
                      className="icon-button"
                      title="Hide this job"
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
                {job.location ?? 'Location unknown'}
              </div>
              <div className="job-badges">
                <Badge tone="accent">{SOURCE_LABELS[job.source]}</Badge>
                <Badge tone={workModeTone[job.workMode]}>{job.workMode}</Badge>
                {job.seniority !== 'unknown' ? <Badge>{job.seniority}</Badge> : null}
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
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
