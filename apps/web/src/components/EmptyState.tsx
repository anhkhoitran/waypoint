import { Badge } from '@waypoint/ui';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from './Icon';

export function EmptyState({
  icon,
  title,
  blurb,
  phase,
}: {
  icon: IconName;
  title: string;
  blurb: string;
  phase: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="empty-title">{title}</h2>
      <p className="empty-blurb">{blurb}</p>
      <Badge tone="accent">{t('emptyState.arrivesInPhase', { phase })}</Badge>
    </div>
  );
}
