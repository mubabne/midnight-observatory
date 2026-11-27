// Saves progress in localStorage. Every read is validated: if storage is
// blocked (private mode, disabled cookies) or the saved JSON is damaged,
// the game falls back to a fresh state and tells the player why.

export const STORAGE_KEY = 'midnight-observatory/v1';
export const HISTORY_LIMIT = 50;
const LANGS = ['en', 'mn'];

// Warnings are keys into the UI strings, so they show in the current language.
export const WARN = {
  blocked: 'warnBlocked',
  unreadable: 'warnUnreadable',
  damaged: 'warnDamaged',
  saveFailed: 'warnSaveFailed',
};

export function defaultState(startingQuery, lang = 'en') {
  return {
    version: 1,
    lang,
    draft: startingQuery,
    history: [],
    notes: '',
    hintsRevealed: 0,
    bonusRevealed: false,
    solved: false,
    guesses: [],
  };
}

const isString = (v) => typeof v === 'string';

/** Copies only well-formed fields from saved data onto a default state. */
export function sanitize(raw, startingQuery, lang = 'en') {
  const base = defaultState(startingQuery, lang);
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return base;

  if (LANGS.includes(raw.lang)) base.lang = raw.lang;
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
  if (Array.isArray(raw.guesses)) {
    base.guesses = raw.guesses.filter(isString).slice(0, 20);
  }
  return base;
}

export class Store {
  /**
   * startingQuery may be a string or a function of the language, so a fresh
   * state always gets the starting query in the right language.
   */
  constructor(startingQuery, storage = safeLocalStorage(), defaultLang = 'en') {
    this.startingQueryFor = typeof startingQuery === 'function' ? startingQuery : () => startingQuery;
    this.defaultLang = LANGS.includes(defaultLang) ? defaultLang : 'en';
    this.storage = storage;
    this.warning = storage ? null : WARN.blocked;
    this.state = this.#load();
  }

  #fresh(lang = this.defaultLang) {
    return defaultState(this.startingQueryFor(lang), lang);
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
      if (!parsed || parsed.version !== 1) throw new Error('bad version');
      const lang = LANGS.includes(parsed.lang) ? parsed.lang : this.defaultLang;
      return sanitize(parsed, this.startingQueryFor(lang), lang);
    } catch {
      this.warning = WARN.damaged;
      return this.#fresh();
    }
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

  update(changes) {
    Object.assign(this.state, changes);
    this.save();
  }

  addHistory(entry) {
    const history = [entry, ...this.state.history].slice(0, HISTORY_LIMIT);
    this.update({ history });
  }

  /** Clears progress but keeps the chosen language. */
  reset() {
    const lang = this.state.lang;
    try {
      this.storage?.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    this.state = this.#fresh(lang);
    this.save();
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
