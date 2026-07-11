import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export function RoadmapPage() {
  return (
    <>
      <PageHeader
        title="Prep Roadmap"
        subtitle="A weekly study plan across DSA, system design, cloud infra, and web fundamentals."
      />
      <EmptyState
        icon="map"
        title="Your personalized study plan"
        blurb="Waypoint compares market demand against your profile (React, NestJS, PostgreSQL) and generates a prioritized weekly plan with curated free materials for each track."
        phase={3}
      />
    </>
  );
}
