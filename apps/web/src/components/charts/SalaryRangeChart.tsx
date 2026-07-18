import type { SalaryBySeniorityItem } from '@waypoint/shared';
import { useTranslation } from 'react-i18next';

// Matches the design mock's fixed $0–$240k axis for the range bars.
const SCALE_MAX = 240_000;

function leftPct(value: number): number {
  return Math.min(100, (value / SCALE_MAX) * 100);
}

function formatK(value: number): string {
  return `$${Math.round(value / 1000)}k`;
}

// Recharts has no clean floating-bar primitive, so this is hand-rolled —
// a min→max span with a median tick, one row per seniority.
export function SalaryRangeChart({ data }: { data: SalaryBySeniorityItem[] }) {
  const { t } = useTranslation();

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {data.map((row) => (
          <div
            key={row.seniority}
            style={{ display: 'grid', gridTemplateColumns: '56px 1fr', alignItems: 'center', gap: 12 }}
          >
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {t(`seniority.${row.seniority}`)}
            </span>
            <div style={{ position: 'relative', height: 22 }}>
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  bottom: 8,
                  left: 0,
                  right: 0,
                  borderRadius: 999,
                  background: 'var(--surface-sunken)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 8,
                  bottom: 8,
                  left: `${leftPct(row.min)}%`,
                  width: `${Math.max(0, leftPct(row.max) - leftPct(row.min))}%`,
                  borderRadius: 999,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent)',
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 3,
                  bottom: 3,
                  left: `${leftPct(row.median)}%`,
                  width: 3,
                  borderRadius: 2,
                  background: 'var(--accent-strong)',
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  left: `${leftPct(row.median)}%`,
                  fontSize: 10.5,
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  transform: 'translateX(-50%)',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatK(row.median)}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 10,
          paddingLeft: 68,
          fontSize: 10.5,
          color: 'var(--text-muted)',
        }}
      >
        <span>$0</span>
        <span>$120k</span>
        <span>$240k</span>
      </div>
    </div>
  );
}
