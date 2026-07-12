import { Button } from '@waypoint/ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateApplication } from '../api/applications';
import { Icon } from './Icon';

/**
 * Idempotent "track this job" action — the backend returns the existing
 * application if this job is already tracked, so repeated clicks are always
 * safe. `tracked` is local/ephemeral (resets on reload) since the job list
 * doesn't currently expose whether an application already exists per job.
 */
export function TrackApplicationButton({
  jobId,
  size = 15,
  variant = 'icon',
}: {
  jobId: string;
  size?: number;
  variant?: 'icon' | 'button';
}) {
  const { t } = useTranslation();
  const createApplication = useCreateApplication();
  const [tracked, setTracked] = useState(false);

  const handleClick = () => {
    createApplication.mutate({ jobId }, { onSuccess: () => setTracked(true) });
  };

  if (variant === 'button') {
    return (
      <Button variant="secondary" onClick={handleClick} disabled={createApplication.isPending}>
        <Icon name={tracked ? 'check' : 'kanban'} size={size} />
        {tracked ? t('common.tracked') : t('common.trackApplication')}
      </Button>
    );
  }

  return (
    <button
      className={`icon-button${tracked ? ' active' : ''}`}
      title={tracked ? t('common.tracked') : t('common.trackApplication')}
      aria-label={tracked ? t('common.tracked') : t('common.trackApplication')}
      onClick={(e) => {
        e.stopPropagation();
        handleClick();
      }}
      disabled={createApplication.isPending}
    >
      <Icon name={tracked ? 'check' : 'kanban'} size={size} />
    </button>
  );
}
