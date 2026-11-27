// Saves progress in localStorage. Every read is validated: if storage is
// blocked (private mode, disabled cookies) or the saved JSON is damaged,
// the game falls back to a fresh state and tells the player why.
//
// Version 2 keeps one progress record per level:
//   { version: 2, lang, level, levels: { [levelId]: LevelState } }
// Version 1 saves (one case only) are migrated into the Observatory level.

export const STORAGE_KEY = 'midnight-observatory/v1';
export const HISTORY_LIMIT = 50;
const LANGS = ['en', 'mn'];
const MAX_SNAPSHOT_CHARS = 6 * 1024 * 1024;
const V1_LEVEL = 'observatory';

// Warnings are keys into the UI strings, so they show in the current language.
export const WARN = {
  blocked: 'warnBlocked',
  unreadable: 'warnUnreadable',
  damaged: 'warnDamaged',
  saveFailed: 'warnSaveFailed',
};

export function defaultLevelState(startingQuery = '') {
  return {
    draft: startingQuery,
    history: [],
    notes: '',
    hintsRevealed: 0,
    bonusRevealed: false,
    solved: false,
    guesses: [],
    lessonsDone: [],
    lesson: null,
    snapshot: null, // base64 database bytes, writable levels only
  };
}

export function defaultState({ lang = 'en', level = 'academy' } = {}) {
  return { version: 2, lang, level, levels: {} };
}

const isString = (v) => typeof v === 'string';

/** Copies only well-formed fields from one saved level onto a default level state. */
export function sanitizeLevel(raw, startingQuery = '') {
  const base = defaultLevelState(startingQuery);
  if (!raw || typeof raw !== 'object') return base;
  if (isString(raw.draft)) base.draft = raw.draft;
  if (isString(raw.notes)) base.notes = raw.notes;
  if (Number.isInteger(raw.hintsRevealed) && raw.hintsRevealed >= 0) {
    base.hintsRevealed = Math.min(raw.hintsRevealed, 10);
  }
  base.bonusRevealed = raw.bonusRevealed === true;
  base.solved = raw.solved === true;
  if (Array.isArray(raw.history)) {
    base.history = raw.history
      .filter((h) => h && isString(h.sql) && isString(h.ranAt))
      .slice(0, HISTORY_LIMIT)
      .map((h) => ({
        sql: h.sql,
        ranAt: h.ranAt,
        ok: h.ok === true,
        summary: isString(h.summary) ? h.summary : '',
      }));
  }
  if (Array.isArray(raw.guesses)) base.guesses = raw.guesses.filter(isString).slice(0, 20);
  if (Array.isArray(raw.lessonsDone)) base.lessonsDone = [...new Set(raw.lessonsDone.filter(isString))].slice(0, 100);
  if (isString(raw.lesson)) base.lesson = raw.lesson;
  if (isString(raw.snapshot) && raw.snapshot.length <= MAX_SNAPSHOT_CHARS && /^[A-Za-z0-9+/=]*$/.test(raw.snapshot)) {
    base.snapshot = raw.snapshot;
  }
  return base;
}

export class Store {
  /**
   * starterFor(levelId, lang) returns a level's starting query, so a fresh
   * level always starts with the right query in the right language.
   */
  constructor({
    starterFor = () => '',
    storage = safeLocalStorage(),
    defaultLang = 'en',
    levelIds = [V1_LEVEL],
    defaultLevel = levelIds[0],
  } = {}) {
    this.starterFor = starterFor;
    this.levelIds = levelIds;
    this.defaultLevel = levelIds.includes(defaultLevel) ? defaultLevel : levelIds[0];
    this.defaultLang = LANGS.includes(defaultLang) ? defaultLang : 'en';
    this.storage = storage;
    this.warning = storage ? null : WARN.blocked;
    this.isNew = true;
    this.state = this.#load();
  }

  #fresh(lang = this.defaultLang) {
    return defaultState({ lang, level: this.defaultLevel });
  }

  #load() {
    if (!this.storage) return this.#fresh();
    let text = null;
    try {
      text = this.storage.getItem(STORAGE_KEY);
    } catch {
      this.warning = WARN.unreadable;
      return this.#fresh();
    }
    if (text === null) return this.#fresh();
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('bad data');
      const state = this.#sanitize(parsed);
      this.isNew = false;
      return state;
    } catch {
      this.warning = WARN.damaged;
      return this.#fresh();
    }
  }

  #sanitize(raw) {
    const lang = LANGS.includes(raw.lang) ? raw.lang : this.defaultLang;
    if (raw.version === 1) {
      // The original single-case save becomes the Observatory's progress.
      const state = defaultState({ lang, level: this.levelIds.includes(V1_LEVEL) ? V1_LEVEL : this.defaultLevel });
      if (this.levelIds.includes(V1_LEVEL)) {
        state.levels[V1_LEVEL] = sanitizeLevel(raw, this.starterFor(V1_LEVEL, lang));
      }
      return state;
    }
    if (raw.version !== 2) throw new Error('bad version');
    const level = this.levelIds.includes(raw.level) ? raw.level : this.defaultLevel;
    const state = defaultState({ lang, level });
    if (raw.levels && typeof raw.levels === 'object') {
      for (const id of this.levelIds) {
        if (raw.levels[id]) state.levels[id] = sanitizeLevel(raw.levels[id], this.starterFor(id, lang));
      }
    }
    return state;
  }

  /** Progress for a level (a fresh record if it was never played). */
  levelState(id = this.state.level) {
    this.state.levels[id] ??= defaultLevelState(this.starterFor(id, this.state.lang));
    return this.state.levels[id];
  }

  /** Progress for the current level. */
  get lv() {
    return this.levelState();
  }

  save() {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Quota exceeded or storage revoked mid-session: keep playing in memory.
      this.warning = WARN.saveFailed;
    }
  }

  /** Changes top-level fields (lang, level). */
  update(changes) {
    Object.assign(this.state, changes);
    this.save();
  }

  /** Changes the current level's progress. */
  updateLevel(changes, id = this.state.level) {
    Object.assign(this.levelState(id), changes);
    this.save();
  }

  addHistory(entry) {
    const history = [entry, ...this.lv.history].slice(0, HISTORY_LIMIT);
    this.updateLevel({ history });
  }

  /** Clears one level's progress; other levels and the language are kept. */
  resetLevel(id = this.state.level) {
    this.state.levels[id] = defaultLevelState(this.starterFor(id, this.state.lang));
    this.save();
  }
}

export function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(text) {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function safeLocalStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__mo_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}
