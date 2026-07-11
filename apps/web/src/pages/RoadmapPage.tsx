import { Badge, Button, Card } from '@waypoint/ui';
import type { Profile, ProfileInput, RoadmapItemRecord, RoadmapItemStatus } from '@waypoint/shared';
import { useMemo, useState } from 'react';
import { useProfile, useUpdateProfile } from '../api/profile';
import { useGenerateRoadmap, useRoadmap, useUpdateRoadmapItem } from '../api/roadmap';
import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { RESOURCE_KIND_ICON, TRACK_LABELS, TRACK_TONE } from '../lib/trackDisplay';

const STATUS_CYCLE: Record<RoadmapItemStatus, RoadmapItemStatus> = {
  todo: 'in_progress',
  in_progress: 'done',
  done: 'todo',
};

const STATUS_LABEL: Record<RoadmapItemStatus, string> = {
  todo: 'Not started — click to mark in progress',
  in_progress: 'In progress — click to mark done',
  done: 'Done — click to reset',
};

// r=15.915 makes the circle's circumference ~100, so stroke-dasharray can be
// expressed directly as a 0-100 percentage.
const RING_RADIUS = 15.915;

function profileInputFrom(profile: Profile): ProfileInput {
  return {
    skills: profile.skills,
    yearsOfExperience: profile.yearsOfExperience,
    targetSeniority: profile.targetSeniority,
    targetWorkModes: profile.targetWorkModes,
    locations: profile.locations,
    hoursPerWeek: profile.hoursPerWeek,
  };
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="difficulty-dots" title={`Difficulty ${level}/3`}>
      {[1, 2, 3].map((n) => (
        <span key={n} className={`difficulty-dot${n <= level ? ' filled' : ''}`} />
      ))}
    </span>
  );
}

function StatusToggle({ status, onClick }: { status: RoadmapItemStatus; onClick: () => void }) {
  return (
    <button className={`status-toggle status-${status}`} onClick={onClick} title={STATUS_LABEL[status]}>
      {status === 'done' ? <Icon name="check" size={13} /> : status === 'in_progress' ? <span className="status-dot" /> : null}
    </button>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  return (
    <span className="progress-ring">
      <svg viewBox="0 0 36 36" width="36" height="36">
        <circle className="progress-ring-track" cx="18" cy="18" r={RING_RADIUS} />
        <circle
          className="progress-ring-fill"
          cx="18"
          cy="18"
          r={RING_RADIUS}
          transform="rotate(-90 18 18)"
          strokeDasharray={`${pct}, 100`}
        />
      </svg>
      <span className="progress-ring-label">{pct}%</span>
    </span>
  );
}

export function RoadmapPage() {
  const roadmapQuery = useRoadmap();
  const profileQuery = useProfile();
  const generateRoadmap = useGenerateRoadmap();
  const updateItem = useUpdateRoadmapItem();
  const updateProfile = useUpdateProfile();
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const items = roadmapQuery.data ?? [];

  const weeks = useMemo(() => {
    const grouped = new Map<number, RoadmapItemRecord[]>();
    for (const item of items) {
      if (!grouped.has(item.weekIndex)) grouped.set(item.weekIndex, []);
      grouped.get(item.weekIndex)!.push(item);
    }
    return [...grouped.entries()].sort(([a], [b]) => a - b);
  }, [items]);

  const defaultWeek = useMemo(() => {
    const firstIncomplete = weeks.find(([, weekItems]) => weekItems.some((i) => i.status !== 'done'));
    return firstIncomplete?.[0] ?? weeks[0]?.[0] ?? 1;
  }, [weeks]);

  const activeWeek = expandedWeek ?? defaultWeek;

  const totalCount = items.length;
  const doneCount = items.filter((i) => i.status === 'done').length;
  const overallPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const adjustHours = (delta: number) => {
    if (!profileQuery.data) return;
    updateProfile.mutate({
      ...profileInputFrom(profileQuery.data),
      hoursPerWeek: Math.max(1, Math.min(80, profileQuery.data.hoursPerWeek + delta)),
    });
  };

  const handleRegenerate = () => {
    const confirmed = window.confirm(
      'Regenerate the roadmap? In-progress and done topics are kept exactly as-is — only unstarted (todo) topics are replaced.',
    );
    if (confirmed) generateRoadmap.mutate();
  };

  return (
    <>
      <PageHeader
        title="Prep Roadmap"
        subtitle="A weekly study plan across DSA, system design, cloud infra, and web fundamentals."
        actions={
          <>
            {profileQuery.data ? (
              <span className="hours-per-week-control">
                <button className="icon-button" onClick={() => adjustHours(-1)} aria-label="Decrease hours per week">
                  <Icon name="minus" size={13} />
                </button>
                <span className="hours-per-week-value">{profileQuery.data.hoursPerWeek}h/week</span>
                <button className="icon-button" onClick={() => adjustHours(1)} aria-label="Increase hours per week">
                  <Icon name="plus" size={13} />
                </button>
              </span>
            ) : null}
            {totalCount > 0 ? <ProgressRing pct={overallPct} /> : null}
            <Button variant="secondary" onClick={handleRegenerate} disabled={generateRoadmap.isPending}>
              {generateRoadmap.isPending ? 'Regenerating…' : 'Regenerate'}
            </Button>
          </>
        }
      />

      {roadmapQuery.isLoading ? (
        <div className="skeleton-card" />
      ) : roadmapQuery.isError ? (
        <div className="error-state">
          <Icon name="alert" size={16} />
          Couldn’t load the roadmap — is the API running on :3001?
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">
            <Icon name="map" size={24} />
          </span>
          <h2 className="empty-title">Generate your first roadmap</h2>
          <p className="empty-blurb">
            Waypoint compares market demand against your profile and packs a 6-week plan across all four
            tracks. Scores get sharper as more jobs are crawled — but the DSA ladder and track fundamentals
            work fine even with an empty Job Radar.
          </p>
          <Button onClick={() => generateRoadmap.mutate()} disabled={generateRoadmap.isPending}>
            {generateRoadmap.isPending ? 'Generating…' : 'Generate roadmap'}
          </Button>
        </div>
      ) : (
        <div className="roadmap-weeks">
          {weeks.map(([weekIndex, weekItems]) => {
            const weekDone = weekItems.filter((i) => i.status === 'done').length;
            const weekPct = Math.round((weekDone / weekItems.length) * 100);
            const isOpen = activeWeek === weekIndex;

            return (
              <Card key={weekIndex} className="roadmap-week-card">
                <button
                  className="roadmap-week-header"
                  onClick={() => setExpandedWeek(isOpen ? null : weekIndex)}
                  aria-expanded={isOpen}
                >
                  <span className="roadmap-week-title">
                    <Icon name="chevron-down" size={16} />
                    Week {weekIndex}
                  </span>
                  <span className="roadmap-week-progress">
                    <span className="week-progress-bar">
                      <span className="week-progress-fill" style={{ width: `${weekPct}%` }} />
                    </span>
                    <span className="week-progress-label">
                      {weekDone}/{weekItems.length}
                    </span>
                  </span>
                </button>

                {isOpen ? (
                  <div className="roadmap-topic-list">
                    {weekItems.map((item) => (
                      <div key={item.id} className="roadmap-topic-card">
                        <div className="roadmap-topic-header">
                          <StatusToggle
                            status={item.status}
                            onClick={() => updateItem.mutate({ id: item.id, status: STATUS_CYCLE[item.status] })}
                          />
                          <div className="roadmap-topic-title-block">
                            <div className="roadmap-topic-title-row">
                              <Badge tone={TRACK_TONE[item.topic.trackId]}>{TRACK_LABELS[item.topic.trackId]}</Badge>
                              <DifficultyDots level={item.topic.difficulty} />
                              <span className="roadmap-topic-name">{item.topic.name}</span>
                            </div>
                            <p className="roadmap-topic-reason">{item.reason}</p>
                          </div>
                        </div>
                        <div className="roadmap-resource-list">
                          {item.topic.resources.map((r) => (
                            <a
                              key={r.id}
                              className="roadmap-resource-row"
                              href={r.url}
                              target="_blank"
                              rel="noreferrer noopener"
                            >
                              <Icon name={RESOURCE_KIND_ICON[r.kind]} size={15} />
                              <span className="roadmap-resource-title">{r.title}</span>
                              {r.note ? <span className="roadmap-resource-note">{r.note}</span> : null}
                              <span className="roadmap-resource-time">{r.estMinutes}m</span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
