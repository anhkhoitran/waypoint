import type { ReactNode } from 'react';

interface ChartTooltipRow {
  label: string;
  value: ReactNode;
  color?: string;
}

/** Values lead (bold), labels follow (secondary); series identity via a line-key swatch, never a filled box. */
export function ChartTooltip({ title, rows }: { title?: string; rows: ChartTooltipRow[] }) {
  return (
    <div className="chart-tooltip">
      {title ? <div className="chart-tooltip-title">{title}</div> : null}
      {rows.map((row, i) => (
        <div key={i} className="chart-tooltip-row">
          {row.color ? (
            <span className="chart-tooltip-key" style={{ background: row.color }} />
          ) : null}
          <span className="chart-tooltip-label">{row.label}</span>
          <span className="chart-tooltip-value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}
