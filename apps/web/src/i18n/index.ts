import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import vi from './locales/vi.json';

export type Locale = 'en' | 'vi';
const STORAGE_KEY = 'waypoint-locale';

function initialLocale(): Locale {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === 'vi' ? 'vi' : 'en';
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    vi: { translation: vi },
  },
  lng: initialLocale(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
  document.documentElement.lang = lng;
});
document.documentElement.lang = i18n.language;

export { i18n };
