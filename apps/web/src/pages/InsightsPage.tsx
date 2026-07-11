import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export function InsightsPage() {
  return (
    <>
      <PageHeader
        title="Market Insights"
        subtitle="What the market actually demands, extracted from every job description we crawl."
      />
      <EmptyState
        icon="chart"
        title="Skill demand analytics"
        blurb="Once the crawler is feeding data, this page charts skill demand across sources — e.g. how many mid-level JDs mention AWS, Docker, or Kafka — and how your profile matches each role."
        phase={2}
      />
    </>
  );
}
