import { Badge, Button, Drawer } from '@waypoint/ui';
import type { ApplicationEventKind, InterviewKind } from '@waypoint/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useAddApplicationEvent, useApplication, useUpdateApplication } from '../api/applications';
import { STAGE_TONE } from '../lib/applicationDisplay';
import { scoreTone } from '../lib/jobTone';
import { timeAgo } from '../lib/time';
import { Icon } from './Icon';

const INTERVIEW_KINDS: InterviewKind[] = ['phone', 'technical', 'system_design', 'behavioral', 'final'];

export function ApplicationDrawer({ applicationId, onClose }: { applicationId: string | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: application } = useApplication(applicationId);
  const updateApplication = useUpdateApplication();
  const addEvent = useAddApplicationEvent();

  const [nextActionDate, setNextActionDate] = useState('');
  const [nextActionNote, setNextActionNote] = useState('');
  const [eventKind, setEventKind] = useState<ApplicationEventKind>('note');
  const [interviewKind, setInterviewKind] = useState<InterviewKind>('phone');
  const [eventBody, setEventBody] = useState('');

  useEffect(() => {
    if (application) {
      setNextActionDate(application.nextActionAt ? new Date(application.nextActionAt).toISOString().slice(0, 10) : '');
      setNextActionNote(application.nextActionNote ?? '');
    }
  }, [application?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!applicationId) {
      setEventBody('');
      setEventKind('note');
    }
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applicationId, onClose]);

  if (!application) return <Drawer open={applicationId !== null} onClose={onClose}><span /></Drawer>;

  const saveNextAction = () => {
    if (!application) return;
    updateApplication.mutate({
      id: application.id,
      input: {
        nextActionAt: nextActionDate ? new Date(nextActionDate) : null,
        nextActionNote: nextActionNote || null,
      },
    });
  };

  const submitEvent = () => {
    if (!application || !eventBody.trim()) return;
    addEvent.mutate(
      {
        id: application.id,
        input: { kind: eventKind as 'note' | 'interview', body: eventBody, interviewKind: eventKind === 'interview' ? interviewKind : undefined },
      },
      { onSuccess: () => setEventBody('') },
    );
  };

  return (
    <Drawer open={applicationId !== null} onClose={onClose}>
      <div className="application-drawer">
        <div className="application-drawer-header">
          <div>
            <h2 className="application-drawer-title">{application.title}</h2>
            <div className="job-meta">{application.company}</div>
          </div>
          <button className="icon-button" title={t('tracker.drawer.close')} onClick={onClose}>
            <Icon name="x" size={16} />
          </button>
        </div>

        <div className="job-badges">
          <Badge tone={STAGE_TONE[application.stage]}>{t(`tracker.stage.${application.stage}`)}</Badge>
          {application.matchScore ? (
            <Badge tone={scoreTone(application.matchScore.score)}>
              {t('radar.matchPill', { score: application.matchScore.score })}
            </Badge>
          ) : null}
        </div>

        <a className="job-drawer-original-link" href={application.url} target="_blank" rel="noreferrer noopener">
          {application.url} <Icon name="external-link" size={13} />
        </a>

        <div className="job-drawer-section">
          <h3 className="profile-section-title">{t('tracker.drawer.nextActionTitle')}</h3>
          <div className="application-next-action-form">
            <input
              className="profile-text-input"
              type="date"
              value={nextActionDate}
              onChange={(e) => setNextActionDate(e.target.value)}
              aria-label={t('tracker.drawer.nextActionDate')}
            />
            <input
              className="profile-text-input"
              type="text"
              value={nextActionNote}
              onChange={(e) => setNextActionNote(e.target.value)}
              placeholder={t('tracker.drawer.nextActionPlaceholder')}
              aria-label={t('tracker.drawer.nextActionNote')}
            />
            <Button variant="secondary" onClick={saveNextAction} disabled={updateApplication.isPending}>
              {t('tracker.drawer.nextActionSave')}
            </Button>
          </div>
        </div>

        <div className="job-drawer-section">
          <h3 className="profile-section-title">{t('tracker.drawer.timelineTitle')}</h3>
          <div className="application-event-form">
            <div className="application-event-kind-toggle">
              <button
                className={`filter-chip${eventKind === 'note' ? ' active' : ''}`}
                onClick={() => setEventKind('note')}
              >
                {t('tracker.drawer.addNote')}
              </button>
              <button
                className={`filter-chip${eventKind === 'interview' ? ' active' : ''}`}
                onClick={() => setEventKind('interview')}
              >
                {t('tracker.drawer.addInterview')}
              </button>
            </div>
            {eventKind === 'interview' ? (
              <select
                className="sort-select"
                value={interviewKind}
                onChange={(e) => setInterviewKind(e.target.value as InterviewKind)}
                aria-label={t('tracker.drawer.interviewKindLabel')}
              >
                {INTERVIEW_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(`tracker.interviewKind.${k}`)}
                  </option>
                ))}
              </select>
            ) : null}
            <textarea
              className="application-event-textarea"
              value={eventBody}
              onChange={(e) => setEventBody(e.target.value)}
              placeholder={t('tracker.drawer.notePlaceholder')}
              rows={3}
            />
            <Button onClick={submitEvent} disabled={addEvent.isPending || !eventBody.trim()}>
              {t('tracker.drawer.submitEvent')}
            </Button>
          </div>

          <div className="application-timeline">
            {application.events && application.events.length > 0 ? (
              application.events.map((event) => (
                <div key={event.id} className="application-timeline-item">
                  <div className="application-timeline-meta">
                    <Badge tone={event.kind === 'interview' ? 'accent' : 'neutral'}>
                      {t(`tracker.eventKind.${event.kind}`)}
                      {event.interviewKind ? ` · ${t(`tracker.interviewKind.${event.interviewKind}`)}` : ''}
                    </Badge>
                    <span className="application-timeline-time">{timeAgo(event.occurredAt)}</span>
                  </div>
                  <div className="application-timeline-body">
                    <ReactMarkdown>{event.body}</ReactMarkdown>
                  </div>
                </div>
              ))
            ) : (
              <p className="profile-section-hint">{t('tracker.drawer.noEvents')}</p>
            )}
          </div>
        </div>
      </div>
    </Drawer>
  );
}
