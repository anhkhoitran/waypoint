import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export function ReviewPage() {
  return (
    <>
      <PageHeader
        title="Daily Review"
        subtitle="Spaced repetition for interview questions — a short queue, every day."
      />
      <EmptyState
        icon="layers"
        title="Today’s review queue"
        blurb="DSA patterns, system design prompts, and cloud concepts scheduled with SM-2 spaced repetition, so preparation becomes a small daily ritual instead of a cram."
        phase={3}
      />
    </>
  );
}
