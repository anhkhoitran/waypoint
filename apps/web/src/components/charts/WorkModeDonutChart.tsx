import type { WorkModeSplitItem } from '@waypoint/shared';
import { useTranslation } from 'react-i18next';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { ChartTooltip } from './ChartTooltip';

// Matches the design mock's donut coloring, not a generic categorical cycle.
const WORK_MODE_COLOR: Record<string, string> = {
  remote: 'var(--chart-3)',
  onsite: 'var(--chart-1)',
  hybrid: 'var(--chart-2)',
  unknown: 'var(--chart-4)',
};

export function WorkModeDonutChart({ data }: { data: WorkModeSplitItem[] }) {
  const { t } = useTranslation();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
      <div style={{ width: 150, height: 150, flexShrink: 0, position: 'relative' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="workMode"
              cx="50%"
              cy="50%"
              innerRadius={48}
              outerRadius={64}
              paddingAngle={1}
              stroke="none"
            >
              {data.map((d) => (
                <Cell key={d.workMode} fill={WORK_MODE_COLOR[d.workMode] ?? 'var(--chart-4)'} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const item = payload[0]!.payload as WorkModeSplitItem;
                const share = total > 0 ? Math.round((item.count / total) * 100) : 0;
                return (
                  <ChartTooltip
                    title={t(`workMode.${item.workMode}`)}
                    rows={[{ label: t('insights.rolesCount', { count: item.count }), value: `${share}%` }]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <span style={{ fontSize: 19, fontWeight: 650, color: 'var(--text)' }}>{total}</span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>{t('insights.donutTotalLabel')}</span>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minWidth: 140 }}>
        {data.map((d) => {
          const share = total > 0 ? Math.round((d.count / total) * 100) : 0;
          return (
            <div key={d.workMode} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: WORK_MODE_COLOR[d.workMode] ?? 'var(--chart-4)',
                  flexShrink: 0,
                }}
              />
              <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{t(`workMode.${d.workMode}`)}</span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{share}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
