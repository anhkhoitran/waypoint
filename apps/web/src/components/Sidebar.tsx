import { NavLink } from 'react-router-dom';
import { useReviewStats } from '../api/review';
import { Icon, type IconName } from './Icon';
import { useTheme } from '../theme';

const nav: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/', label: 'Job Radar', icon: 'radar' },
  { to: '/insights', label: 'Market Insights', icon: 'chart' },
  { to: '/roadmap', label: 'Prep Roadmap', icon: 'map' },
  { to: '/review', label: 'Daily Review', icon: 'layers' },
  { to: '/tracker', label: 'Applications', icon: 'kanban' },
];

const secondaryNav: Array<{ to: string; label: string; icon: IconName }> = [
  { to: '/profile', label: 'Profile', icon: 'gear' },
];

export function Sidebar() {
  const { theme, toggle } = useTheme();
  const reviewStats = useReviewStats();
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
          {item.label}
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
          {item.label}
        </NavLink>
      ))}

      <div className="sidebar-footer">
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
          Phase 0 · v0.1
        </span>
        <button
          className="theme-toggle"
          onClick={toggle}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          <Icon name={theme === 'light' ? 'moon' : 'sun'} size={15} />
        </button>
      </div>
    </aside>
  );
}
