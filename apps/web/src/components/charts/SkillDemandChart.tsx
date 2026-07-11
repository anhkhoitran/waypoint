import type { SkillDemandItem } from '@waypoint/shared';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

/**
 * Horizontal bar chart, "emphasis" color pattern (not full categorical):
 * profile-owned skills get the solid accent fill, gaps get a neutral fill
 * with an accent outline — an at-a-glance two-state read, not per-skill
 * identity, so it doesn't need the 8-hue categorical treatment.
 */
export function SkillDemandChart({
  data,
  profileSkills,
}: {
  data: SkillDemandItem[];
  profileSkills: Set<string>;
}) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(240, data.length * 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
        <XAxis
          type="number"
          dataKey="share"
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          stroke="var(--text-muted)"
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: 'var(--border)' }}
        />
        <YAxis
          type="category"
          dataKey="skill"
          width={112}
          stroke="var(--text-secondary)"
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: 'var(--surface-sunken)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const item = payload[0]!.payload as SkillDemandItem;
            return (
              <ChartTooltip
                title={item.skill}
                rows={[
                  { label: 'Jobs mentioning it', value: item.jobCount },
                  { label: 'Share of window', value: `${Math.round(item.share * 100)}%` },
                  { label: 'In your profile', value: profileSkills.has(item.skill) ? 'Yes' : 'No' },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="share" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((d) => (
            <Cell
              key={d.skill}
              fill={profileSkills.has(d.skill) ? 'var(--chart-1)' : 'var(--surface-sunken)'}
              stroke="var(--chart-1)"
              strokeWidth={profileSkills.has(d.skill) ? 0 : 1.5}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
