import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useReviewStats } from '../api/review';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../theme';

const nav: Array<{ to: string; labelKey: string; icon: IconName }> = [
  { to: '/', labelKey: 'nav.jobRadar', icon: 'radar' },
  { to: '/insights', labelKey: 'nav.marketInsights', icon: 'chart' },
  { to: '/roadmap', labelKey: 'nav.prepRoadmap', icon: 'map' },
  { to: '/review', labelKey: 'nav.dailyReview', icon: 'layers' },
  { to: '/tracker', labelKey: 'nav.applications', icon: 'kanban' },
];

const secondaryNav: Array<{ to: string; labelKey: string; icon: IconName }> = [
  { to: '/profile', labelKey: 'nav.profile', icon: 'gear' },
];

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { theme, toggle } = useTheme();
  const reviewStats = useReviewStats();
  const otherLocale = i18n.language === 'vi' ? 'en' : 'vi';

  return (
    <aside className="sidebar">
      <div className="logo">
        <span className="logo-mark">
          <Icon name="waypoint" size={17} />
        </span>
        <span className="logo-name">Waypoint</span>
      </div>

      <div className="nav-section-label">Workspace</div>
      {nav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Icon name={item.icon} size={16} />
          {t(item.labelKey)}
          {item.to === '/review' && reviewStats.data && reviewStats.data.dueToday > 0 ? (
            <span className="nav-badge">{reviewStats.data.dueToday}</span>
          ) : null}
        </NavLink>
      ))}

      <div style={{ borderTop: '1px solid var(--border)', margin: '10px 12px' }} />

      {secondaryNav.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
        >
          <Icon name={item.icon} size={16} />
          {t(item.labelKey)}
        </NavLink>
      ))}

      <div className="sidebar-footer">
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          {t('nav.footer', { phase: 3, version: '0.1' })}
        </span>
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <button
            className="theme-toggle"
            onClick={() => i18n.changeLanguage(otherLocale)}
            aria-label={t(otherLocale === 'vi' ? 'common.switchToVietnamese' : 'common.switchToEnglish')}
            title={t(otherLocale === 'vi' ? 'common.switchToVietnamese' : 'common.switchToEnglish')}
          >
            <span style={{ fontSize: 11, fontWeight: 700 }}>{i18n.language === 'vi' ? 'VI' : 'EN'}</span>
          </button>
          <button
            className="theme-toggle"
            onClick={toggle}
            aria-label={t(theme === 'light' ? 'common.switchToDarkMode' : 'common.switchToLightMode')}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
          </button>
        </span>
      </div>
    </aside>
  );
}
