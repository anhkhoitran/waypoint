import { Badge, Button, Drawer } from '@waypoint/ui';
import type { JobRecord } from '@waypoint/shared';
import { SOURCE_LABELS } from '@waypoint/shared';
import { useUpdateJob } from '../api/jobs';
import { scoreTone, workModeTone } from '../lib/jobTone';
import { timeAgo } from '../lib/time';
import { Icon } from './Icon';

export function JobDetailDrawer({
  job,
  onClose,
}: {
  job: JobRecord | null;
  onClose: () => void;
}) {
  const updateJob = useUpdateJob();

  return (
    <Drawer open={job !== null} onClose={onClose}>
      {job ? (
        <div className="job-drawer">
          <div className="job-drawer-header">
            <div>
              <h2 className="job-drawer-title">{job.title}</h2>
              <div className="job-meta">
                {job.company}
                <span aria-hidden="true">·</span>
                {job.location ?? 'Location unknown'}
              </div>
            </div>
            <button className="icon-button" title="Close" onClick={onClose}>
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="job-badges">
            <Badge tone="accent">{SOURCE_LABELS[job.source]}</Badge>
            <Badge tone={workModeTone[job.workMode]}>{job.workMode}</Badge>
            {job.seniority !== 'unknown' ? <Badge>{job.seniority}</Badge> : null}
            {job.matchScore ? (
              <Badge tone={scoreTone(job.matchScore.score)}>{job.matchScore.score}% match</Badge>
            ) : null}
          </div>

          <div className="job-drawer-facts">
            {job.salaryText ? <span className="job-salary">{job.salaryText}</span> : null}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Icon name="clock" size={13} />
              {timeAgo(job.postedAt)}
            </span>
          </div>

          {job.matchScore && (job.matchScore.matched.length > 0 || job.matchScore.missing.length > 0) ? (
            <div className="job-drawer-section">
              {job.matchScore.matched.length > 0 ? (
                <div className="job-drawer-skills">
                  <span className="job-drawer-skills-label">You have</span>
                  {job.matchScore.matched.map((skill) => (
                    <span key={skill} className="tag tag-match">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
              {job.matchScore.missing.length > 0 ? (
                <div className="job-drawer-skills">
                  <span className="job-drawer-skills-label">Gap</span>
                  {job.matchScore.missing.map((skill) => (
                    <span key={skill} className="tag tag-gap">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {job.tags.length > 0 ? (
            <div className="tag-row job-drawer-section">
              {job.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          <div className="job-drawer-description">{job.descriptionText}</div>

          <div className="job-drawer-footer">
            <Button
              variant="secondary"
              onClick={() => updateJob.mutate({ id: job.id, patch: { saved: !job.saved } })}
            >
              <Icon name={job.saved ? 'bookmark-filled' : 'bookmark'} size={15} />
              {job.saved ? 'Saved' : 'Save'}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                updateJob.mutate({ id: job.id, patch: { hidden: true } });
                onClose();
              }}
            >
              <Icon name="eye-off" size={15} />
              Hide
            </Button>
            <a
              className="job-drawer-original-link"
              href={job.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              View original <Icon name="external-link" size={14} />
            </a>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
