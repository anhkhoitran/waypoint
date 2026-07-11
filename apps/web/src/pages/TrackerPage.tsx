import { useTranslation } from 'react-i18next';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export function TrackerPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader title={t('tracker.title')} subtitle={t('tracker.subtitle')} />
      <EmptyState
        icon="kanban"
        title={t('tracker.emptyTitle')}
        blurb={t('tracker.emptyBlurb')}
        phase={4}
      />
    </>
  );
}
