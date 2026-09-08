import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { RESOURCES, LANGUAGES, type LanguageCode } from './locales';

/**
 * Инициализация локализации.
 *
 * Порядок определения языка: сохранённый выбор в localStorage, затем язык
 * браузера, затем русский как язык по умолчанию. Выбор пользователя всегда
 * приоритетнее автоопределения, поэтому detector начинает с localStorage.
 */

export const STORAGE_KEY = 'aeris_lang';
export const DEFAULT_LANGUAGE: LanguageCode = 'ru';

export const SUPPORTED = LANGUAGES.map((l) => l.code) as LanguageCode[];

export const isSupported = (code: string): code is LanguageCode =>
  (SUPPORTED as string[]).includes(code);

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: RESOURCES,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED,
    // ru-RU и uk-UA должны попадать в ru и uk, а не улетать в fallback
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: {
      // React экранирует сам, двойное экранирование ломает кириллицу и кавычки
      escapeValue: false,
    },
    returnNull: false,
  });

/** Меняет язык и синхронизирует атрибут lang у документа. */
export function setLanguage(code: LanguageCode) {
  void i18n.changeLanguage(code);
  document.documentElement.lang = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // приватный режим — язык проживёт до перезагрузки
  }
}

export const currentLanguage = (): LanguageCode => {
  const raw = i18n.resolvedLanguage ?? i18n.language ?? DEFAULT_LANGUAGE;
  const base = raw.split('-')[0];
  return isSupported(base) ? base : DEFAULT_LANGUAGE;
};

/**
 * Тег локали для Intl и toLocaleString.
 *
 * Не хук: нужен и в чистых помощниках, где хук недоступен. Компоненты,
 * которые форматируют даты, всё равно перерисовываются при смене языка —
 * они подписаны на него через useTranslation, — поэтому значение читается
 * свежим.
 */
export const localeTag = (): string => currentLanguage();

document.documentElement.lang = currentLanguage();

export default i18n;
export { LANGUAGES, type LanguageCode };
