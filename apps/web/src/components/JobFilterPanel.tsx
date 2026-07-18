import {
  SOURCE_LABELS,
  type FacetOption,
  type JobFacets,
  type JobMatchBucket,
  type JobPostedBucket,
  type JobSalaryBucket,
  type JobSource,
  type SeniorityLevel,
  type WorkMode,
} from '@waypoint/shared';
import { useTranslation } from 'react-i18next';
import { EMPTY_FILTERS, RADAR_PRESETS, toggleArrayValue, type RadarFilters } from '../lib/radarFilters';

const SOURCE_OPTIONS: JobSource[] = [
  'remoteok',
  'weworkremotely',
  'hn_whos_hiring',
  'itviec',
  'topdev',
  'vietnamworks',
];
const WORK_MODE_OPTIONS: WorkMode[] = ['remote', 'hybrid', 'onsite'];
const SENIORITY_OPTIONS: SeniorityLevel[] = ['intern', 'junior', 'mid', 'senior', 'lead'];

function countFor(options: FacetOption[], value: string): number {
  return options.find((o) => o.value === value)?.count ?? 0;
}

export function JobFilterPanel({
  filters,
  facets,
  resultsCount,
  onChange,
  onClearAll,
}: {
  filters: RadarFilters;
  facets: JobFacets;
  resultsCount: number;
  onChange: (updater: (prev: RadarFilters) => RadarFilters) => void;
  onClearAll: () => void;
}) {
  const { t } = useTranslation();

  const toggleMulti = (key: 'sources' | 'workModes' | 'seniorities', value: string) =>
    onChange((prev) => ({ ...prev, [key]: toggleArrayValue(prev[key] as string[], value) }));
  const clickSalary = (value: JobSalaryBucket) =>
    onChange((prev) => ({ ...prev, salary: prev.salary === value ? 'any' : value }));
  const clickPosted = (value: JobPostedBucket) =>
    onChange((prev) => ({ ...prev, posted: prev.posted === value ? 'any' : value }));
  const clickMatch = (value: JobMatchBucket) =>
    onChange((prev) => ({ ...prev, match: prev.match === value ? 'any' : value }));

  const option = (key: string, active: boolean, label: string, count: number | null, onClick: () => void) => (
    <button key={key} className={`facet-option${active ? ' active' : ''}`} onClick={onClick}>
      {label}
      {count !== null ? <span className="facet-option-count">{count}</span> : null}
    </button>
  );

  return (
    <div className="filter-panel">
      <div className="facet-grid">
        <div className="facet-group">
          <div className="facet-group-label">{t('radar.filterPanel.sourceLabel')}</div>
          <div className="facet-option-row">
            {SOURCE_OPTIONS.map((value) =>
              option(
                value,
                filters.sources.includes(value),
                SOURCE_LABELS[value],
                countFor(facets.sources, value),
                () => toggleMulti('sources', value),
              ),
            )}
          </div>
        </div>

        <div className="facet-group">
          <div className="facet-group-label">{t('radar.filterPanel.workModeLabel')}</div>
          <div className="facet-option-row">
            {WORK_MODE_OPTIONS.map((value) =>
              option(
                value,
                filters.workModes.includes(value),
                t(`workMode.${value}`),
                countFor(facets.workModes, value),
                () => toggleMulti('workModes', value),
              ),
            )}
          </div>
        </div>

        <div className="facet-group">
          <div className="facet-group-label">{t('radar.filterPanel.seniorityLabel')}</div>
          <div className="facet-option-row">
            {SENIORITY_OPTIONS.map((value) =>
              option(
                value,
                filters.seniorities.includes(value),
                t(`seniority.${value}`),
                countFor(facets.seniorities, value),
                () => toggleMulti('seniorities', value),
              ),
            )}
          </div>
        </div>

        <div className="facet-group">
          <div className="facet-group-label">{t('radar.filterPanel.salaryLabel')}</div>
          <div className="facet-option-row">
            {option('any', filters.salary === 'any', t('radar.filterPanel.any'), null, () => clickSalary('any'))}
            {option(
              'has',
              filters.salary === 'has',
              t('radar.filterPanel.hasSalary'),
              countFor(facets.salary, 'has'),
              () => clickSalary('has'),
            )}
            {option('100', filters.salary === '100', '$100k+', countFor(facets.salary, '100'), () =>
              clickSalary('100'),
            )}
            {option('150', filters.salary === '150', '$150k+', countFor(facets.salary, '150'), () =>
              clickSalary('150'),
            )}
          </div>
        </div>

        <div className="facet-group">
          <div className="facet-group-label">{t('radar.filterPanel.postedLabel')}</div>
          <div className="facet-option-row">
            {option('any', filters.posted === 'any', t('radar.filterPanel.any'), null, () => clickPosted('any'))}
            {option(
              '24h',
              filters.posted === '24h',
              t('radar.filterPanel.last24h'),
              countFor(facets.posted, '24h'),
              () => clickPosted('24h'),
            )}
            {option(
              'week',
              filters.posted === 'week',
              t('radar.filterPanel.lastWeek'),
              countFor(facets.posted, 'week'),
              () => clickPosted('week'),
            )}
          </div>
        </div>

        <div className="facet-group">
          <div className="facet-group-label">{t('radar.filterPanel.matchLabel')}</div>
          <div className="facet-option-row">
            {option('any', filters.match === 'any', t('radar.filterPanel.any'), null, () => clickMatch('any'))}
            {option('40', filters.match === '40', '40%+', countFor(facets.match, '40'), () => clickMatch('40'))}
            {option('70', filters.match === '70', '70%+', countFor(facets.match, '70'), () => clickMatch('70'))}
          </div>
        </div>
      </div>

      <div className="saved-search-row">
        <span className="saved-search-label">{t('radar.filterPanel.savedSearches')}</span>
        {RADAR_PRESETS.map((preset) => (
          <button
            key={preset.labelKey}
            className="saved-search-chip"
            onClick={() => onChange(() => ({ ...EMPTY_FILTERS, ...preset.patch }))}
          >
            {t(preset.labelKey)}
          </button>
        ))}
        <span className="filter-panel-results-count">
          {t('radar.filterPanel.resultsCount', { count: resultsCount })}
        </span>
        <button className="filter-panel-clear" onClick={onClearAll}>
          {t('radar.filterPanel.clearAll')}
        </button>
      </div>
    </div>
  );
}
