import type { TopCompanyItem } from '@waypoint/shared';
import { useTranslation } from 'react-i18next';

export function TopCompaniesList({ data }: { data: TopCompanyItem[] }) {
  const { t } = useTranslation();
  const maxCount = Math.max(1, ...data.map((d) => d.count));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {data.map((row) => (
        <div key={row.company} className="top-company-row">
          <span className="top-company-name">{row.company}</span>
          <div className="top-company-bar-track">
            <div
              className="top-company-bar-fill"
              style={{ width: `${Math.round((row.count / maxCount) * 100)}%` }}
            />
          </div>
          <span className="top-company-count">{t('insights.rolesCount', { count: row.count })}</span>
        </div>
      ))}
    </div>
  );
}
