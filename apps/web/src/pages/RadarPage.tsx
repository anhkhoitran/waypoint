import { Badge, Button, Card } from '@waypoint/ui';
import type { BadgeTone } from '@waypoint/ui';
import type { NormalizedJob } from '@waypoint/shared';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { sampleJobs, sourceLabels, timeAgo } from '../sample-jobs';

const filters = ['All sources', 'Remote', 'Vietnam', 'Senior', 'Saved'];

const workModeTone: Record<NormalizedJob['workMode'], BadgeTone> = {
  remote: 'success',
  hybrid: 'info',
  onsite: 'warning',
  unknown: 'neutral',
};

export function RadarPage() {
  return (
    <>
      <PageHeader
        title="Job Radar"
        subtitle="Fresh roles from every source you track — deduplicated, normalized, scored."
        actions={
          <>
            <Button variant="secondary">Manage sources</Button>
            <Button title="The crawler engine ships in Phase 1">Run crawl</Button>
          </>
        }
      />

      <div className="preview-banner">
        <Icon name="sparkle" size={15} />
        Design preview with sample data — the crawler engine lands in Phase 1.
      </div>

      <div className="filter-row">
        {filters.map((f, i) => (
          <button key={f} className={`filter-chip${i === 0 ? ' active' : ''}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="job-list">
        {sampleJobs.map((job) => (
          <Card key={job.dedupKey} className="job-card">
            <div className="job-card-top">
              <span className="job-title">{job.title}</span>
              {job.salaryText ? <span className="job-salary">{job.salaryText}</span> : null}
            </div>
            <div className="job-meta">
              {job.company}
              <span aria-hidden="true">·</span>
              {job.location ?? 'Location unknown'}
            </div>
            <div className="job-badges">
              <Badge tone="accent">{sourceLabels[job.source]}</Badge>
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
    </>
  );
}
