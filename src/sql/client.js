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
  constructor({ timeoutMs = QUERY_TIMEOUT_MS, lang = 'en' } = {}) {
    this.timeoutMs = timeoutMs;
    this.lang = lang;
    this.worker = null;
    this.pending = new Map();
    this.nextId = 1;
    this.ready = null;
  }

  /**
   * Starts (or restarts) the worker and loads the evidence in a language.
   * Restarts after a timeout reuse the last language.
   */
  start(lang = this.lang) {
    this.lang = lang;
    this.#spawn();
    const ready = this.#send('init', { lang }, INIT_TIMEOUT_MS);
    this.ready = ready;
    // A failed start must not leave a half-working worker around. Only the
    // latest start may do this: an older start that was superseded by a
    // restart must not tear down the newer worker.
    ready.catch(() => {
      if (this.ready === ready) this.#kill(new Error('Engine failed to start.'));
    });
    return ready;
  }

  async query(sql) {
    await this.ready;
    return this.#send('query', { sql }, this.timeoutMs);
  }

  async findPerson(name) {
    await this.ready;
    return this.#send('findPerson', { name }, this.timeoutMs);
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
        entry.resolve(result);
      } else {
        const err = new Error(error.message);
        err.detail = error.detail;
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
