import { SOURCE_LABELS, type CrawlRunRecord, type JobSource } from '@waypoint/shared';
import { useTranslation } from 'react-i18next';
import { useCrawlRuns } from '../api/jobs';
import { timeAgo } from '../lib/time';

// Sources with a real adapter today (topdev/vietnamworks are seeded but not yet crawled).
const REGISTERED_SOURCES: JobSource[] = ['remoteok', 'weworkremotely', 'hn_whos_hiring', 'itviec'];

const statusDotClass: Record<CrawlRunRecord['status'], string> = {
  success: 'status-dot-success',
  partial: 'status-dot-warning',
  failed: 'status-dot-danger',
};

export function SourceHealthPanel() {
  const { t } = useTranslation();
  const { data: runs } = useCrawlRuns();
  const runBySource = new Map((runs ?? []).map((run) => [run.sourceId, run]));

  return (
    <div className="source-health">
      {REGISTERED_SOURCES.map((source) => {
        const run = runBySource.get(source);
        return (
          <div key={source} className="source-health-item">
            <span
              className={`status-dot ${run ? statusDotClass[run.status] : 'status-dot-neutral'}`}
              aria-hidden="true"
            />
            <span className="source-health-name">{SOURCE_LABELS[source]}</span>
            <span className="source-health-meta">
              {run
                ? t('sourceHealth.newAndTime', { count: run.jobsNew, time: timeAgo(run.finishedAt) })
                : t('sourceHealth.neverRun')}
            </span>
          </div>
        );
      })}
    </div>
  );
}
