import type { SkillTrendResponse } from '@waypoint/shared';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

// Fixed order, validated (chroma + lightness + CVD) via dataviz's
// validate_palette.js for both themes — see packages/ui/src/tokens.css.
const SERIES_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'];

export function SkillTrendChart({ trend }: { trend: SkillTrendResponse }) {
  const skillNames = Object.keys(trend.series);
  const data = trend.buckets.map((bucket, i) => {
    const row: Record<string, string | number> = { bucket };
    for (const name of skillNames) row[name] = trend.series[name]?.[i] ?? 0;
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ left: 4, right: 16, top: 8, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="bucket"
          stroke="var(--text-muted)"
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
        />
        <YAxis
          stroke="var(--text-muted)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip
          content={({ active, payload, label }) => {
            if (!active || !payload?.length) return null;
            return (
              <ChartTooltip
                title={String(label)}
                rows={payload.map((p) => ({
                  label: String(p.dataKey),
                  value: p.value as number,
                  color: p.color,
                }))}
              />
            );
          }}
        />
        {skillNames.length > 1 ? <Legend wrapperStyle={{ fontSize: 12 }} /> : null}
        {skillNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }}
            activeDot={{ r: 5 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
