import { Badge } from '@waypoint/ui';
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
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={24} />
      </span>
      <h2 className="empty-title">{title}</h2>
      <p className="empty-blurb">{blurb}</p>
      <Badge tone="accent">Arrives in Phase {phase}</Badge>
    </div>
  );
}
