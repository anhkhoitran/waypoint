import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Badge } from '@waypoint/ui';
import type { ApplicationRecord } from '@waypoint/shared';
import { useTranslation } from 'react-i18next';
import { scoreTone } from '../lib/jobTone';
import { Icon } from './Icon';

export function ApplicationCard({
  application,
  onClick,
}: {
  application: ApplicationRecord;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: application.id,
  });

  const isOverdue = application.nextActionAt ? new Date(application.nextActionAt) < new Date() : false;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="application-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="application-card-title">{application.title}</div>
      <div className="application-card-company">{application.company}</div>
      <div className="application-card-meta-row">
        {application.matchScore ? (
          <Badge tone={scoreTone(application.matchScore.score)}>{application.matchScore.score}%</Badge>
        ) : null}
        <span className="application-card-days">{t('tracker.daysInStage', { count: application.daysInStage })}</span>
      </div>
      {application.nextActionAt ? (
        <div className={`application-next-action-chip${isOverdue ? ' overdue' : ''}`}>
          <Icon name="clock" size={12} />
          {t('tracker.nextAction', {
            date: new Date(application.nextActionAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            }),
          })}
        </div>
      ) : null}
    </div>
  );
}
