import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export function TrackerPage() {
  return (
    <>
      <PageHeader
        title="Applications"
        subtitle="Every application in one pipeline — saved, applied, interviewing, offer."
      />
      <EmptyState
        icon="kanban"
        title="Application pipeline"
        blurb="A kanban board linked to jobs from the Radar, with per-application notes, interview logs, and funnel stats to keep the search honest."
        phase={4}
      />
    </>
  );
}
