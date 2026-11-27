// Main-thread wrapper around the SQL worker.
// Each request gets a promise. If a query runs past the timeout we
// terminate the worker (the only way to stop a busy WebAssembly loop)
// and quietly start a fresh one so the player can keep going.

export const QUERY_TIMEOUT_MS = 5000;
const INIT_TIMEOUT_MS = 20000;

export class TimeoutError extends Error {
  constructor(seconds) {
    super(`Query stopped after ${seconds} seconds.`);
    this.name = 'TimeoutError';
    this.seconds = seconds; // the UI shows a translated explanation
  }
}

export class SqlClient {
  constructor({ timeoutMs = QUERY_TIMEOUT_MS, lang = 'en', level = null } = {}) {
    this.timeoutMs = timeoutMs;
    this.lang = lang;
    this.level = level;
    // Latest bytes of a writable level's database, so a restart after a
    // timeout picks up exactly where the player was.
    this.snapshot = null;
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
    this.ready = null;
  }

  /**
   * Starts (or restarts) the worker and loads a level in a language.
   * start('mn') changes only the language; start({ lang, level, snapshot })
   * can change all three. Restarts after a timeout reuse the last settings.
   */
  start(options = {}) {
    const opts = typeof options === 'string' ? { lang: options } : options;
    if (opts.lang !== undefined) this.lang = opts.lang;
    if (opts.level !== undefined) this.level = opts.level;
    if (opts.snapshot !== undefined) this.snapshot = opts.snapshot;
    this.#spawn();
    const ready = this.#send('init', { lang: this.lang, level: this.level, snapshot: this.snapshot }, INIT_TIMEOUT_MS);
    this.ready = ready;
    // A failed start must not leave a half-working worker around. Only the
    // latest start may do this: an older start that was superseded by a
    // restart must not tear down the newer worker.
    ready.catch(() => {
      if (this.ready === ready) this.#kill(new Error('Engine failed to start.'));
    });
    return ready;
  }

  /** lessonId (optional) asks the worker to grade the run against that lesson. */
  async query(sql, { lessonId = null } = {}) {
    await this.ready;
    return this.#send('query', { sql, lessonId }, this.timeoutMs);
  }

  async findPerson(name) {
    await this.ready;
    return this.#send('findPerson', { name }, this.timeoutMs);
  }

  /** Writable levels: back to the level's starting data. */
  async resetDb() {
    await this.ready;
    const result = await this.#send('resetDb', {}, this.timeoutMs);
    this.snapshot = null;
    return result;
  }

  #spawn() {
    this.#kill(new Error('The SQL engine restarted.'));
    this.worker = new Worker(new URL('./sql.worker.js', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event) => {
      const { id, ok, result, error } = event.data;
      const entry = this.pending.get(id);
      if (!entry) return;
      this.pending.delete(id);
      clearTimeout(entry.timer);
      if (ok) {
        if (result?.snapshot) this.snapshot = result.snapshot;
        entry.resolve(result);
      } else {
        const err = new Error(error.message);
        err.detail = error.detail;
        if (error.snapshot) {
          this.snapshot = error.snapshot;
          err.snapshot = error.snapshot;
          err.schema = error.schema;
          err.rolledBack = error.rolledBack;
        }
        entry.reject(err);
      }
    };
    this.worker.onerror = (event) => {
      event.preventDefault?.();
      this.#kill(new Error(event.message || 'The SQL engine crashed.'));
    };
  }

  #kill(reason) {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer);
      entry.reject(reason);
    }
    this.pending.clear();
  }

  #send(type, payload, timeoutMs) {
    if (!this.worker) return Promise.reject(new Error('The SQL engine is not running.'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new TimeoutError(Math.round(timeoutMs / 1000)));
        // Restart in the background; the next query waits for it.
        if (type === 'init') {
          this.#kill(new Error('Engine start timed out.'));
        } else {
          this.start().catch(() => {});
        }
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, type, payload });
    });
  }
}
