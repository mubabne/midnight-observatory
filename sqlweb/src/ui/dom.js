// Tiny DOM helper. Children that are strings become text nodes, so
// database values can never be interpreted as HTML.
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/**
 * Turns lesson text into nodes. `backticks` become <code> and **stars**
 * become <strong>. Everything else stays plain text, never HTML.
 */
export function richText(text) {
  const parts = String(text ?? '').split(/(`[^`]+`|\*\*[^*]+\*\*)/);
  return parts
    .filter((p) => p !== '')
    .map((p) => {
      if (p.startsWith('`') && p.endsWith('`') && p.length > 2) return el('code', { text: p.slice(1, -1) });
      if (p.startsWith('**') && p.endsWith('**') && p.length > 4) return el('strong', { text: p.slice(2, -2) });
      return document.createTextNode(p);
    });
}

/**
 * Renders a lesson body. Blocks are a string (paragraph), { sql } (example
 * with a Load button), { list: [...] } (bullets) or { note } (a side note).
 */
export function renderBlocks(blocks = [], { onLoad, loadLabel, noteLabel } = {}) {
  return blocks.map((block) => {
    if (typeof block === 'string') return el('p', {}, richText(block));
    if (block.sql) {
      return el(
        'div',
        { class: 'lesson-example' },
        el('pre', { class: 'hint-sql' }, el('code', { text: block.sql })),
        onLoad ? el('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => onLoad(block.sql) }, loadLabel) : null
      );
    }
    if (block.list) return el('ul', { class: 'lesson-list-bullets' }, block.list.map((item) => el('li', {}, richText(item))));
    if (block.note) {
      const quote = block.note.startsWith('"');
      return el(
        'aside',
        { class: `lesson-note${quote ? ' is-quote' : ''}` },
        quote ? null : el('strong', { class: 'lesson-note-label', text: `${noteLabel}: ` }),
        richText(quote ? block.note : block.note.replace(/^On a server:\s*/, ''))
      );
    }
    return null;
  });
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Clipboard API can be unavailable (e.g. http on a LAN address).
    const area = el('textarea', { class: 'sr-only', 'aria-hidden': 'true' });
    area.value = text;
    document.body.append(area);
    area.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    area.remove();
    return ok;
  }
}
