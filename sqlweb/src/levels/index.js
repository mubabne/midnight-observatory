// The level ladder. Every level is open; players pick the one that matches
// their SQL. Each level file describes its database, its kind and its text:
//   kind 'lessons'  guided tasks checked automatically (Academy, Tampered Evidence)
//   kind 'case'     a mystery solved by naming a suspect (Observatory, Cold Case)
import academy from './academy/level.js';
import observatory from './observatory/level.js';
import coldcase from './coldcase/level.js';
import tampered from './tampered/level.js';

export const LEVELS = [academy, observatory, coldcase, tampered];
export const LEVEL_IDS = LEVELS.map((l) => l.id);
export const DEFAULT_LEVEL = 'academy';

const BY_ID = new Map(LEVELS.map((l) => [l.id, l]));

export function getLevel(id) {
  return BY_ID.get(id) ?? BY_ID.get(DEFAULT_LEVEL);
}

/** The level's text in a language, falling back to English. */
export function levelContent(level, lang) {
  return level.content[lang] ?? level.content.en;
}

/** True when the level has its own text in this language. */
export function hasLanguage(level, lang) {
  return Boolean(level.content[lang]);
}

export function findLesson(level, lang, lessonId) {
  return levelContent(level, lang).lessons?.find((l) => l.id === lessonId) ?? null;
}
