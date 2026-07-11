import { Badge, Button, Card } from '@waypoint/ui';
import { sm2, type ReviewCardRecord, type Sm2Grade } from '@waypoint/shared';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { useGradeCard, useReviewQueue, useReviewStats } from '../api/review';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { TRACK_LABELS, TRACK_TONE } from '../lib/trackDisplay';

interface GradeOption {
  grade: Sm2Grade;
  label: string;
  key: string;
}

const GRADE_OPTIONS: GradeOption[] = [
  { grade: 0, label: 'Again', key: '1' },
  { grade: 3, label: 'Hard', key: '2' },
  { grade: 4, label: 'Good', key: '3' },
  { grade: 5, label: 'Easy', key: '4' },
];

function formatInterval(days: number): string {
  if (days < 1) return '<1d';
  if (days === 1) return '1d';
  if (days < 30) return `${days}d`;
  const months = Math.round(days / 30);
  return `${months}mo`;
}

export function ReviewPage() {
  const queueQuery = useReviewQueue(20);
  const statsQuery = useReviewStats();
  const gradeCard = useGradeCard();

  const [sessionQueue, setSessionQueue] = useState<ReviewCardRecord[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [sessionLog, setSessionLog] = useState<Array<{ trackId: string; grade: Sm2Grade }>>([]);

  // Snapshot the queue once at session start so grading (which invalidates
  // and refetches) doesn't shift cards out from under the user mid-session.
  useEffect(() => {
    if (queueQuery.data && sessionQueue === null) {
      setSessionQueue(queueQuery.data);
    }
  }, [queueQuery.data, sessionQueue]);

  const currentCard = sessionQueue?.[index] ?? null;
  const sessionDone = sessionQueue !== null && index >= sessionQueue.length;

  const previews = useMemo(() => {
    if (!currentCard) return null;
    const state = {
      easiness: currentCard.easiness,
      intervalDays: currentCard.intervalDays,
      repetitions: currentCard.repetitions,
    };
    return Object.fromEntries(GRADE_OPTIONS.map((opt) => [opt.grade, sm2(state, opt.grade)]));
  }, [currentCard]);

  useEffect(() => {
    if (!currentCard) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !revealed) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed) {
        const opt = GRADE_OPTIONS.find((o) => o.key === e.key);
        if (opt) handleGrade(opt.grade);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCard, revealed]);

  const handleGrade = (grade: Sm2Grade) => {
    if (!currentCard) return;
    gradeCard.mutate({ id: currentCard.id, grade });
    setSessionLog((log) => [...log, { trackId: currentCard.trackId, grade }]);
    setRevealed(false);
    setIndex((i) => i + 1);
  };

  const perTrackBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of sessionLog) counts.set(entry.trackId, (counts.get(entry.trackId) ?? 0) + 1);
    return [...counts.entries()];
  }, [sessionLog]);

  return (
    <>
      <PageHeader
        title="Daily Review"
        subtitle="Spaced repetition for interview questions — a short queue, every day."
      />

      {statsQuery.data ? (
        <div className="review-stats-strip">
          <div className="review-stat">
            <span className="review-stat-value">{statsQuery.data.dueToday}</span>
            <span className="review-stat-label">Due today</span>
          </div>
          <div className="review-stat">
            <span className="review-stat-value">{statsQuery.data.doneToday}</span>
            <span className="review-stat-label">Done today</span>
          </div>
          <div className="review-stat review-stat-streak">
            <span className="review-stat-value">
              <Icon name="flame" size={16} />
              {statsQuery.data.streak}
            </span>
            <span className="review-stat-label">Day streak</span>
          </div>
        </div>
      ) : null}

      {queueQuery.isLoading ? (
        <div className="skeleton-card" />
      ) : queueQuery.isError ? (
        <div className="error-state">
          <Icon name="alert" size={16} />
          Couldn’t load the review queue — is the API running on :3001?
        </div>
      ) : sessionQueue !== null && sessionQueue.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="check" size={24} />
          </span>
          <h2 className="empty-title">
            {statsQuery.data && statsQuery.data.dueToday > 0
              ? "Today's new-card limit reached"
              : "You're all caught up"}
          </h2>
          <p className="empty-blurb">
            {statsQuery.data && statsQuery.data.dueToday > 0
              ? `${statsQuery.data.dueToday} card${statsQuery.data.dueToday === 1 ? '' : 's'} still due, but the daily new-card cap (10/day) has been reached — the rest unlock tomorrow, or as in-progress cards come due on their own schedule.`
              : 'Nothing is due right now. New cards unlock as your roadmap progresses, and reviewed cards come back on their next SM-2 interval.'}
          </p>
        </div>
      ) : sessionDone ? (
        <Card className="review-session-end">
          <span className="empty-icon">
            <Icon name="flame" size={24} />
          </span>
          <h2 className="empty-title">Session complete</h2>
          <p className="empty-blurb">
            Reviewed {sessionLog.length} card{sessionLog.length === 1 ? '' : 's'} — current streak{' '}
            {statsQuery.data?.streak ?? 0} day{statsQuery.data?.streak === 1 ? '' : 's'}.
          </p>
          {perTrackBreakdown.length > 0 ? (
            <div className="review-session-breakdown">
              {perTrackBreakdown.map(([trackId, count]) => (
                <Badge key={trackId} tone={TRACK_TONE[trackId as keyof typeof TRACK_TONE]}>
                  {TRACK_LABELS[trackId as keyof typeof TRACK_LABELS]} · {count}
                </Badge>
              ))}
            </div>
          ) : null}
        </Card>
      ) : currentCard ? (
        <Card className="review-card">
          <div className="review-card-top">
            <Badge tone={TRACK_TONE[currentCard.trackId]}>{TRACK_LABELS[currentCard.trackId]}</Badge>
            <span className="review-card-progress">
              {index + 1} / {sessionQueue?.length}
            </span>
          </div>

          <div className="review-card-prompt">
            <ReactMarkdown>{currentCard.prompt}</ReactMarkdown>
          </div>

          {revealed ? (
            <>
              <div className="review-card-divider" />
              <div className="review-card-answer">
                <ReactMarkdown>{currentCard.answer}</ReactMarkdown>
              </div>
              <div className="review-grade-row">
                {GRADE_OPTIONS.map((opt) => (
                  <button
                    key={opt.grade}
                    className={`review-grade-button review-grade-${opt.label.toLowerCase()}`}
                    onClick={() => handleGrade(opt.grade)}
                  >
                    <span className="review-grade-label">{opt.label}</span>
                    <span className="review-grade-key">{opt.key}</span>
                    <span className="review-grade-interval">
                      {previews ? formatInterval(previews[opt.grade]!.dueInDays) : ''}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <Button onClick={() => setRevealed(true)} style={{ marginTop: 20 }}>
              Show answer <span className="review-space-hint">space</span>
            </Button>
          )}
        </Card>
      ) : null}
    </>
  );
}
