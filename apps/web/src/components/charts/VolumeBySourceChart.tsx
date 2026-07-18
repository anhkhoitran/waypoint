import { SOURCE_LABELS, type JobSource, type VolumeBySourceResponse } from '@waypoint/shared';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)'];

export function VolumeBySourceChart({ data }: { data: VolumeBySourceResponse }) {
  const sources = Object.keys(data.series) as JobSource[];
  const rows = data.buckets.map((bucket, i) => {
    const row: Record<string, string | number> = { bucket };
    for (const source of sources) row[source] = data.series[source]?.[i] ?? 0;
    return row;
  });

  return (
    <div>
      <ResponsiveContainer width="100%" height={170}>
        <BarChart data={rows} margin={{ left: 4, right: 8, top: 4, bottom: 4 }}>
          <XAxis
            dataKey="bucket"
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            stroke="var(--text-muted)"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: 'var(--surface-sunken)' }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <ChartTooltip
                  title={String(label)}
                  rows={payload.map((p) => ({
                    label: SOURCE_LABELS[p.dataKey as JobSource] ?? String(p.dataKey),
                    value: p.value as number,
                    color: p.color,
                  }))}
                />
              );
            }}
          />
          {sources.map((source, i) => (
            <Bar
              key={source}
              dataKey={source}
              stackId="volume"
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              radius={i === sources.length - 1 ? [2, 2, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
        {sources.map((source, i) => (
          <span
            key={source}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--text-secondary)' }}
          >
            <span
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                background: SERIES_COLORS[i % SERIES_COLORS.length],
              }}
            />
            {SOURCE_LABELS[source] ?? source}
          </span>
        ))}
      </div>
    </div>
  );
}
