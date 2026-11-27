// Tiny translation helper. t('key', ...args) returns the current language's
// text; applyStatic() fills every element marked with data-i18n attributes.
import { STRINGS } from './strings.js';

let current = 'en';

export function setLang(lang) {
  current = STRINGS[lang] ? lang : 'en';
}

export function getLang() {
  return current;
}

export function t(key, ...args) {
  const value = STRINGS[current][key] ?? STRINGS.en[key];
  if (value === undefined) return key;
  return typeof value === 'function' ? value(...args) : value;
}

/** Picks Mongolian for Mongolian browsers, English otherwise. */
export function detectLang(navigatorLike = globalThis.navigator) {
  const langs = navigatorLike?.languages?.length ? navigatorLike.languages : [navigatorLike?.language ?? 'en'];
  return langs.some((l) => /^mn\b/i.test(l)) ? 'mn' : 'en';
}

/*
 * data-i18n="key"            -> textContent
 * data-i18n-html="key"       -> innerHTML (only for trusted strings in strings.js)
 * data-i18n-attr="attr:key;attr2:key2" -> attributes
 */
export function applyStatic(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of root.querySelectorAll('[data-i18n-html]')) el.innerHTML = t(el.dataset.i18nHtml);
  for (const el of root.querySelectorAll('[data-i18n-attr]')) {
    for (const pair of el.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':').map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(key));
    }
  }
  document.documentElement.lang = t('htmlLang');
  // document.title follows the current level, so main.js sets it.
}
