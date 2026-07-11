import { i18n } from '../i18n';

// Uses the i18next singleton directly (not the useTranslation() hook) since
// this is a plain utility, not a component — callers already use the hook
// for their own strings, so they re-render (and this re-resolves current
// language) whenever the language changes.
export function timeAgo(date: Date | string | null): string {
  if (!date) return i18n.t('time.recently');
  const d = typeof date === 'string' ? new Date(date) : date;
  const seconds = Math.max(0, Math.round((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return i18n.t('time.justNow');
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return i18n.t('time.minutesAgo', { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t('time.hoursAgo', { count: hours });
  const days = Math.round(hours / 24);
  if (days === 1) return i18n.t('time.yesterday');
  return i18n.t('time.daysAgo', { count: days });
}
