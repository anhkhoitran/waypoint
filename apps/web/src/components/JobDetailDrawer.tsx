import { Badge, Button, Drawer } from '@waypoint/ui';
import type { JobRecord } from '@waypoint/shared';
import { SOURCE_LABELS } from '@waypoint/shared';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useUpdateJob } from '../api/jobs';
import { splitDescriptionSections } from '../lib/jobDescription';
import { scoreTone, workModeTone } from '../lib/jobTone';
import { timeAgo } from '../lib/time';
import { Icon } from './Icon';
import { TrackApplicationButton } from './TrackApplicationButton';

export function JobDetailDrawer({
  job,
  onClose,
}: {
  job: JobRecord | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const updateJob = useUpdateJob();
  const description = job ? splitDescriptionSections(job.descriptionText) : null;
  const aiSummary = job?.summary ?? null;

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
                {job.location ?? t('radar.locationUnknown')}
              </div>
            </div>
            <button
              className="icon-button"
              title={t('jobDrawer.close')}
              aria-label={t('jobDrawer.close')}
              onClick={onClose}
            >
              <Icon name="x" size={16} />
            </button>
          </div>

          <div className="job-badges">
            <Badge tone="accent">{SOURCE_LABELS[job.source]}</Badge>
            <Badge tone={workModeTone[job.workMode]}>{t(`workMode.${job.workMode}`)}</Badge>
            {job.seniority !== 'unknown' ? <Badge>{t(`seniority.${job.seniority}`)}</Badge> : null}
            {job.matchScore ? (
              <Badge tone={scoreTone(job.matchScore.score)}>
                {t('radar.matchPill', { score: job.matchScore.score })}
              </Badge>
            ) : null}
          </div>

          <div className="job-drawer-facts-grid">
            <div className="job-drawer-fact">
              <div className="job-drawer-fact-label">{t('jobDrawer.salaryFact')}</div>
              <div className={`job-drawer-fact-value${job.salaryText ? ' has-value' : ''}`}>
                {job.salaryText ?? t('jobDrawer.notListed')}
              </div>
            </div>
            <div className="job-drawer-fact">
              <div className="job-drawer-fact-label">{t('jobDrawer.workModeFact')}</div>
              <div className="job-drawer-fact-value">{t(`workMode.${job.workMode}`)}</div>
            </div>
            <div className="job-drawer-fact">
              <div className="job-drawer-fact-label">{t('jobDrawer.postedFact')}</div>
              <div className="job-drawer-fact-value">{timeAgo(job.postedAt)}</div>
            </div>
            <div className="job-drawer-fact">
              <div className="job-drawer-fact-label">{t('jobDrawer.sourceFact')}</div>
              <div className="job-drawer-fact-value">{SOURCE_LABELS[job.source]}</div>
            </div>
          </div>

          {job.matchScore ? (
            <div className="job-drawer-match">
              <div className="job-drawer-match-header">
                <span className="job-drawer-match-label">{t('jobDrawer.matchScoreLabel')}</span>
                <span className="job-drawer-match-score">{job.matchScore.score}%</span>
              </div>
              <div className="job-drawer-match-bar-track">
                <div
                  className="job-drawer-match-bar-fill"
                  data-tone={scoreTone(job.matchScore.score)}
                  style={{ width: `${job.matchScore.score}%` }}
                />
              </div>
              {job.matchScore.matched.length > 0 ? (
                <div className="job-drawer-skills">
                  <span className="job-drawer-skills-label">{t('jobDrawer.youHave')}</span>
                  {job.matchScore.matched.map((skill) => (
                    <span key={skill} className="tag tag-match">
                      {skill}
                    </span>
                  ))}
                </div>
              ) : null}
              {job.matchScore.missing.length > 0 ? (
                <div className="job-drawer-skills">
                  <span className="job-drawer-skills-label">{t('jobDrawer.gap')}</span>
                  {job.matchScore.missing.map((skill) => (
                    <span key={skill} className="tag tag-gap">
                      {skill}
                    </span>
                  ))}
                  <button
                    className="job-drawer-add-gap"
                    onClick={() => {
                      onClose();
                      navigate('/roadmap');
                    }}
                  >
                    {t('jobDrawer.addGapToRoadmap')}
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="job-drawer-section">
            <div className="job-drawer-section-label-row">
              <div className="job-drawer-section-label">{t('jobDrawer.aboutRole')}</div>
              {aiSummary ? (
                <span className="job-drawer-ai-badge" title={aiSummary.model}>
                  {t('jobDrawer.aiSummaryLabel', { model: aiSummary.model })}
                </span>
              ) : null}
            </div>
            <p className="job-drawer-description">
              {aiSummary ? aiSummary.summary : (description?.intro ?? job.descriptionText)}
            </p>
          </div>

          {aiSummary ? (
            <>
              {aiSummary.responsibilities.length > 0 ? (
                <div className="job-drawer-section">
                  <div className="job-drawer-section-label">{t('jobDrawer.responsibilities')}</div>
                  <ul className="job-drawer-section-list">
                    {aiSummary.responsibilities.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aiSummary.requirements.length > 0 ? (
                <div className="job-drawer-section">
                  <div className="job-drawer-section-label">{t('jobDrawer.requirements')}</div>
                  <ul className="job-drawer-section-list">
                    {aiSummary.requirements.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aiSummary.niceToHave.length > 0 ? (
                <div className="job-drawer-section">
                  <div className="job-drawer-section-label">{t('jobDrawer.niceToHave')}</div>
                  <ul className="job-drawer-section-list">
                    {aiSummary.niceToHave.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {aiSummary.benefits.length > 0 ? (
                <div className="job-drawer-section">
                  <div className="job-drawer-section-label">{t('jobDrawer.benefits')}</div>
                  <ul className="job-drawer-section-list">
                    {aiSummary.benefits.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : description ? (
            description.sections.map((section) => (
              <div key={section.heading} className="job-drawer-section">
                <div className="job-drawer-section-label">{section.heading}</div>
                <ul className="job-drawer-section-list">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            ))
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

          <div className="job-drawer-footer">
            <Button
              variant="secondary"
              onClick={() => updateJob.mutate({ id: job.id, patch: { saved: !job.saved } })}
            >
              <Icon name={job.saved ? 'bookmark-filled' : 'bookmark'} size={15} />
              {job.saved ? t('jobDrawer.saved') : t('jobDrawer.save')}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                updateJob.mutate({ id: job.id, patch: { hidden: true } });
                onClose();
              }}
            >
              <Icon name="eye-off" size={15} />
              {t('jobDrawer.hide')}
            </Button>
            <TrackApplicationButton jobId={job.id} variant="button" />
            <a
              className="job-drawer-original-link"
              href={job.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {t('jobDrawer.viewOriginal')} <Icon name="external-link" size={14} />
            </a>
          </div>
        </div>
      ) : null}
    </Drawer>
  );
}
